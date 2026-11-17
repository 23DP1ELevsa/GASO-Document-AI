import test from 'node:test'
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import {
  analysisPayload,
  requestAiAnalysis,
  attachAiAnalysis,
  AiError,
} from '../src/features/documents/openai.js'
import {
  createDocument,
  editValue,
  confirmDocument,
  sourceVersion,
  isAnalysisStale,
  isConfirmationCurrent,
} from '../src/features/documents/model.js'
import { makeOcrResult } from '../src/features/ocr/model.js'
import { ALL_FIELDS, DOCUMENT_TYPES } from '../src/features/documents/catalog.js'
import { recognizeDocument } from '../src/features/documents/workflow.js'

test('backend Structured Outputs catalog matches every frontend field and document type', async () => {
  const schema = await readFile(
    new URL('../../backend/app/DocumentAi/AnalysisSchema.php', import.meta.url),
    'utf8',
  )
  const keys = (name) =>
    [
      ...schema
        .match(new RegExp(`public const ${name} = \\[([\\s\\S]*?)\\];`))[1]
        .matchAll(/'([^']+)'/g),
    ]
      .map((match) => match[1])
      .sort()
  assert.deepEqual(keys('FIELDS'), ALL_FIELDS.filter((key) => key !== 'document_type').sort())
  assert.deepEqual(keys('TYPES'), [...DOCUMENT_TYPES].sort())
})

function fixture() {
  const pages = ['a', 'b'].map((id) => {
    const page = { id, width: 600, height: 800 }
    return { ...page, ocr: makeOcrResult(page, ['lav'], { text: `Invoice ${id}` }, 1) }
  })
  let session = { id: 's', pages, documents: [] }
  session = createDocument(session, ['b'])
  session = createDocument(session, ['a'])
  return session
}
function result() {
  return {
    version: 1,
    provider: 'openai',
    requires_review: true,
    document_type: 'invoice',
    attributes: Object.fromEntries(
      ALL_FIELDS.filter((key) => key !== 'document_type').map((key) => [
        key,
        key === 'sender' ? 'Synthetic seller' : null,
      ]),
    ),
    evidence: {},
    warnings: [],
  }
}
test('AI sends only ordered photographs of the chosen document, with explicit consent and no OCR', async () => {
  const session = fixture(),
    id = session.documents[0].id
  await assert.rejects(analysisPayload(session, id, false), { code: 'consent_required' })
  delete session.pages[1].ocr
  const calls = []
  const options = {
    prepare: async (page) => {
      calls.push(page.id)
      return { image: 'data:image/jpeg;base64,U1lOVEhFVElD', bytes: 9 }
    },
  }
  assert.deepEqual(await analysisPayload(session, id, true, options), {
    consent: true,
    pages: [{ id: 'b', number: 1, image: 'data:image/jpeg;base64,U1lOVEhFVElD' }],
  })
  assert.deepEqual(calls, ['b'])
  await assert.rejects(
    analysisPayload(session, id, true, {
      prepare: async () => ({ image: 'x', bytes: 17_000_000 }),
    }),
    { code: 'input_too_large' },
  )
})
test('AI attachment preserves manual edits and confirmation; page/OCR changes make analysis stale', () => {
  let session = fixture(),
    id = session.documents[0].id
  session = editValue(session, id, 'sender', 'Manual seller')
  session = confirmDocument(session, id)
  const old = session.documents[0],
    source = sourceVersion(session, old)
  session = attachAiAnalysis(session, id, source, result())
  assert.deepEqual(session.documents[0].values, old.values)
  assert.deepEqual(session.documents[0].confirmation, old.confirmation)
  assert.equal(isConfirmationCurrent(session, session.documents[0]), true)
  assert.equal(session.documents[1].analysis, null)
  session = structuredClone(session)
  session.pages[1].ocr.editedText = 'Changed OCR'
  assert.equal(isAnalysisStale(session, session.documents[0]), true)
  assert.equal(isConfirmationCurrent(session, session.documents[0]), false)
  assert.throws(() => attachAiAnalysis(session, id, source, result()), { code: 'source_changed' })
})
test('offline and malformed responses fail safely without retries or raw upstream messages', async () => {
  let calls = 0
  const fetcher = async () => {
    calls++
    return {
      ok: false,
      json: async () => ({ error: { code: 'upstream_authentication', message: 'SECRET' } }),
    }
  }
  await assert.rejects(requestAiAnalysis({}, { online: false, fetcher }), { code: 'offline' })
  assert.equal(calls, 0)
  await assert.rejects(
    requestAiAnalysis({}, { fetcher }),
    (error) => error instanceof AiError && !error.message.includes('SECRET'),
  )
  assert.equal(calls, 1)
  await assert.rejects(
    requestAiAnalysis(
      {},
      { fetcher: async () => ({ ok: true, json: async () => ({ result: {} }) }) },
    ),
    { code: 'invalid_response' },
  )
  const response = await requestAiAnalysis(
    {},
    { fetcher: async () => ({ ok: true, json: async () => ({ result: result() }) }) },
  )
  assert.equal(response.provider, 'openai')
})
test('recognition rejects absent consent before OCR and awaits AI before saving', async () => {
  const session = {
    active: { value: fixture() },
    busy: { value: false },
    save: async () => events.push('save'),
    analyzeDocument: async (_, options) => {
      assert.equal(options.provider, 'openai')
      await Promise.resolve()
      events.push('analysis')
    },
  }
  const ocr = {
    running: { value: false },
    run: async () => {
      throw new Error('No OCR needed')
    },
  }
  const id = session.active.value.documents[0].id,
    events = []
  await assert.rejects(
    recognizeDocument(session, ocr, id, ['lav'], undefined, { provider: 'openai' }),
    { code: 'consent_required' },
  )
  await recognizeDocument(session, ocr, id, ['lav'], undefined, {
    provider: 'openai',
    consent: true,
  })
  assert.deepEqual(events, ['analysis', 'save'])
})
