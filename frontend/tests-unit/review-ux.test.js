import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createDocument,
  confirmDocument,
  editValue,
  sourceVersion,
  isConfirmationCurrent,
  updateDocument,
  validationErrors,
} from '../src/features/documents/model.js'
import { attributeFields } from '../src/features/documents/presentation.js'
function fixture() {
  let session = createDocument(
    { id: 'session', pages: [{ id: 'p', width: 600, height: 800 }], documents: [] },
    ['p'],
  )
  const id = session.documents[0].id
  session = editValue(session, id, 'issue_date', '2026-11-17')
  session = editValue(session, id, 'sender', 'Synthetic')
  return { session, id }
}
test('one confirmation reviews every active attribute and snapshots the reviewed values without mutating input', () => {
  let { session, id } = fixture()
  session = updateDocument(session, id, (item) => ({
    ...item,
    dynamicAttributes: [
      { id: 'a', key: 'sender', value: 'Synthetic', status: 'unreviewed', origin: 'ai' },
    ],
  }))
  const next = confirmDocument(session, id),
    doc = next.documents[0]
  assert.equal(session.documents[0].dynamicAttributes[0].status, 'unreviewed')
  assert.equal(session.documents[0].confirmation, null)
  assert.equal(doc.dynamicAttributes[0].status, 'reviewed')
  assert.deepEqual(doc.confirmation.dynamicAttributes, doc.dynamicAttributes)
  assert.equal(isConfirmationCurrent(next, doc), true)
  assert.equal(
    isConfirmationCurrent(
      editValue(next, id, 'sender', 'Changed'),
      editValue(next, id, 'sender', 'Changed').documents[0],
    ),
    false,
  )
})
test('invalid canonical and dynamic dates reject confirmation without changing values or review statuses', () => {
  let { session, id } = fixture()
  session = updateDocument(session, id, (item) => ({
    ...item,
    values: { ...item.values, custom_date: '2026-02-30' },
    customFields: [{ key: 'custom_date', label: 'Custom date' }],
    dynamicAttributes: [{ id: 'a', key: 'custom_date', dataType: 'date', status: 'unreviewed' }],
  }))
  assert.deepEqual(validationErrors(session.documents[0]), ['custom_date'])
  assert.throws(() => confirmDocument(session, id))
  assert.equal(session.documents[0].confirmation, null)
  assert.equal(session.documents[0].dynamicAttributes[0].status, 'unreviewed')
})
test('reading a legacy suggestion list never edits or confirms a saved document and empty catalog fields are omitted', () => {
  let { session, id } = fixture()
  const before = structuredClone(session)
  const fields = attributeFields(session.documents[0])
  assert.ok(fields.some((field) => field.key === 'sender'))
  assert.ok(!fields.some((field) => field.key === 'total_amount'))
  assert.deepEqual(session, before)
  session = updateDocument(session, id, (item) => ({
    ...item,
    analysis: {
      source: sourceVersion(session, item),
      result: { version: 1, document_type: 'invoice', attributes: { total_amount: '12.00' } },
    },
  }))
  const proposed = attributeFields(session.documents[0], { suggestions: true })
  assert.equal(proposed.find((field) => field.key === 'total_amount').value, '12.00')
  assert.equal(session.documents[0].values.total_amount, null)
  assert.equal(confirmDocument(session, id).documents[0].confirmation.values.total_amount, '12.00')
})
