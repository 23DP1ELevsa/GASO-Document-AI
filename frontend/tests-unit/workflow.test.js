import test from 'node:test'
import assert from 'node:assert/strict'
import {
  workflowState,
  navigationState,
  asSingleDocument,
  groupAtBoundaries,
  draftHasDocuments,
  recognizeDocument,
} from '../src/features/documents/workflow.js'
import {
  migrateGrouping,
  createDocument,
  confirmDocument,
  editValue,
  sourceVersion,
  updateDocument,
} from '../src/features/documents/model.js'
import { makeOcrResult } from '../src/features/ocr/model.js'
import { defaultProcessing } from '../src/features/processing/geometry.js'
import { analyzePages } from '../src/features/documents/analysis.js'
function initial() {
  return migrateGrouping({
    id: 'session',
    revision: 1,
    pages: ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id, width: 600, height: 800 })),
  })
}
test('workflow resumes old drafts from actual data and validates saved navigation against reachable steps', () => {
  let s = initial()
  assert.equal(workflowState(s).step, 2)
  assert.equal(workflowState({ ...s, pages: [] }).step, 1)
  assert.equal(workflowState({ ...s, workflow: { step: 4 } }).step, 2)
  s = asSingleDocument(s)
  assert.equal(workflowState(s).step, 3)
  s = confirmDocument(s, s.documents[0].id)
  assert.equal(workflowState(s).step, 4)
  assert.deepEqual(workflowState(s).complete, [true, true, true, false])
  assert.equal(workflowState({ ...s, workflow: { step: 2 } }).step, 2)
  s = editValue(s, s.documents[0].id, 'sender', 'Labots')
  assert.equal(workflowState(s).reviewed, false)
  assert.deepEqual(navigationState({ step: 999, documentId: 9 }), { step: null, documentId: null })
})
test('one-document shortcut keeps original pages and OCR and requires no per-page selection', () => {
  const old = initial(),
    result = asSingleDocument(old)
  assert.equal(result.documents.length, 1)
  assert.deepEqual(
    result.documents[0].pageIds,
    old.pages.map((page) => page.id),
  )
  assert.equal(result.pages, old.pages)
  assert.equal(old.documents.length, 0)
})
test('six pages split visually into three independent documents without transferring attributes', () => {
  let s = groupAtBoundaries(initial(), ['c', 'e'])
  assert.deepEqual(
    s.documents.map((document) => document.pageIds),
    [
      ['a', 'b'],
      ['c', 'd'],
      ['e', 'f'],
    ],
  )
  s = editValue(s, s.documents[0].id, 'sender', 'Pirmais')
  assert.equal(s.documents[1].values.sender, null)
  assert.equal(s.documents[2].values.sender, null)
  assert.throws(() => groupAtBoundaries(initial(), ['missing']))
})
test('grouping remaining pages leaves existing groups and confirmations intact; explicit one-document merge keeps target metadata', () => {
  let s = createDocument(initial(), ['a', 'b'])
  const first = s.documents[0].id
  s = editValue(s, first, 'sender', 'Pirmais')
  s = confirmDocument(s, first)
  const saved = s.documents[0]
  s = groupAtBoundaries(s, ['e'])
  assert.equal(s.documents[0], saved)
  assert.deepEqual(
    s.documents.map((document) => document.pageIds),
    [
      ['a', 'b'],
      ['c', 'd'],
      ['e', 'f'],
    ],
  )
  s = asSingleDocument(s)
  assert.equal(s.documents.length, 1)
  assert.equal(s.documents[0].values.sender, 'Pirmais')
  assert.equal(s.documents[0].confirmation, saved.confirmation)
  assert.equal(workflowState(s).reviewed, false)
})
test('draft list statuses reflect grouped pages and never claim that PDF files have been archived', () => {
  const s = asSingleDocument(initial()),
    draft = { ...s, pageIds: s.pages.map((page) => page.id) }
  assert.equal(draftHasDocuments(draft), true)
  assert.equal(draftHasDocuments({ ...draft, documents: [] }), false)
  assert.equal(draftHasDocuments({ ...draft, pageIds: [...draft.pageIds, 'unassigned'] }), false)
})
function harness() {
  let s = asSingleDocument(initial())
  s.pages = s.pages.slice(0, 2)
  s.documents[0].pageIds = ['a', 'b']
  const session = {
    active: { value: s },
    busy: { value: false },
    saves: 0,
    analyzeDocument(id) {
      this.active.value = updateDocument(this.active.value, id, (document) => ({
        ...document,
        analysis: {
          source: sourceVersion(this.active.value, document),
          result: analyzePages(this.active.value.pages),
        },
      }))
    },
    async save() {
      this.saves++
    },
  }
  const ocr = {
    running: { value: false },
    cancelled: { value: false },
    saveError: { value: '' },
    calls: [],
    async run(pages) {
      this.calls.push(pages.map((page) => page.id))
      session.active.value = {
        ...session.active.value,
        pages: session.active.value.pages.map((page) =>
          pages.some((p) => p.id === page.id)
            ? {
                ...page,
                ocr: makeOcrResult(
                  page,
                  ['lav'],
                  { text: 'Invoice No. TEST-1\nGrand total: 10.00 EUR' },
                  1,
                ),
              }
            : page,
        ),
      }
    },
  }
  return { session, ocr, id: s.documents[0].id }
}
test('recognize document runs OCR and local analysis in order while preserving manual fields and confirmation', async () => {
  const { session, ocr, id } = harness()
  session.active.value = editValue(session.active.value, id, 'sender', 'Manuāls nosūtītājs')
  session.active.value = confirmDocument(session.active.value, id)
  const confirmation = session.active.value.documents[0].confirmation
  await recognizeDocument(session, ocr, id, ['lav'])
  assert.deepEqual(ocr.calls, [['a', 'b']])
  assert.equal(session.active.value.documents[0].analysis.result.attributes.total_amount, '10.00')
  assert.equal(session.active.value.documents[0].values.sender, 'Manuāls nosūtītājs')
  assert.equal(session.active.value.documents[0].confirmation, confirmation)
  assert.equal(session.saves, 1)
})
test('current OCR is reused; only missing or stale pages are recognized again', async () => {
  const { session, ocr, id } = harness()
  await recognizeDocument(session, ocr, id, ['lav'])
  const result = await recognizeDocument(session, ocr, id, ['lav'])
  assert.equal(result.reused, 2)
  assert.equal(ocr.calls.length, 1)
  session.active.value.pages[1] = {
    ...session.active.value.pages[1],
    processing: { ...defaultProcessing(), rotation: 90 },
  }
  await recognizeDocument(session, ocr, id, ['lav'])
  assert.deepEqual(ocr.calls[1], ['b'])
})
test('cancellation and saving failure do not silently produce analysis or confirmation', async () => {
  const { session, ocr, id } = harness()
  ocr.run = async () => {
    ocr.cancelled.value = true
  }
  assert.equal((await recognizeDocument(session, ocr, id, ['lav'])).cancelled, true)
  assert.equal(session.active.value.documents[0].analysis, null)
  ocr.cancelled.value = false
  const error = new Error('quota')
  ocr.run = async () => {
    ocr.saveError.value = error
  }
  await assert.rejects(recognizeDocument(session, ocr, id, ['lav']), /quota/)
  assert.equal(session.active.value.documents[0].analysis, null)
})
