import { createWorker, OEM, PSM } from 'tesseract.js'
import { OCR_RESOURCE_PATH, normalizeLanguages, ocrErrorCode } from './model.js'

let engine = null
let activeId = null
const progress = (phase, value) => self.postMessage({ id: activeId, phase, progress: value })
self.onmessage = async ({ data: job }) => {
  if (job.action === 'dispose') {
    await engine?.terminate()
    self.close()
    return
  }
  activeId = job.id
  try {
    if (!(job.image instanceof Blob)) throw new Error('Invalid OCR image')
    if (!engine) {
      const base = new URL(`${OCR_RESOURCE_PATH}/`, job.baseUrl).href
      engine = await createWorker(normalizeLanguages(job.languages), OEM.LSTM_ONLY, {
        workerPath: `${base}worker.min.js`,
        corePath: `${base}core`,
        langPath: `${base}lang`,
        workerBlobURL: false,
        gzip: false,
        cachePath: 'gaso-tessdata-fast-4.1.0',
        cacheMethod: 'write',
        logger: (message) =>
          progress(
            message.status === 'recognizing text' ? 'recognizing' : 'initializing',
            message.progress,
          ),
        errorHandler: (error) => self.postMessage({ id: activeId, error: ocrErrorCode(error) }),
      })
      await engine.setParameters({ tessedit_pageseg_mode: PSM.AUTO })
    }
    progress('recognizing', 0)
    const { data } = await engine.recognize(job.image, {}, { text: true })
    self.postMessage({ id: job.id, result: { text: data.text, confidence: data.confidence } })
  } catch (error) {
    self.postMessage({ id: job.id, error: ocrErrorCode(error) })
    await engine?.terminate()
    engine = null
  }
}
