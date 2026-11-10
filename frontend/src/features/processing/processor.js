import { ScanError } from '../scanning/errors'

export function processingJob(payload, onProgress = () => {}) {
  let worker,
    rejectJob,
    settled = false,
    timer
  const finish = () => {
    settled = true
    clearTimeout(timer)
    worker?.terminate()
  }
  const promise = new Promise((resolve, reject) => {
    rejectJob = reject
    try {
      worker = new Worker(new URL('./processing.worker.js', import.meta.url), { type: 'module' })
      timer = setTimeout(() => {
        if (!settled) {
          finish()
          reject(new ScanError('processingTimeout'))
        }
      }, 45000)
      worker.onmessage = ({ data }) => {
        if (settled) return
        if ('progress' in data) onProgress(data.progress)
        else {
          finish()
          if (data.error) reject(new ScanError(data.error))
          else resolve(data.result)
        }
      }
      worker.onerror = (event) => {
        event.preventDefault()
        if (!settled) {
          finish()
          reject(new ScanError('processingFailed'))
        }
      }
      worker.postMessage(payload)
    } catch {
      finish()
      reject(new ScanError('processingUnavailable'))
    }
  })
  return {
    promise,
    cancel() {
      if (!settled) {
        finish()
        rejectJob(new ScanError('cancelled'))
      }
    },
  }
}
