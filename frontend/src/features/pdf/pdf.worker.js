import fontUrl from '../../assets/fonts/NotoSans-Regular.ttf?url'
import { generatePdf } from './generator.js'
import { preparePdfImage } from './image.js'
import { PdfError, pdfErrorCode } from './model.js'

let imageRequest = null,
  running = false
self.onmessage = async ({ data }) => {
  if (data.type === 'image') {
    if (imageRequest && imageRequest.index === data.index) {
      imageRequest.resolve(data.blob)
      imageRequest = null
    }
    return
  }
  if (data.type !== 'generate' || running) return
  running = true
  try {
    let fontBytes
    if (data.snapshot.options.includeInformation) {
      try {
        const response = await fetch(fontUrl)
        if (!response.ok) throw new Error('font')
        fontBytes = new Uint8Array(await response.arrayBuffer())
      } catch {
        throw new PdfError('font')
      }
    }
    const result = await generatePdf(data.snapshot, {
      fontBytes,
      prepareImage: preparePdfImage,
      readImage: (_page, index) =>
        new Promise((resolve) => {
          imageRequest = { index, resolve }
          self.postMessage({ type: 'image', index })
        }),
      onProgress: (progress) => self.postMessage({ type: 'progress', progress }),
    })
    self.postMessage({ type: 'result', ...result, bytes: result.bytes.buffer }, [
      result.bytes.buffer,
    ])
  } catch (error) {
    self.postMessage({ type: 'error', code: pdfErrorCode(error) })
  }
}
