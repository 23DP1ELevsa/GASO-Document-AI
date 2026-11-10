import {
  LIMITS,
  defaultProcessing,
  normalizeProcessing,
  outputSize,
  isIdentity,
  warpPixels,
} from './geometry.js'
import { filterPixels } from './filters.js'
import { detectDocument } from './detectDocument.js'

let bitmap = null,
  canvas = null,
  resultCanvas = null
const progress = (value) => self.postMessage({ progress: Math.round(value) })
function makeCanvas(width, height) {
  const value = new OffscreenCanvas(width, height)
  if (!value.getContext('2d')) throw new Error('processingUnavailable')
  return value
}
function draw(image, width, height) {
  const value = makeCanvas(width, height),
    ctx = value.getContext('2d', { willReadFrequently: true })
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(image, 0, 0, width, height)
  return value
}
async function thumbnail(image) {
  const scale = Math.min(1, 480 / Math.max(image.width, image.height)),
    width = Math.max(1, Math.round(image.width * scale)),
    height = Math.max(1, Math.round(image.height * scale))
  const small = draw(image, width, height)
  try {
    return {
      thumbnail: await small.convertToBlob({ type: 'image/jpeg', quality: 0.88 }),
      thumbnailWidth: width,
      thumbnailHeight: height,
    }
  } finally {
    small.width = 0
    small.height = 0
  }
}
self.onmessage = async ({ data: job }) => {
  try {
    if (typeof OffscreenCanvas !== 'function' || typeof createImageBitmap !== 'function')
      throw new Error('processingUnavailable')
    const { original, width, height, action } = job
    if (
      !(original instanceof Blob) ||
      !Number.isFinite(width * height) ||
      width < 1 ||
      height < 1 ||
      width * height > 40_000_000 ||
      Math.max(width, height) > 16000
    )
      throw new Error('dimensions')
    progress(3)
    const limit =
      action === 'render' && !job.preview
        ? LIMITS.sourceSide
        : action === 'detect'
          ? LIMITS.analysisSide
          : 1600
    const scale = Math.min(
      1,
      limit / Math.max(width, height),
      Math.sqrt(LIMITS.sourcePixels / (width * height)),
    )
    bitmap = await createImageBitmap(original, {
      imageOrientation: 'from-image',
      resizeWidth: Math.max(1, Math.floor(width * scale)),
      resizeHeight: Math.max(1, Math.floor(height * scale)),
      resizeQuality: 'high',
    })
    progress(12)
    canvas = draw(bitmap, bitmap.width, bitmap.height)
    bitmap.close()
    bitmap = null
    if (action === 'inspect' || action === 'detect') {
      let detection = null
      if (job.detect || action === 'detect') {
        const analysisScale = Math.min(
            1,
            LIMITS.analysisSide / Math.max(canvas.width, canvas.height),
          ),
          small = draw(
            canvas,
            Math.max(1, Math.round(canvas.width * analysisScale)),
            Math.max(1, Math.round(canvas.height * analysisScale)),
          )
        try {
          const image = small.getContext('2d').getImageData(0, 0, small.width, small.height)
          detection = detectDocument(image.data, small.width, small.height)
        } finally {
          small.width = 0
          small.height = 0
        }
      }
      progress(85)
      self.postMessage({
        result: {
          display:
            action === 'inspect'
              ? await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.94 })
              : null,
          detection,
        },
      })
      return
    }
    if (action !== 'render') throw new Error('processingFailed')
    const parameters = normalizeProcessing(job.parameters || defaultProcessing())
    if (isIdentity(parameters)) {
      self.postMessage({
        result: {
          processed: job.preview
            ? await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.94 })
            : null,
          processedWidth: width,
          processedHeight: height,
          processing: null,
          limited: false,
          ...(await thumbnail(canvas)),
        },
      })
      return
    }
    const natural = outputSize(parameters.corners, width, height)
    const output = outputSize(
      parameters.corners,
      canvas.width,
      canvas.height,
      job.preview ? LIMITS.previewSide ** 2 : LIMITS.outputPixels,
      job.preview ? LIMITS.previewSide : LIMITS.outputSide,
    )
    const swap = parameters.rotation % 180 !== 0,
      outWidth = swap ? output.height : output.width,
      outHeight = swap ? output.width : output.height
    const source = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height)
    const pixels = warpPixels(
      source.data,
      canvas.width,
      canvas.height,
      parameters,
      outWidth,
      outHeight,
      (fraction) => progress(15 + fraction * 50),
    )
    canvas.width = 0
    canvas.height = 0
    progress(68)
    filterPixels(pixels, outWidth, outHeight, parameters.filter)
    progress(82)
    resultCanvas = makeCanvas(outWidth, outHeight)
    resultCanvas.getContext('2d').putImageData(new ImageData(pixels, outWidth, outHeight), 0, 0)
    const processed = await resultCanvas.convertToBlob({
      type: job.preview ? 'image/jpeg' : 'image/png',
      quality: 0.94,
    })
    if (processed.size > LIMITS.resultBytes) throw new Error('resultTooLarge')
    progress(96)
    self.postMessage({
      result: {
        processed,
        processing: parameters,
        processedWidth: outWidth,
        processedHeight: outHeight,
        limited:
          natural.limited ||
          width * height > LIMITS.sourcePixels ||
          (output.limited && !job.preview),
        ...(await thumbnail(resultCanvas)),
      },
    })
  } catch (error) {
    const allowed = ['invalidQuad', 'dimensions', 'processingUnavailable', 'resultTooLarge']
    self.postMessage({
      error: allowed.includes(error.message) ? error.message : 'processingFailed',
    })
  } finally {
    bitmap?.close()
    if (canvas) {
      canvas.width = 0
      canvas.height = 0
    }
    if (resultCanvas) {
      resultCanvas.width = 0
      resultCanvas.height = 0
    }
  }
}
