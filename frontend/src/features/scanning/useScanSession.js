import { computed, ref, shallowRef } from 'vue'
import * as repository from './draftRepository'
import { importImage, IMAGE_LIMITS } from './imageImport'
import { ScanError, errorCode } from './errors'
import { newId } from './id'

const active = shallowRef(null)
const dirty = ref(false)
const busy = ref(false)
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
  }
  dirty.value = false
  remember(null)
}
function mutate(pages) {
  active.value = { ...active.value, pages, updatedAt: Date.now() }
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
  async function save() {
    if (busy.value || !active.value || (!active.value.pages.length && !active.value.revision))
      throw new ScanError('empty')
    busy.value = true
    try {
      const metadata = await repository.saveDraft(active.value)
      active.value = { ...metadata, pages: active.value.pages.map(({ original, ...page }) => page) }
      dirty.value = false
      remember(metadata.id)
      announce()
      return metadata.id
    } finally {
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
  return {
    active,
    dirty,
    busy,
    initialize,
    open,
    newSession,
    addFiles,
    move,
    remove,
    save,
    discard,
    hasUnsavedChanges: computed(() => dirty.value || busy.value),
  }
}
