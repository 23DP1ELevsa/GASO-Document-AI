import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeLanguages,
  makeOcrResult,
  imageVersion,
  isOcrStale,
  textForPage,
  MAX_TEXT_LENGTH,
  ocrErrorCode,
} from '../src/features/ocr/model.js'
import { defaultProcessing } from '../src/features/processing/geometry.js'
import { createOcrService } from '../src/features/ocr/ocrService.js'
import { resolveOcrInput } from '../src/features/ocr/input.js'

const page = { id: 'page-1', width: 900, height: 1200 }
test('languages are validated, deduplicated and canonical; all three and mixed OCR are supported', () => {
  assert.deepEqual(normalizeLanguages(['rus', 'lav', 'lav', 'eng']), ['lav', 'eng', 'rus'])
  for (const value of [[], ['deu'], null, 'lav']) assert.throws(() => normalizeLanguages(value))
})
test('original and corrected text are independent, empty output is honest, size bounds do not truncate', () => {
  const result = makeOcrResult(page, ['lav'], { text: 'Rēķins', confidence: 87.3 }, 1234, 100)
  assert.equal(result.durationMs, 1234)
  assert.equal(result.recognizedAt, 100)
  assert.equal(result.status, 'success')
  const corrected = { ...result, editedText: 'Labots teksts' }
  assert.equal(textForPage({ ocr: corrected }), 'Labots teksts')
  assert.equal(corrected.originalText, 'Rēķins')
  assert.equal(textForPage({ ocr: { ...corrected, editedText: '' } }), '')
  assert.equal(makeOcrResult(page, ['eng'], { text: ' \n' }, 1).status, 'empty')
  assert.equal(makeOcrResult(page, ['rus'], { text: 'Текст' }, 1).confidence, null)
  assert.throws(() => makeOcrResult(page, ['eng'], { text: 'a'.repeat(MAX_TEXT_LENGTH + 1) }, 1), {
    code: 'textTooLarge',
  })
})
test('image provenance changes for perspective, filter, rotation or replacement, but not page order', () => {
  const ocr = makeOcrResult(page, ['lav'], { text: 'teksts' }, 1)
  assert.equal(isOcrStale({ ...page, ocr }), false)
  for (const processing of [
    { ...defaultProcessing(), rotation: 90 },
    { ...defaultProcessing(), filter: 'grayscale' },
    {
      ...defaultProcessing(),
      corners: [
        { x: 0.1, y: 0.1 },
        { x: 0.9, y: 0.1 },
        { x: 0.9, y: 0.9 },
        { x: 0.1, y: 0.9 },
      ],
    },
  ])
    assert.equal(isOcrStale({ ...page, processing, ocr }), true)
  assert.equal(isOcrStale({ ...page, id: 'replacement', ocr }), true)
  assert.equal(imageVersion({ ...page, position: 2 }), imageVersion(page))
})
test('OCR input uses processed full image; legacy processing is regenerated; thumbnails are never used', async () => {
  const original = new Blob(['original']),
    processed = new Blob(['processed']),
    thumbnail = new Blob(['thumb'])
  const unavailable = () => {
    throw new Error('Must not read storage')
  }
  assert.equal(
    await resolveOcrInput(
      { ...page, original, processed, thumbnail },
      { readImageRecord: unavailable },
    ),
    processed,
  )
  assert.equal(await resolveOcrInput({ ...page, original, thumbnail }, {}), original)
  assert.equal(
    await resolveOcrInput(page, { readImageRecord: async () => ({ blob: original, processed }) }),
    processed,
  )
  const processing = { ...defaultProcessing(), rotation: 90 }
  let payload
  assert.equal(
    await resolveOcrInput(
      { ...page, original, processing },
      {
        processingJob: (value) => {
          payload = value
          return { promise: Promise.resolve({ processed }), cancel() {} }
        },
      },
    ),
    processed,
  )
  assert.equal(payload.preview, false)
  assert.deepEqual(payload.parameters, processing)
})
test('cancellation stops fallback processing and errors remain actionable', async () => {
  const controller = new AbortController()
  let cancelled = false
  const promise = resolveOcrInput(
    { ...page, original: new Blob(['image']), processing: defaultProcessing() },
    {
      signal: controller.signal,
      processingJob: () => {
        let reject
        return {
          promise: new Promise((_, failure) => (reject = failure)),
          cancel() {
            cancelled = true
            reject({ code: 'cancelled' })
          },
        }
      },
    },
  )
  controller.abort()
  await assert.rejects(promise)
  assert.equal(cancelled, true)
  assert.equal(ocrErrorCode('Failed to fetch lav.traineddata'), 'modelUnavailable')
  assert.equal(ocrErrorCode('WebAssembly instantiate failed'), 'initialization')
  assert.equal(ocrErrorCode('Cannot allocate memory'), 'memory')
})
function workerHarness() {
  const workers = []
  const service = createOcrService({
    baseUrl: 'http://localhost/',
    timeoutMs: 1000,
    workerFactory: () => {
      const worker = {
        messages: [],
        terminated: false,
        postMessage(message) {
          this.messages.push(message)
        },
        terminate() {
          this.terminated = true
        },
      }
      workers.push(worker)
      return worker
    },
  })
  const result = (index, text = 'text') => {
    const worker = workers[index]
    worker.onmessage({ data: { id: worker.messages.findLast((m) => m.id).id, result: { text } } })
  }
  return { service, workers, result }
}
test('worker is reused, concurrent requests are rejected, language changes release previous models', async () => {
  const { service, workers, result } = workerHarness()
  const first = service.recognize(new Blob(['a']), ['lav'])
  await assert.rejects(service.recognize(new Blob(['b']), ['lav']), { code: 'busy' })
  result(0)
  await first
  const second = service.recognize(new Blob(['b']), ['lav'])
  result(0)
  await second
  assert.equal(workers.length, 1)
  const third = service.recognize(new Blob(['c']), ['eng', 'rus'])
  assert.equal(workers[0].terminated, true)
  result(1)
  await third
  service.dispose()
  assert.equal(workers[1].terminated, true)
})
test('initializing and active work can be cancelled; late results cannot complete a later job', async () => {
  const { service, workers, result } = workerHarness()
  const first = service.recognize(new Blob(['a']), ['lav'])
  service.cancel()
  await assert.rejects(first, { code: 'cancelled' })
  const second = service.recognize(new Blob(['b']), ['lav'])
  result(0, 'obsolete')
  result(1, 'current')
  assert.equal((await second).text, 'current')
  service.dispose()
  assert.equal(
    workers.every((worker) => worker.terminated),
    true,
  )
})
test('initialization failure and timeout release workers and allow retries', async () => {
  const { service, workers, result } = workerHarness()
  const first = service.recognize(new Blob(['a']), ['eng'])
  workers[0].onmessage({ data: { id: 1, error: 'modelUnavailable' } })
  await assert.rejects(first, { code: 'modelUnavailable' })
  assert.equal(workers[0].terminated, true)
  const second = service.recognize(new Blob(['b']), ['eng'])
  result(1)
  await second
  service.dispose()
  const timed = workerHarness()
  await assert.rejects(timed.service.recognize(new Blob(['a']), ['lav']), { code: 'timeout' })
  assert.equal(timed.workers[0].terminated, true)
})
