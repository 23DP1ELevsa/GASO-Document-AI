import { OcrError, normalizeLanguages } from './model.js'

// The supervisor owns Tesseract's child worker. Terminating the supervisor also
// stops its child during createWorker(), before Tesseract exposes terminate().
export function createOcrService({
  workerFactory = () => new Worker(new URL('./ocr.worker.js', import.meta.url), { type: 'module' }),
  timeoutMs = 180_000,
  baseUrl = typeof document === 'undefined'
    ? ''
    : new URL(import.meta.env.BASE_URL, document.baseURI).href,
} = {}) {
  let worker = null,
    languageKey = '',
    pending = null,
    sequence = 0,
    idleTimer
  function terminate() {
    clearTimeout(idleTimer)
    if (worker) {
      worker.postMessage({ action: 'dispose' })
      worker.terminate()
    }
    worker = null
    languageKey = ''
  }
  function cancel() {
    const job = pending
    terminate()
    job?.finish(new OcrError('cancelled'))
  }
  async function recognize(image, languages, onProgress = () => {}) {
    if (pending) throw new OcrError('busy')
    const normalized = normalizeLanguages(languages)
    if (!(image instanceof Blob)) throw new OcrError('imageUnavailable')
    const key = normalized.join('+')
    clearTimeout(idleTimer)
    if (languageKey !== key) terminate()
    try {
      if (!worker) worker = workerFactory()
    } catch {
      throw new OcrError('initialization')
    }
    languageKey = key
    const currentWorker = worker
    return new Promise((resolve, reject) => {
      const id = ++sequence
      const timer = setTimeout(() => {
        terminate()
        finish(new OcrError('timeout'))
      }, timeoutMs)
      function finish(error, result) {
        if (pending?.id !== id) return
        clearTimeout(timer)
        pending = null
        if (error) {
          terminate()
          reject(error)
        } else {
          idleTimer = setTimeout(terminate, 60_000)
          resolve(result)
        }
      }
      pending = { id, finish }
      currentWorker.onmessage = ({ data }) => {
        if (pending?.id !== id || data.id !== id) return
        if (data.error) finish(new OcrError(data.error))
        else if (data.result) finish(null, data.result)
        else
          onProgress({
            phase: data.phase,
            progress: Math.round(Math.max(0, Math.min(1, Number(data.progress) || 0)) * 100),
          })
      }
      currentWorker.onerror = (event) => {
        event.preventDefault?.()
        finish(new OcrError('initialization'))
      }
      currentWorker.onmessageerror = () => finish(new OcrError('recognition'))
      try {
        currentWorker.postMessage({ id, image, languages: normalized, baseUrl })
      } catch {
        finish(new OcrError('recognition'))
      }
    })
  }
  return { recognize, cancel, dispose: cancel }
}
