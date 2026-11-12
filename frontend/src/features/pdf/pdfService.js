import { PdfError, PDF_LIMITS } from './model.js'

export function createPdfService({
  readImage,
  workerFactory = () => new Worker(new URL('./pdf.worker.js', import.meta.url), { type: 'module' }),
  timeoutMs = 180_000,
} = {}) {
  let active = null
  function cancel() {
    active?.cancel()
  }
  async function generate(snapshot, onProgress = () => {}) {
    if (active) throw new PdfError('busy')
    let worker,
      timer,
      settled = false,
      rejectJob,
      requested = 0,
      reading = false
    const controller = new AbortController()
    const finish = () => {
      settled = true
      clearTimeout(timer)
      controller.abort()
      worker?.terminate()
      active = null
    }
    const fail = (error) => {
      if (!settled) {
        finish()
        rejectJob(error)
      }
    }
    const promise = new Promise((resolve, reject) => {
      rejectJob = reject
      active = { cancel: () => fail(new PdfError('cancelled')) }
      try {
        worker = workerFactory()
        timer = setTimeout(() => fail(new PdfError('timeout')), timeoutMs)
        worker.onerror = (event) => {
          event.preventDefault?.()
          fail(new PdfError('worker'))
        }
        worker.onmessage = async ({ data }) => {
          if (settled) return
          try {
            if (data.type === 'progress') onProgress(data.progress)
            else if (data.type === 'image') {
              if (reading || data.index !== requested || !snapshot.pages[data.index])
                throw new PdfError('generation')
              reading = true
              const blob = await readImage(snapshot.pages[data.index], {
                signal: controller.signal,
              })
              if (settled) return
              if (!(blob instanceof Blob) || !blob.size || blob.size > PDF_LIMITS.inputImageBytes)
                throw new PdfError('imageLimit')
              reading = false
              requested++
              worker.postMessage({ type: 'image', index: data.index, blob })
            } else if (data.type === 'error') fail(new PdfError(data.code))
            else if (data.type === 'result') {
              if (
                !(data.bytes instanceof ArrayBuffer) ||
                data.bytes.byteLength > PDF_LIMITS.outputBytes ||
                requested !== snapshot.pages.length
              )
                throw new PdfError('generation')
              finish()
              resolve({
                ...data,
                blob: new Blob([data.bytes], { type: 'application/pdf' }),
                bytes: undefined,
              })
            }
          } catch (error) {
            fail(error)
          }
        }
        worker.postMessage({ type: 'generate', snapshot })
      } catch {
        fail(new PdfError('worker'))
      }
    })
    return promise
  }
  return { generate, cancel, dispose: cancel }
}
