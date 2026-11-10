import { processingKey } from '../processing/geometry.js'

export const OCR_LANGUAGES = ['lav', 'eng', 'rus']
export const OCR_ENGINE = 'tesseract.js'
export const OCR_VERSION = '7.0.0'
export const MODEL_VERSION = 'tessdata_fast:4.1.0'
export const MAX_TEXT_LENGTH = 250_000
export const OCR_RESOURCE_PATH = 'ocr/v7-fast-4-1-0'
export const OCR_CACHE = 'gaso-ocr-v7-fast-4-1-0'

export class OcrError extends Error {
  constructor(code) {
    super(code)
    this.name = 'OcrError'
    this.code = code
  }
}
export function normalizeLanguages(value) {
  if (!Array.isArray(value) || !value.length || value.some((lang) => !OCR_LANGUAGES.includes(lang)))
    throw new OcrError('languages')
  return OCR_LANGUAGES.filter((lang) => value.includes(lang))
}
export function imageVersion(page) {
  return `${page.id}:${processingKey(page.processing)}`
}
export function isOcrStale(page) {
  return Boolean(
    page.ocr && (page.ocr.pageId !== page.id || page.ocr.imageVersion !== imageVersion(page)),
  )
}
export function textForPage(page) {
  return page.ocr?.editedText ?? page.ocr?.originalText ?? ''
}
export function assertTextLength(text) {
  if (typeof text !== 'string' || text.length > MAX_TEXT_LENGTH) throw new OcrError('textTooLarge')
}
export function validateOcr(record) {
  if (!record) return
  assertTextLength(record.originalText)
  if (record.editedText !== null) assertTextLength(record.editedText)
  normalizeLanguages(record.languages)
}
export function makeOcrResult(page, languages, data, durationMs, recognizedAt = Date.now()) {
  const originalText = String(data.text ?? '')
  assertTextLength(originalText)
  return {
    schemaVersion: 1,
    pageId: page.id,
    imageVersion: imageVersion(page),
    languages: normalizeLanguages(languages),
    engine: OCR_ENGINE,
    engineVersion: OCR_VERSION,
    modelVersion: MODEL_VERSION,
    originalText,
    editedText: null,
    editedAt: null,
    confidence: Number.isFinite(data.confidence)
      ? Math.max(0, Math.min(100, data.confidence))
      : null,
    status: originalText.trim() ? 'success' : 'empty',
    recognizedAt,
    durationMs: Math.max(0, Math.round(durationMs)),
  }
}
export function ocrErrorCode(error) {
  if (error instanceof OcrError) return error.code
  const message = String(error?.message || error)
  if (/memory|alloc|out of bounds/i.test(message)) return 'memory'
  if (/traineddata|language/i.test(message)) return 'modelUnavailable'
  if (/wasm|webassembly|compile|instantiate|tesseractcore|importscripts/i.test(message))
    return 'initialization'
  if (/fetch|network|404/i.test(message)) return 'modelUnavailable'
  return 'recognition'
}
