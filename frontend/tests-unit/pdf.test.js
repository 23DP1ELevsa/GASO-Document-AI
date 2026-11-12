import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import sharp from 'sharp'
import { generatePdf } from '../src/features/pdf/generator.js'
import {
  createExportSnapshot,
  PdfError,
  safeFilename,
  scannedPageLayout,
  pdfOptions,
  PDF_LIMITS,
} from '../src/features/pdf/model.js'
import { prepareExport, verifyExport } from '../src/features/pdf/snapshot.js'
import { preparePdfImage, rasterSize, jpegOrientation } from '../src/features/pdf/image.js'
import { createPdfService } from '../src/features/pdf/pdfService.js'
import {
  migrateGrouping,
  createDocument,
  editValue,
  addCustomField,
  confirmDocument,
} from '../src/features/documents/model.js'
import { readPdf } from '../test-support/readPdf.js'

const fontBytes = new Uint8Array(
  await readFile(new URL('../src/assets/fonts/NotoSans-Regular.ttf', import.meta.url)),
)
const image = async (color, width = 60, height = 90, format = 'png') =>
  new Uint8Array(
    await sharp({ create: { width, height, channels: 3, background: color } })
      [format]()
      .toBuffer(),
  )
function session() {
  let s = migrateGrouping({
    id: 'session',
    revision: 1,
    createdAt: 1,
    pages: [
      { id: 'a', width: 60, height: 90 },
      { id: 'b', width: 120, height: 70 },
    ],
  })
  s = createDocument(s, ['b', 'a'], 'Sintētisks rēķins ĀČĒĢĪĶĻŅŠŪŽ')
  const id = s.documents[0].id
  s = editValue(s, id, 'document_type', 'invoice')
  s = editValue(s, id, 'document_number', 'SYN-001')
  s = editValue(s, id, 'sender', 'Тестовый отправитель')
  s = confirmDocument(s, id)
  return s
}
async function generate(snapshot, images, overrides = {}) {
  return generatePdf(snapshot, {
    fontBytes,
    readImage: async (page) => images[page.id],
    prepareImage: async (bytes) => ({ bytes, format: 'png' }),
    ...overrides,
  })
}

test('PDF options and filenames are bounded, Unicode-safe and reject invalid settings and reserved Windows names', () => {
  assert.throws(() => pdfOptions({ quality: 'bad' }), { code: 'options' })
  assert.throws(() => pdfOptions({ includeInformation: 'yes' }), { code: 'options' })
  assert.equal(safeFilename('Rēķins INV/001:*?'), 'Rekins_INV_001___.pdf')
  assert.equal(safeFilename('CON'), 'Dokuments_CON.pdf')
  assert.equal(safeFilename('  ..Тестовый документ.pdf  '), 'Тестовый_документ.pdf')
  assert.equal(safeFilename(''), 'Dokuments.pdf')
  assert.ok([...safeFilename('a'.repeat(300))].length <= 114)
  assert.doesNotMatch(safeFilename('../evil\u202e/name'), /[\\/\u202e]/)
})
test('an export snapshot contains only its group and current confirmed values; automatic suggestions never enter PDF rows', () => {
  let s = session(),
    id = s.documents[0].id
  s = createDocument(s, ['a'], 'Other')
  assert.throws(() => createExportSnapshot(s, id), { code: 'confirmationRequired' })
  const onlyScans = createExportSnapshot(s, id, { includeInformation: false })
  assert.deepEqual(
    onlyScans.pages.map((page) => page.id),
    ['b'],
  )
  assert.deepEqual(onlyScans.metadata.rows, [])
  assert.match(onlyScans.metadata.filename, /^Dokuments_/)
  s = confirmDocument(s, id)
  s.documents[0].analysis = {
    result: { attributes: { total_amount: '999999.99', sender: 'Wrong suggestion' } },
  }
  const snapshot = createExportSnapshot(s, id)
  assert.equal(snapshot.metadata.filename, 'Rekins_SYN-001.pdf')
  assert.equal(
    snapshot.metadata.rows.find((row) => row.key === 'sender').value,
    'Тестовый отправитель',
  )
  assert.equal(
    snapshot.metadata.rows.some((row) => row.value === '999999.99'),
    false,
  )
  assert.equal(
    snapshot.pages.some((page) => 'thumbnail' in page),
    false,
  )
})
test('A4 portrait/landscape and image-sized pages center scans without changing their aspect ratio', () => {
  for (const [width, height] of [
    [600, 900],
    [900, 600],
    [100, 2000],
  ]) {
    for (const mode of ['a4', 'image']) {
      const layout = scannedPageLayout(width, height, mode)
      assert.ok(Math.abs(layout.width / layout.height - width / height) < 1e-10)
      assert.ok(layout.x >= 0 && layout.y >= 0)
      assert.ok(layout.width + layout.x <= layout.pageWidth + 1e-8)
      assert.equal(layout.pageWidth > layout.pageHeight, width > height)
    }
  }
  assert.throws(() => scannedPageLayout(0, 5, 'a4'), { code: 'image' })
})
test('one-page and multiple-page scan-only PDFs preserve order, pixels, orientation and omit information text', async () => {
  const s = session(),
    id = s.documents[0].id
  const images = { a: await image('#ff0000'), b: await image('#0000ff', 120, 70) }
  for (const ids of [['a'], ['b', 'a']]) {
    const clone = structuredClone(s)
    clone.documents[0].pageIds = ids
    const snapshot = createExportSnapshot(clone, id, { includeInformation: false })
    const result = await generate(snapshot, images)
    const parsed = await readPdf(result.bytes)
    assert.equal(parsed.pageCount, ids.length)
    assert.equal(result.informationPageCount, 0)
    assert.ok(parsed.pages.every((page) => page.text === ''))
    assert.equal(parsed.pages[0].images[0].width, ids[0] === 'a' ? 60 : 120)
    assert.deepEqual(
      parsed.pages[0].images[0].sample.slice(0, 3),
      ids[0] === 'a' ? [255, 0, 0] : [0, 0, 255],
    )
  }
})
test('information text is real extractable PDF text with Latvian diacritics and Cyrillic, before the ordered scan images', async () => {
  const s = session(),
    snapshot = createExportSnapshot(s, s.documents[0].id)
  const before = JSON.stringify(s)
  const result = await generate(snapshot, {
    a: await image('#ff0000'),
    b: await image('#0000ff', 120, 70),
  })
  const parsed = await readPdf(result.bytes)
  assert.equal(parsed.pageCount, 3)
  assert.equal(result.informationPageCount, 1)
  assert.match(parsed.pages[0].text, /ĀČĒĢĪĶĻŅŠŪŽ/)
  assert.match(parsed.pages[0].text, /Тестовый отправитель/)
  assert.match(parsed.pages[0].text, /SYN-001/)
  assert.equal(parsed.pages[0].images.length, 0)
  assert.equal(parsed.pages[1].images[0].width, 120)
  assert.equal(parsed.pages[2].images[0].width, 60)
  assert.equal(JSON.stringify(s), before)
})
test('many attributes, multi-page titles and unbroken long values flow onto continuation pages with no clipped text', async () => {
  let s = session(),
    id = s.documents[0].id
  const longTitle = 'Garš virsraksts '.repeat(110)
  s = editValue(s, id, 'document_title', longTitle)
  for (let index = 0; index < 40; index++)
    s = addCustomField(
      s,
      id,
      `Papildu lauks ${index}`,
      `Sākums${index} ${'garšteksts'.repeat(60)} Beigas${index}`,
    )
  s = confirmDocument(s, id)
  const snapshot = createExportSnapshot(s, id)
  const result = await generate(snapshot, {
    a: await image('#ff0000'),
    b: await image('#0000ff', 120, 70),
  })
  const parsed = await readPdf(result.bytes)
  assert.ok(result.informationPageCount > 2)
  const text = parsed.pages
    .map((page) => page.text)
    .join(' ')
    .replace(/\s/g, '')
  for (let index = 0; index < 40; index++) {
    assert.ok(text.includes(`Sākums${index}`))
    assert.ok(text.includes(`Beigas${index}`))
  }
  for (const page of parsed.pages)
    for (const item of page.textItems) {
      assert.ok(
        item.x >= 41 && item.x + item.width <= page.width - 40 + 1,
        `${item.text}: horizontal overflow`,
      )
      assert.ok(
        item.y >= 20 && item.y + item.height < page.height - 20,
        `${item.text}: vertical overflow`,
      )
    }
})
test('missing fonts, unsupported symbols and excessive text produce explicit errors without a partial PDF', async () => {
  let s = session(),
    id = s.documents[0].id
  const images = { a: await image('#fff'), b: await image('#fff') }
  await assert.rejects(generate(createExportSnapshot(s, id), images, { fontBytes: null }), {
    code: 'font',
  })
  s = editValue(s, id, 'sender', 'Text 😀')
  s = confirmDocument(s, id)
  await assert.rejects(generate(createExportSnapshot(s, id), images), {
    code: 'unsupportedCharacters',
  })
  const snapshot = createExportSnapshot(s, id)
  snapshot.metadata.rows = [
    { label: 'Long', value: 'x'.repeat(PDF_LIMITS.informationCharacters + 1) },
  ]
  await assert.rejects(generate(snapshot, images), { code: 'limit' })
})
test('images are read sequentially, errors abort generation and cancellation rejects before loading more pages', async () => {
  const s = session(),
    snapshot = createExportSnapshot(s, s.documents[0].id, { includeInformation: false })
  const order = [],
    bytes = await image('#fff')
  const controller = new AbortController()
  await assert.rejects(
    generate(
      snapshot,
      {},
      {
        signal: controller.signal,
        readImage: async (page) => {
          order.push(page.id)
          controller.abort()
          return bytes
        },
      },
    ),
    { code: 'cancelled' },
  )
  assert.deepEqual(order, ['b'])
  await assert.rejects(
    generate(
      snapshot,
      {},
      {
        readImage: async () => {
          throw new PdfError('image')
        },
      },
    ),
    { code: 'image' },
  )
  await assert.rejects(generate(snapshot, {}, { readImage: async () => new Uint8Array([0]) }), {
    code: 'image',
  })
})
test('export preparation saves dirty sessions, uses persisted data and stops on save failure or cross-tab revision changes', async () => {
  const original = session(),
    id = original.documents[0].id
  const controller = {
    active: { value: original },
    dirty: { value: true },
    busy: { value: false },
    async save() {
      this.active.value = { ...this.active.value, revision: 2 }
      this.dirty.value = false
    },
  }
  const prepared = await prepareExport(controller, id, {}, async () =>
    structuredClone(controller.active.value),
  )
  assert.equal(prepared.revision, 2)
  await verifyExport(controller, prepared, async () => structuredClone(controller.active.value))
  await assert.rejects(
    verifyExport(controller, prepared, async () => ({ ...controller.active.value, revision: 3 })),
    { code: 'sourceChanged' },
  )
  controller.dirty.value = true
  controller.save = async () => {
    throw new Error('quota')
  }
  let loaded = false
  await assert.rejects(
    prepareExport(controller, id, {}, async () => {
      loaded = true
    }),
    /quota/,
  )
  assert.equal(loaded, false)
})
test('source verification rejects changes while a saved revision check is awaiting IndexedDB', async () => {
  const s = session(),
    controller = { active: { value: s }, dirty: { value: false } },
    snapshot = createExportSnapshot(s, s.documents[0].id)
  await assert.rejects(
    verifyExport(controller, snapshot, async () => {
      controller.active.value = { ...s }
      return s
    }),
    { code: 'sourceChanged' },
  )
})
test('image quality keeps high-quality JPEG bytes and always closes decoded bitmaps, including on conversion failure', async () => {
  const bytes = await image('#fff', 100, 200, 'jpeg'),
    blob = new Blob([bytes], { type: 'image/jpeg' })
  let closed = 0,
    conversions = 0
  const deps = {
    decode: async () => ({
      width: 100,
      height: 200,
      close() {
        closed++
      },
    }),
    canvasFactory: () => {
      conversions++
      throw new Error('Must not convert')
    },
  }
  const high = await preparePdfImage(blob, { width: 100, height: 200 }, { quality: 'high' }, deps)
  assert.deepEqual(high.bytes, bytes)
  assert.equal(high.format, 'jpeg')
  assert.equal(conversions, 0)
  await assert.rejects(
    preparePdfImage(blob, { width: 100, height: 200 }, { quality: 'optimized' }, deps),
    { code: 'image' },
  )
  assert.equal(closed, 2)
  const rotated = await sharp(bytes).withMetadata({ orientation: 6 }).jpeg().toBuffer()
  assert.equal(jpegOrientation(rotated), 6)
  assert.ok(rasterSize(6000, 6000, 'high').width ** 2 <= PDF_LIMITS.highPixels)
  assert.ok(rasterSize(6000, 6000, 'optimized').width ** 2 <= PDF_LIMITS.optimizedPixels)
})
function workerHarness() {
  const workers = []
  const service = createPdfService({
    timeoutMs: 40,
    readImage: async () => new Blob(['image']),
    workerFactory() {
      const worker = {
        messages: [],
        postMessage(value) {
          this.messages.push(value)
        },
        terminate() {
          this.terminated = true
        },
      }
      workers.push(worker)
      return worker
    },
  })
  return { service, workers }
}
test('PDF workers reject concurrent work, terminate on cancellation/error/timeout and ignore late messages', async () => {
  const { service, workers } = workerHarness(),
    snapshot = { pages: [{ id: 'a' }] }
  const first = service.generate(snapshot)
  await assert.rejects(service.generate(snapshot), { code: 'busy' })
  service.cancel()
  await assert.rejects(first, { code: 'cancelled' })
  assert.equal(workers[0].terminated, true)
  const second = service.generate(snapshot)
  workers[0].onmessage({ data: { type: 'error', code: 'image' } })
  workers[1].onmessage({ data: { type: 'error', code: 'font' } })
  await assert.rejects(second, { code: 'font' })
  const timed = service.generate(snapshot)
  await assert.rejects(timed, { code: 'timeout' })
  assert.equal(workers[2].terminated, true)
})
