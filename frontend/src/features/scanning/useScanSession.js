import { computed, ref, shallowRef } from 'vue'
import * as repository from './draftRepository'
import { importImage, IMAGE_LIMITS } from './imageImport'
import { ScanError, errorCode } from './errors'
import { newId } from './id'
import { assertTextLength } from '../ocr/model.js'
import * as documents from '../documents/model.js'
import { analyzePages } from '../documents/analysis.js'
import { navigationState, asSingleDocument, groupAtBoundaries } from '../documents/workflow.js'

const active = shallowRef(null)
const dirty = ref(false)
const busy = ref(false)
const saving = ref(false)
export const draftsChanged = ref(0)
const POINTER_KEY = 'gaso-document-ai:active-draft'
function announce() {
  draftsChanged.value++
  try {
    if (typeof BroadcastChannel === 'function') {
      const channel = new BroadcastChannel('gaso-drafts')
      channel.postMessage('changed')
      channel.close()
    }
  } catch {
    /* Optional cross-tab notifications must not turn a committed save into an error. */
  }
}
function remember(id) {
  try {
    if (id) sessionStorage.setItem(POINTER_KEY, id)
    else sessionStorage.removeItem(POINTER_KEY)
  } catch {
    /* The URL also identifies an opened draft. */
  }
}
function remembered() {
  try {
    return sessionStorage.getItem(POINTER_KEY)
  } catch {
    return null
  }
}
function newSession() {
  if (busy.value) return
  active.value = {
    id: newId(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    revision: 0,
    status: 'draft',
    pages: [],
    schemaVersion: 2,
    documents: [],
  }
  dirty.value = false
  remember(null)
}
function mutate(pages, replacedId = null, replacementId = null) {
  let next = { ...active.value, pages, updatedAt: Date.now() }
  if (replacedId) next = documents.replacePageReference(next, replacedId, replacementId)
  active.value = documents.reconcilePages(next)
  dirty.value = true
}

export function useScanSession() {
  async function open(id) {
    if (busy.value) throw new ScanError('busy')
    if (active.value?.id === id) return
    busy.value = true
    try {
      active.value = await repository.loadDraft(id)
      dirty.value = false
      remember(id)
    } finally {
      busy.value = false
    }
  }
  async function initialize(id) {
    const target = id || (!active.value && remembered())
    if (target) await open(target)
    else if (!active.value) newSession()
  }
  async function addFiles(files, replacingId = null) {
    if (!files.length || busy.value) return { added: 0, errors: [] }
    if (!active.value) newSession()
    busy.value = true
    const errors = []
    let added = 0
    try {
      for (const file of files) {
        const pages = active.value.pages
        const replaced = pages.find((page) => page.id === replacingId)
        if (replacingId && !replaced) break
        if (!replaced && pages.length >= IMAGE_LIMITS.pages) {
          errors.push('pageLimit')
          break
        }
        const total =
          pages.reduce((sum, page) => sum + page.size, 0) - (replaced?.size || 0) + file.size
        if (total > IMAGE_LIMITS.sessionBytes) {
          errors.push('sessionSize')
          continue
        }
        try {
          const page = await importImage(file)
          mutate(
            replaced
              ? pages.map((item) => (item.id === replacingId ? page : item))
              : [...pages, page],
            replaced?.id,
            page.id,
          )
          added++
        } catch (error) {
          errors.push(errorCode(error))
        }
        if (replacingId) break
      }
    } finally {
      busy.value = false
    }
    return { added, errors }
  }
  function move(id, direction) {
    if (busy.value) return
    const pages = [...active.value.pages],
      index = pages.findIndex((page) => page.id === id),
      target = index + direction
    if (index < 0 || target < 0 || target >= pages.length) return
    ;[pages[index], pages[target]] = [pages[target], pages[index]]
    mutate(pages)
  }
  function remove(id) {
    if (!busy.value) mutate(active.value.pages.filter((page) => page.id !== id))
  }
  function applyEdit(id, changes) {
    if (busy.value || !active.value?.pages.some((page) => page.id === id))
      throw new ScanError('busy')
    mutate(
      active.value.pages.map((page) =>
        page.id === id
          ? {
              ...page,
              ...changes,
              modifiedAt: Date.now(),
              contentRevision: (page.contentRevision || 0) + 1,
            }
          : page,
      ),
    )
  }
  function applyOcr(id, changes) {
    if (busy.value || !active.value?.pages.some((page) => page.id === id))
      throw new ScanError('busy')
    mutate(
      active.value.pages.map((page) =>
        page.id === id
          ? {
              ...page,
              ...changes,
              contentRevision: (page.contentRevision || 0) + (changes.ocr ? 1 : 0),
            }
          : page,
      ),
    )
  }
  function editOcrText(id, text) {
    assertTextLength(text)
    const page = active.value?.pages.find((page) => page.id === id)
    if (!page?.ocr) throw new ScanError('missingImage')
    applyOcr(id, { ocr: { ...page.ocr, editedText: text, editedAt: Date.now() } })
  }
  async function save() {
    if (busy.value || !active.value || (!active.value.pages.length && !active.value.revision))
      throw new ScanError('empty')
    busy.value = true
    saving.value = true
    try {
      const metadata = await repository.saveDraft(active.value)
      active.value = {
        ...metadata,
        pages: active.value.pages.map(({ original, processed, ...page }) => page),
      }
      dirty.value = false
      remember(metadata.id)
      announce()
      return metadata.id
    } finally {
      saving.value = false
      busy.value = false
    }
  }
  async function discard(id) {
    if (busy.value) throw new ScanError('busy')
    busy.value = true
    try {
      if (!(active.value?.id === id && active.value.revision === 0))
        await repository.deleteDraft(id)
      if (active.value?.id === id) {
        active.value = null
        dirty.value = false
        remember(null)
      }
      announce()
    } finally {
      busy.value = false
    }
  }
  function changeDocuments(action, ...args) {
    if (busy.value || !active.value) throw new ScanError('busy')
    const operation = documents[action]
    if (
      ![
        'createDocument',
        'assignPages',
        'deleteDocument',
        'mergeDocuments',
        'splitDocument',
        'reorderPage',
        'editValue',
        'confirmDocument',
        'addCustomField',
      ].includes(action)
    )
      throw new Error('Unknown operation')
    active.value = operation(active.value, ...args)
    dirty.value = true
  }
  function analyzeDocument(id) {
    if (busy.value || !active.value) throw new ScanError('busy')
    active.value = documents.updateDocument(active.value, id, (document) => ({
      ...document,
      analysis: {
        analyzedAt: Date.now(),
        source: documents.sourceVersion(active.value, document),
        result: analyzePages(documents.documentPages(active.value, document)),
      },
    }))
    dirty.value = true
  }
  function setWorkflow(value) {
    if (busy.value || !active.value) throw new ScanError('busy')
    const workflow = navigationState({ ...active.value.workflow, ...value })
    if (JSON.stringify(workflow) === JSON.stringify(active.value.workflow)) return
    active.value = { ...active.value, workflow, updatedAt: Date.now() }
    dirty.value = true
  }
  function groupSession(starts = null) {
    if (busy.value || !active.value) throw new ScanError('busy')
    active.value =
      starts === null ? asSingleDocument(active.value) : groupAtBoundaries(active.value, starts)
    dirty.value = true
  }
  return {
    active,
    dirty,
    busy,
    saving,
    initialize,
    open,
    newSession,
    addFiles,
    move,
    remove,
    applyEdit,
    applyOcr,
    editOcrText,
    save,
    discard,
    changeDocuments,
    analyzeDocument,
    setWorkflow,
    groupSession,
    hasUnsavedChanges: computed(() => dirty.value || busy.value),
  }
}
