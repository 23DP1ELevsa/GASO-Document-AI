import { ScanError } from './errors'
import { newId } from './id'

export const IMAGE_LIMITS = Object.freeze({
  fileBytes: 25 * 1024 ** 2,
  pixels: 40_000_000,
  side: 16000,
  pages: 20,
  sessionBytes: 200 * 1024 ** 2,
  thumbnailSide: 480,
})

// Read dimensions before decoding a potentially large raster. Original bytes stay unchanged.
async function inspect(file) {
  if (!file.size || file.size > IMAGE_LIMITS.fileBytes) throw new ScanError('fileSize')
  let bytes
  try {
    bytes = new Uint8Array(await file.slice(0, 512 * 1024).arrayBuffer())
  } catch {
    throw new ScanError('decode')
  }
  const view = new DataView(bytes.buffer)
  let type, width, height
  if (
    bytes.length >= 24 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((value, i) => bytes[i] === value)
  ) {
    type = 'image/png'
    width = view.getUint32(16)
    height = view.getUint32(20)
  } else if (bytes[0] === 255 && bytes[1] === 216) {
    type = 'image/jpeg'
    let offset = 2
    while (offset + 4 <= bytes.length) {
      if (bytes[offset++] !== 255) break
      while (bytes[offset] === 255) offset++
      const marker = bytes[offset++]
      if (marker === 217 || marker === 218) break
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue
      if (offset + 2 > bytes.length) break
      const length = view.getUint16(offset)
      if (length < 2 || offset + length > bytes.length) break
      if (
        [192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker) &&
        length >= 8
      ) {
        height = view.getUint16(offset + 3)
        width = view.getUint16(offset + 5)
        break
      }
      offset += length
    }
  } else if (
    bytes.length >= 30 &&
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  ) {
    type = 'image/webp'
    const chunk = String.fromCharCode(...bytes.slice(12, 16))
    if (chunk === 'VP8X') {
      width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16)
      height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16)
    } else if (chunk === 'VP8L' && bytes[20] === 47) {
      width = 1 + bytes[21] + ((bytes[22] & 63) << 8)
      height = 1 + (bytes[22] >> 6) + (bytes[23] << 2) + ((bytes[24] & 15) << 10)
    } else if (chunk === 'VP8 ' && bytes[23] === 157 && bytes[24] === 1 && bytes[25] === 42) {
      width = view.getUint16(26, true) & 16383
      height = view.getUint16(28, true) & 16383
    }
  }
  if (
    !type ||
    (file.type && ![type, type === 'image/jpeg' ? 'image/jpg' : type].includes(file.type))
  )
    throw new ScanError('fileType')
  if (!width || !height) throw new ScanError('decode')
  if (width * height > IMAGE_LIMITS.pixels || Math.max(width, height) > IMAGE_LIMITS.side)
    throw new ScanError('dimensions')
  return type
}

async function decode(blob) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob, { imageOrientation: 'from-image' })
    } catch {
      /* Use the browser's EXIF-aware image decoder as a fallback. */
    }
  }
  const url = URL.createObjectURL(blob)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    return image
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function importImage(file) {
  const mime = await inspect(file)
  const original = file.slice(0, file.size, mime)
  let image
  const canvas = document.createElement('canvas')
  try {
    image = await decode(original)
    const width = image.naturalWidth || image.width
    const height = image.naturalHeight || image.height
    if (!width || !height || width * height > IMAGE_LIMITS.pixels) throw new ScanError('dimensions')
    const scale = Math.min(1, IMAGE_LIMITS.thumbnailSide / Math.max(width, height))
    canvas.width = Math.max(1, Math.round(width * scale))
    canvas.height = Math.max(1, Math.round(height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new ScanError('decode')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const thumbnail = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
    if (!thumbnail) throw new ScanError('decode')
    return {
      id: newId(),
      name: file.name || 'image',
      mime,
      size: original.size,
      width,
      height,
      thumbnailWidth: canvas.width,
      thumbnailHeight: canvas.height,
      thumbnail,
      original,
    }
  } catch (error) {
    if (error instanceof ScanError) throw error
    throw new ScanError('decode')
  } finally {
    image?.close?.()
    if (image instanceof HTMLImageElement) image.src = ''
    canvas.width = 0
    canvas.height = 0
  }
}
