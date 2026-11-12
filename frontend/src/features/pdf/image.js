import { PdfError, PDF_LIMITS } from './model.js'

// PDF JPEG embedding ignores EXIF. Decode/reorient those images before embedding.
export function jpegOrientation(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 2
  try {
    while (offset + 4 <= bytes.length && bytes[offset] === 255) {
      const marker = bytes[offset + 1],
        length = view.getUint16(offset + 2)
      if (length < 2 || offset + length + 2 > bytes.length) return 1
      const start = offset + 4
      if (
        marker === 225 &&
        view.getUint32(start) === 0x45786966 &&
        view.getUint16(start + 4) === 0
      ) {
        const tiff = start + 6,
          little = view.getUint16(tiff) === 0x4949
        if (view.getUint16(tiff + 2, little) !== 42) return 1
        const directory = tiff + view.getUint32(tiff + 4, little),
          count = view.getUint16(directory, little)
        for (let i = 0; i < count; i++) {
          const entry = directory + 2 + i * 12
          if (view.getUint16(entry, little) === 274) return view.getUint16(entry + 8, little)
        }
      }
      if (marker === 218 || marker === 217) break
      offset += length + 2
    }
  } catch {
    return 0
  } // Malformed metadata: force decoding, never assume upright.
  return 1
}
export function rasterSize(width, height, quality) {
  if (
    !Number.isFinite(width * height) ||
    width < 1 ||
    height < 1 ||
    width * height > 40_000_000 ||
    Math.max(width, height) > 16000
  )
    throw new PdfError('image')
  const pixels = quality === 'high' ? PDF_LIMITS.highPixels : PDF_LIMITS.optimizedPixels
  const side = quality === 'high' ? PDF_LIMITS.highSide : PDF_LIMITS.optimizedSide
  const scale = Math.min(1, side / Math.max(width, height), Math.sqrt(pixels / (width * height)))
  return {
    width: Math.max(1, Math.floor(width * scale)),
    height: Math.max(1, Math.floor(height * scale)),
    resized: scale < 1,
  }
}
function pngHasExif(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 8
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset)
    if (view.getUint32(offset + 4) === 0x65584966) return true // eXIf
    if (length > bytes.length - offset - 12) return true
    offset += length + 12
  }
  return false
}
export async function preparePdfImage(
  blob,
  page,
  options,
  {
    decode = globalThis.createImageBitmap,
    canvasFactory = (width, height) => new OffscreenCanvas(width, height),
  } = {},
) {
  if (!(blob instanceof Blob) || !blob.size || blob.size > PDF_LIMITS.inputImageBytes)
    throw new PdfError('imageLimit')
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(blob.type)) throw new PdfError('image')
  const width = page.processing ? page.processedWidth || page.width : page.width
  const height = page.processing ? page.processedHeight || page.height : page.height
  rasterSize(width, height, options.quality)
  let bitmap, canvas
  try {
    bitmap = await decode(blob, { imageOrientation: 'from-image' })
    // Derive the aspect ratio from the decoded image, including legacy processed images.
    const size = rasterSize(bitmap.width, bitmap.height, options.quality)
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const upright =
      blob.type === 'image/jpeg'
        ? jpegOrientation(bytes) === 1
        : blob.type !== 'image/png' || !pngHasExif(bytes)
    if (options.quality === 'high' && !size.resized && upright && blob.type !== 'image/webp')
      return {
        bytes,
        format: blob.type === 'image/png' ? 'png' : 'jpeg',
        width: bitmap.width,
        height: bitmap.height,
        resized: false,
      }
    canvas = canvasFactory(size.width, size.height)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new PdfError('image')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, size.width, size.height)
    ctx.drawImage(bitmap, 0, 0, size.width, size.height)
    const format = options.quality === 'optimized' ? 'jpeg' : 'png'
    const encoded = await canvas.convertToBlob({
      type: format === 'jpeg' ? 'image/jpeg' : 'image/png',
      quality: 0.85,
    })
    return {
      bytes: new Uint8Array(await encoded.arrayBuffer()),
      format,
      width: size.width,
      height: size.height,
      resized: size.resized,
    }
  } catch (error) {
    if (error instanceof PdfError) throw error
    throw new PdfError('image')
  } finally {
    bitmap?.close()
    if (canvas) {
      canvas.width = 0
      canvas.height = 0
    }
  }
}
