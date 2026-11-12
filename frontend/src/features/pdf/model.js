import {
  documentExportPlan,
  documentPages,
  sourceVersion,
  validateDocuments,
} from '../documents/model.js'
import grouping from '../../locales/grouping.lv.js'

export class PdfError extends Error {
  constructor(code) {
    super(code)
    this.name = 'PdfError'
    this.code = code
  }
}
export const PDF_LIMITS = Object.freeze({
  scanPages: 20,
  pages: 128,
  informationCharacters: 250_000,
  inputImageBytes: 48 * 1024 ** 2,
  embeddedBytes: 64 * 1024 ** 2,
  outputBytes: 80 * 1024 ** 2,
  highPixels: 16_000_000,
  highSide: 6000,
  optimizedPixels: 4_000_000,
  optimizedSide: 2400,
})
export const DEFAULT_PDF_OPTIONS = Object.freeze({
  includeInformation: true,
  pageSize: 'a4',
  quality: 'high',
})
export function pdfOptions(options = {}) {
  const result = { ...DEFAULT_PDF_OPTIONS, ...options }
  if (
    typeof result.includeInformation !== 'boolean' ||
    !['a4', 'image'].includes(result.pageSize) ||
    !['high', 'optimized'].includes(result.quality)
  )
    throw new PdfError('options')
  return result
}
export function safeFilename(value, fallback = 'Dokuments') {
  const clean = (text) =>
    [
      ...String(text)
        .trim()
        .normalize('NFC')
        .replace(/[āčēģīķļņšūžĀČĒĢĪĶĻŅŠŪŽ]/g, (letter) =>
          letter.normalize('NFD').replace(/\p{M}/gu, ''),
        )
        .replace(
          /[<>:"/\\|?*\u0000-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,
          '_',
        )
        .replace(/\s+/g, '_')
        .replace(/^[. ]+|[. ]+$/g, '')
        .replace(/\.pdf$/i, ''),
    ]
      .slice(0, 110)
      .join('')
  let name = clean(value) || clean(fallback) || 'Dokuments'
  if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) name = `Dokuments_${name}`
  return `${name}.pdf`
}
export function exportSignature(session, document) {
  return JSON.stringify([
    sourceVersion(session, document),
    document.values,
    document.customFields,
    document.confirmation,
  ])
}
export function createExportSnapshot(session, documentId, rawOptions = {}) {
  validateDocuments(session)
  const document = session.documents.find((item) => item.id === documentId)
  if (!document) throw new PdfError('missingDocument')
  if (!document.pageIds.length) throw new PdfError('empty')
  if (document.pageIds.length > PDF_LIMITS.scanPages) throw new PdfError('limit')
  const options = pdfOptions(rawOptions),
    plan = documentExportPlan(session, documentId)
  if (options.includeInformation && !plan.confirmed) throw new PdfError('confirmationRequired')
  const values = plan.confirmed ? plan.information : {}
  const fallback = `Dokuments_${documentId}`
  const type = grouping.types[values.document_type] || 'Dokuments'
  const filenameTypes = {
    invoice: 'Rekins',
    contract: 'Ligums',
    application: 'Iesniegums',
    insurance_document: 'Apdrosinasanas_dokuments',
    delivery_note: 'Pavadzime',
  }
  const identifier = values.document_number || values.document_title || values.issue_date
  const filename = safeFilename(
    identifier ? `${filenameTypes[values.document_type] || 'Dokuments'}_${identifier}` : fallback,
    fallback,
  )
  const keys = [
    ...new Set([
      'document_title',
      'document_type',
      'document_number',
      'sender',
      'recipient',
      'issue_date',
      ...Object.keys(values),
    ]),
  ]
  const customLabels = new Map(plan.customFields.map((field) => [field.key, field.label]))
  const rows = options.includeInformation
    ? keys
        .filter(
          (key) =>
            [
              'document_title',
              'document_type',
              'document_number',
              'sender',
              'recipient',
              'issue_date',
            ].includes(key) ||
            (values[key] !== null && values[key] !== undefined && values[key] !== ''),
        )
        .map((key) => ({
          key,
          label: customLabels.get(key) || grouping.fields[key] || key,
          value: key === 'document_type' ? type : (values[key] ?? '—'),
        }))
    : []
  return {
    sessionId: session.id,
    revision: session.revision,
    documentId,
    signature: exportSignature(session, document),
    options,
    metadata: { title: values.document_title || type, filename, verified: plan.confirmed, rows },
    pages: documentPages(session, document).map(
      ({ id, width, height, processing, processedWidth, processedHeight }) => ({
        id,
        width,
        height,
        processing,
        processedWidth,
        processedHeight,
      }),
    ),
  }
}
export function scannedPageLayout(width, height, mode) {
  if (!Number.isFinite(width * height) || width < 1 || height < 1) throw new PdfError('image')
  const portrait = [595.28, 841.89],
    landscape = [841.89, 595.28]
  if (mode === 'image') {
    const scale = Math.min(595.28 / Math.min(width, height), 1440 / Math.max(width, height))
    return {
      pageWidth: width * scale,
      pageHeight: height * scale,
      x: 0,
      y: 0,
      width: width * scale,
      height: height * scale,
    }
  }
  const [pageWidth, pageHeight] = width > height ? landscape : portrait
  const scale = Math.min((pageWidth - 36) / width, (pageHeight - 36) / height)
  return {
    pageWidth,
    pageHeight,
    x: (pageWidth - width * scale) / 2,
    y: (pageHeight - height * scale) / 2,
    width: width * scale,
    height: height * scale,
  }
}
export function pdfErrorCode(error) {
  if (error instanceof PdfError) return error.code
  if (/memory|alloc|out of bounds/i.test(String(error?.message))) return 'memory'
  return 'generation'
}
