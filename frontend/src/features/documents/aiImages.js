import { readImageRecord } from '../scanning/draftRepository.js'
import { resolveDocumentImage } from '../processing/imageSource.js'
export const AI_IMAGE_LIMITS = Object.freeze({
  pages: 20,
  imageBytes: 4_000_000,
  totalBytes: 16_000_000,
  bodyBytes: 22_000_000,
  side: 2800,
  pixels: 8_000_000,
})
export function abortAnalysis(signal) {
  signal?.throwIfAborted()
}
export async function prepareAiImage(page, { signal, read = readImageRecord } = {}) {
  abortAnalysis(signal)
  const { processingJob } = await import('../processing/processor.js')
  const blob = await resolveDocumentImage(page, { readImageRecord: read, processingJob, signal })
  if (!(blob instanceof Blob) || !blob.size || blob.size > 48 * 1024 ** 2)
    throw new Error('Invalid image')
  const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' })
  try {
    abortAnalysis(signal)
    if (bitmap.width * bitmap.height > 40_000_000) throw new Error('Image too large')
    const scale = Math.min(
      1,
      AI_IMAGE_LIMITS.side / Math.max(bitmap.width, bitmap.height),
      Math.sqrt(AI_IMAGE_LIMITS.pixels / (bitmap.width * bitmap.height)),
    )
    const canvas = new OffscreenCanvas(
      Math.max(1, Math.round(bitmap.width * scale)),
      Math.max(1, Math.round(bitmap.height * scale)),
    )
    const context = canvas.getContext('2d')
    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const prepared = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 })
    abortAnalysis(signal)
    if (prepared.size > AI_IMAGE_LIMITS.imageBytes) throw new Error('Image too large')
    const bytes = new Uint8Array(await prepared.arrayBuffer())
    let binary = ''
    for (let i = 0; i < bytes.length; i += 32768)
      binary += String.fromCharCode(...bytes.subarray(i, i + 32768))
    return { image: 'data:image/jpeg;base64,' + btoa(binary), bytes: bytes.length }
  } finally {
    bitmap.close()
  }
}
