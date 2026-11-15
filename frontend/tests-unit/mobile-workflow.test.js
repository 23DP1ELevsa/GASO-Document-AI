import test from 'node:test'
import assert from 'node:assert/strict'
import {
  asSingleDocument,
  currentExports,
  draftIsDownloaded,
  navigationState,
} from '../src/features/documents/workflow.js'
import { editValue, confirmDocument, updateDocument } from '../src/features/documents/model.js'
import { exportSignature, pdfOptions, scannedPageLayout } from '../src/features/pdf/model.js'

function session() {
  return asSingleDocument({
    id: 'mobile-session',
    revision: 1,
    documents: [],
    pages: [{ id: 'one', width: 600, height: 800 }],
  })
}

test('an explicitly cleared suggestion remains distinct from an untouched field after serialization and later analysis', () => {
  let draft = session()
  const id = draft.documents[0].id
  draft = editValue(draft, id, 'sender', '')
  draft = JSON.parse(JSON.stringify(draft))
  draft = updateDocument(draft, id, (doc) => ({
    ...doc,
    analysis: { result: { attributes: { sender: 'Suggested sender' } } },
  }))
  assert.equal(draft.documents[0].values.sender, null)
  assert.deepEqual(draft.documents[0].editedFields, ['sender'])
  assert.equal(draft.documents[0].values.recipient, null)
  draft = editValue(draft, id, 'sender', 'Manually checked sender')
  assert.equal(draft.documents[0].values.sender, 'Manually checked sender')
  assert.deepEqual(draft.documents[0].editedFields, ['sender'])
})

test('download history survives step navigation and is invalidated by changed values or image content', () => {
  let draft = session()
  const id = draft.documents[0].id
  draft = confirmDocument(draft, id)
  const entry = {
    documentId: id,
    filename: 'Synthetic.pdf',
    downloadedAt: 123,
    signature: exportSignature(draft, draft.documents[0]),
  }
  draft.workflow = navigationState({ step: 4, documentId: id, exports: [entry] })
  assert.deepEqual(currentExports(draft), [entry])
  assert.equal(draftIsDownloaded({ ...draft, pageIds: ['one'] }), true)
  assert.deepEqual(navigationState({ ...draft.workflow, step: 2 }).exports, [entry])
  assert.deepEqual(currentExports(editValue(draft, id, 'sender', 'Changed sender')), [])
  assert.deepEqual(
    currentExports({ ...draft, pages: [{ ...draft.pages[0], contentRevision: 2 }] }),
    [],
  )
  assert.equal(draftIsDownloaded({ ...draft, pageIds: ['one', 'unassigned'] }), false)
})

test('Letter export uses real Letter dimensions in both orientations without distorting a scan', () => {
  assert.equal(pdfOptions({ pageSize: 'letter' }).pageSize, 'letter')
  const portrait = scannedPageLayout(600, 800, 'letter')
  const landscape = scannedPageLayout(800, 600, 'letter')
  assert.deepEqual([portrait.pageWidth, portrait.pageHeight], [612, 792])
  assert.deepEqual([landscape.pageWidth, landscape.pageHeight], [792, 612])
  assert.equal(portrait.width / portrait.height, 600 / 800)
  assert.equal(landscape.width / landscape.height, 800 / 600)
})
