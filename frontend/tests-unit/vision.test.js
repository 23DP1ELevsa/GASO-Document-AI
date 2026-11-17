import test from 'node:test'
import assert from 'node:assert/strict'
import { ALL_FIELDS } from '../src/features/documents/catalog.js'
import {
  createDocument,
  sourceVersion,
  editValue,
  confirmDocument,
  reviewAttribute,
  removeCustomField,
  renameCustomField,
  isConfirmationCurrent,
} from '../src/features/documents/model.js'
import {
  attachAiAnalysis,
  requestAiAnalysis,
  analysisPayload,
} from '../src/features/documents/openai.js'
function fixture() {
  return createDocument({ id: 's', documents: [], pages: [{ id: 'p', width: 600, height: 800 }] }, [
    'p',
  ])
}
function result() {
  return {
    version: 2,
    provider: 'openai',
    requires_review: true,
    document_type: 'contract',
    attributes: Object.fromEntries(
      ALL_FIELDS.filter((key) => key !== 'document_type').map((key) => [key, null]),
    ),
    evidence: {},
    warnings: [],
    dynamic_attributes: [
      {
        id: 'ai_0',
        label: 'Special condition',
        key: null,
        value: 'Synthetic value',
        dataType: 'text',
        pageId: 'p',
        page: 1,
        evidence: null,
        origin: 'ai',
        status: 'unreviewed',
      },
    ],
  }
}
test('dynamic attributes require review; renaming, deletion and manual edits survive repeated analysis', () => {
  let session = fixture(),
    id = session.documents[0].id
  const attach = () => {
    session = attachAiAnalysis(session, id, sourceVersion(session, session.documents[0]), result())
  }
  attach()
  const key = session.documents[0].dynamicAttributes[0].key
  assert.match(key, /^custom_/)
  assert.throws(() => confirmDocument(session, id))
  session = editValue(session, id, key, 'Manual value')
  session = confirmDocument(session, id)
  assert.equal(isConfirmationCurrent(session, session.documents[0]), true)
  attach()
  assert.equal(session.documents[0].values[key], 'Manual value')
  session = renameCustomField(session, id, key, 'Renamed')
  assert.equal(isConfirmationCurrent(session, session.documents[0]), false)
  attach()
  assert.equal(session.documents[0].customFields.length, 1)
  session = removeCustomField(session, id, key)
  attach()
  assert.equal(session.documents[0].customFields.length, 0)
})
test('explicit review protects AI values and records review provenance', () => {
  let session = fixture(),
    id = session.documents[0].id
  session = attachAiAnalysis(session, id, sourceVersion(session, session.documents[0]), result())
  const key = session.documents[0].dynamicAttributes[0].key
  session = reviewAttribute(session, id, key)
  session = confirmDocument(session, id)
  assert.ok(session.documents[0].confirmation.dynamicAttributes[0].reviewedAt)
  const response = result()
  response.dynamic_attributes[0].value = 'Changed suggestion'
  session = attachAiAnalysis(session, id, sourceVersion(session, session.documents[0]), response)
  assert.equal(session.documents[0].values[key], 'Synthetic value')
})
test('request cancellation aborts fetch and never accepts a late result', async () => {
  const controller = new AbortController()
  const promise = requestAiAnalysis(
    {},
    {
      signal: controller.signal,
      fetcher: (_url, { signal }) =>
        new Promise((_resolve, reject) =>
          signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))),
        ),
    },
  )
  controller.abort()
  await assert.rejects(promise, { code: 'cancelled' })
  const session = fixture()
  await assert.rejects(
    analysisPayload(session, session.documents[0].id, true, { signal: controller.signal }),
    /abort/i,
  )
})
