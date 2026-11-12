import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { PdfError, PDF_LIMITS, pdfOptions, scannedPageLayout } from './model.js'

const normalizeText = (text) =>
  String(text).normalize('NFC').replace(/\r\n?/g, '\n').replaceAll('\t', '    ')
const segmenter = new Intl.Segmenter('lv', { granularity: 'grapheme' })
export function wrapText(value, font, size, width) {
  const result = []
  for (const paragraph of normalizeText(value).split('\n')) {
    let line = ''
    for (const token of paragraph.split(/(\s+)/u).filter(Boolean)) {
      if (font.widthOfTextAtSize(line + token, size) <= width) {
        line += token
        continue
      }
      if (line.trim()) {
        result.push(line.trimEnd())
        line = ''
      }
      if (!token.trim()) continue
      for (const { segment } of segmenter.segment(token)) {
        if (line && font.widthOfTextAtSize(line + segment, size) > width) {
          result.push(line)
          line = ''
        }
        if (font.widthOfTextAtSize(segment, size) > width) throw new PdfError('textLayout')
        line += segment
      }
    }
    result.push(line.trimEnd())
  }
  return result
}
function checkCharacters(text, supported) {
  for (const character of normalizeText(text))
    if (character !== '\n' && !supported.has(character.codePointAt(0)))
      throw new PdfError('unsupportedCharacters')
}
async function informationPages(pdf, metadata, fontBytes) {
  if (!metadata.verified) throw new PdfError('confirmationRequired')
  if (!fontBytes?.length) throw new PdfError('font')
  const totalText = metadata.rows.map((row) => `${row.label}${row.value}`).join('') + metadata.title
  if (totalText.length > PDF_LIMITS.informationCharacters) throw new PdfError('limit')
  pdf.registerFontkit(fontkit)
  const font = await pdf.embedFont(fontBytes, { subset: true, features: { liga: false } })
  const supported = new Set(font.getCharacterSet())
  checkCharacters(totalText, supported)
  const ink = rgb(0.13, 0.18, 0.27),
    blue = rgb(0.14, 0.32, 0.65),
    border = rgb(0.84, 0.87, 0.91)
  const left = 42,
    right = 553.28,
    column = 211,
    padding = 10,
    size = 10,
    lineHeight = 15,
    bottom = 51
  let page, y
  function tableHeader() {
    page.drawText('Lietotāja pārbaudīta dokumenta informācija', {
      x: left,
      y,
      font,
      size: 9,
      color: ink,
    })
    y -= 29
    page.drawRectangle({
      x: left,
      y: y - 25,
      width: right - left,
      height: 25,
      color: rgb(0.92, 0.95, 0.99),
    })
    page.drawText('Lauks', { x: left + padding, y: y - 17, font, size, color: ink })
    page.drawText('Vērtība', { x: column + padding, y: y - 17, font, size, color: ink })
    y -= 25
  }
  function addPage(withTable = true) {
    if (pdf.getPageCount() >= PDF_LIMITS.pages) throw new PdfError('limit')
    page = pdf.addPage([595.28, 841.89])
    page.drawRectangle({ x: left, y: 792, width: right - left, height: 3, color: blue })
    page.drawText('DOKUMENTA INFORMĀCIJA', { x: left, y: 766, font, size: 12, color: blue })
    y = 742
    if (withTable) tableHeader()
    page.drawText(`GASO Document AI · Informācijas lapa ${pdf.getPageCount()}`, {
      x: left,
      y: 25,
      font,
      size: 8,
      color: ink,
    })
  }
  addPage(false)
  for (const line of wrapText(metadata.title, font, 18, right - left)) {
    if (y < bottom + 30) addPage(false)
    page.drawText(line, { x: left, y, font, size: 18, color: ink })
    y -= 25
  }
  y -= 15
  if (y < bottom + 100) addPage()
  else tableHeader()
  for (const row of metadata.rows) {
    const labels = wrapText(row.label, font, size, column - left - padding * 2)
    const values = wrapText(row.value, font, size, right - column - padding * 2)
    let offset = 0
    const count = Math.max(labels.length, values.length)
    const fullHeight = count * lineHeight + padding * 2
    if (fullHeight <= 600 && y - fullHeight < bottom) addPage()
    while (offset < count) {
      const capacity = Math.floor((y - bottom - padding * 2) / lineHeight)
      if (capacity < 1) {
        addPage()
        continue
      }
      const take = Math.min(capacity, count - offset),
        height = take * lineHeight + padding * 2
      page.drawRectangle({
        x: left,
        y: y - height,
        width: right - left,
        height,
        borderColor: border,
        borderWidth: 0.5,
      })
      page.drawLine({
        start: { x: column, y },
        end: { x: column, y: y - height },
        thickness: 0.5,
        color: border,
      })
      for (let i = 0; i < take; i++) {
        const baseline = y - padding - size - i * lineHeight
        if (labels[offset + i])
          page.drawText(labels[offset + i], {
            x: left + padding,
            y: baseline,
            font,
            size,
            color: ink,
          })
        if (values[offset + i])
          page.drawText(values[offset + i], {
            x: column + padding,
            y: baseline,
            font,
            size,
            color: ink,
          })
      }
      y -= height
      offset += take
      if (offset < count) addPage()
    }
  }
  return pdf.getPageCount()
}

// Pure generation core. The browser adapter supplies one full image at a time.
export async function generatePdf(
  snapshot,
  { readImage, prepareImage, fontBytes, onProgress = () => {}, signal } = {},
) {
  const options = pdfOptions(snapshot.options)
  if (!snapshot.pages.length) throw new PdfError('empty')
  if (
    snapshot.pages.length > PDF_LIMITS.scanPages ||
    new Set(snapshot.pages.map((page) => page.id)).size !== snapshot.pages.length
  )
    throw new PdfError('limit')
  const abort = () => {
    if (signal?.aborted) throw new PdfError('cancelled')
  }
  abort()
  onProgress({ phase: 'information', completed: 0, total: snapshot.pages.length })
  const pdf = await PDFDocument.create()
  pdf.setCreator('GASO Document AI')
  pdf.setProducer('GASO Document AI / pdf-lib')
  pdf.setLanguage('lv-LV')
  pdf.setTitle(snapshot.metadata.title)
  const informationPageCount = options.includeInformation
    ? await informationPages(pdf, snapshot.metadata, fontBytes)
    : 0
  let embeddedBytes = 0,
    resized = false
  for (let index = 0; index < snapshot.pages.length; index++) {
    abort()
    const source = snapshot.pages[index]
    onProgress({ phase: 'images', completed: index, total: snapshot.pages.length })
    const blob = await readImage(source, index)
    abort()
    const prepared = await prepareImage(blob, source, options)
    embeddedBytes += prepared.bytes.length
    resized ||= prepared.resized
    if (embeddedBytes > PDF_LIMITS.embeddedBytes || pdf.getPageCount() >= PDF_LIMITS.pages)
      throw new PdfError('limit')
    abort()
    let image
    try {
      image =
        prepared.format === 'jpeg'
          ? await pdf.embedJpg(prepared.bytes)
          : await pdf.embedPng(prepared.bytes)
    } catch {
      throw new PdfError('image')
    }
    const layout = scannedPageLayout(image.width, image.height, options.pageSize)
    const page = pdf.addPage([layout.pageWidth, layout.pageHeight])
    page.drawImage(image, { x: layout.x, y: layout.y, width: layout.width, height: layout.height })
    // Embed/compress each PNG before decoding the next raster, releasing its raw pixel buffers.
    await pdf.flush()
    onProgress({ phase: 'images', completed: index + 1, total: snapshot.pages.length })
  }
  abort()
  onProgress({ phase: 'saving', completed: snapshot.pages.length, total: snapshot.pages.length })
  const bytes = await pdf.save({ objectsPerTick: 20 })
  abort()
  if (bytes.byteLength > PDF_LIMITS.outputBytes) throw new PdfError('limit')
  return {
    bytes,
    pageCount: pdf.getPageCount(),
    informationPageCount,
    scanPageCount: snapshot.pages.length,
    resized,
  }
}
