import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { readFile } from 'node:fs/promises'
import sharp from 'sharp'
import {
  createDocument,
  editValue,
  confirmDocument,
  addCustomField,
} from '../src/features/documents/model.js'
import { makeOcrResult } from '../src/features/ocr/model.js'
import { defaultProcessing } from '../src/features/processing/geometry.js'
import { readPdf } from '../test-support/readPdf.js'

let files, processed
test.beforeAll(async () => {
  const raster = (width, height, background) =>
    sharp({ create: { width, height, channels: 3, background } })
  const oriented = await raster(300, 200, '#0000ff')
    .composite([{ input: await raster(300, 100, '#ff0000').png().toBuffer(), left: 0, top: 0 }])
    .withMetadata({ orientation: 6 })
    .jpeg({ quality: 98 })
    .toBuffer()
  files = [
    {
      name: 'synthetic-red.jpg',
      mimeType: 'image/jpeg',
      buffer: await raster(600, 900, '#ff0000').jpeg().toBuffer(),
    },
    {
      name: 'synthetic-blue.png',
      mimeType: 'image/png',
      buffer: await raster(1000, 600, '#0000ff').png().toBuffer(),
    },
    {
      name: 'synthetic-green.webp',
      mimeType: 'image/webp',
      buffer: await raster(640, 800, '#00ff00').webp({ lossless: true }).toBuffer(),
    },
    { name: 'synthetic-oriented.jpg', mimeType: 'image/jpeg', buffer: oriented },
  ]
  processed = [...(await raster(600, 900, '#ffff00').png().toBuffer())]
})
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.pdfUrls = new Set()
    window.pdfWorkers = new Set()
    const create = URL.createObjectURL.bind(URL),
      revoke = URL.revokeObjectURL.bind(URL)
    URL.createObjectURL = (blob) => {
      const url = create(blob)
      if (blob.type === 'application/pdf') window.pdfUrls.add(url)
      return url
    }
    URL.revokeObjectURL = (url) => {
      window.pdfUrls.delete(url)
      revoke(url)
    }
    const NativeWorker = window.Worker
    window.Worker = new Proxy(NativeWorker, {
      construct(target, args) {
        const worker = Reflect.construct(target, args)
        if (String(args[0]).includes('pdf.worker')) {
          window.pdfWorkers.add(worker)
          const terminate = worker.terminate.bind(worker)
          worker.terminate = () => {
            window.pdfWorkers.delete(worker)
            terminate()
          }
        }
        return worker
      },
    })
  })
})
const groups = (page) => page.getByTestId('document-group')
const dialog = (page) => page.getByRole('dialog', { name: 'PDF eksports', exact: true })
async function storage(page) {
  return page.evaluate(async () => {
    const db = await new Promise((resolve) => {
      const r = indexedDB.open('gaso-document-ai', 1)
      r.onsuccess = () => resolve(r.result)
    })
    try {
      const tx = db.transaction(['drafts', 'pages'])
      const read = (name) =>
        new Promise((resolve) => {
          const r = tx.objectStore(name).getAll()
          r.onsuccess = () => resolve(r.result)
        })
      const [drafts, pages] = await Promise.all(['drafts', 'pages'].map(read))
      return {
        draft: { ...drafts[0], cover: undefined },
        pages: pages.map(({ thumbnail, ...page }) => page),
        stores: [...db.objectStoreNames],
      }
    } finally {
      db.close()
    }
  })
}
async function seed(
  page,
  { oriented = false, many = false, processedImage = true, offlineReady = false } = {},
) {
  await page.goto('/#/scan')
  await page.getByTestId('gallery-input').setInputFiles(oriented ? files : files.slice(0, 3))
  await expect(page.getByTestId('page-card')).toHaveCount(oriented ? 4 : 3)
  await expect(page.getByText('Apstrādā…', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Saglabāt melnrakstu', exact: true }).click()
  await expect(page.getByText('Melnraksts sekmīgi saglabāts', { exact: false })).toBeVisible()
  const stored = await storage(page)
  const ordered = stored.draft.pageIds.map((id) => stored.pages.find((p) => p.id === id))
  if (processedImage)
    Object.assign(ordered[0], {
      processing: { ...defaultProcessing(), filter: 'grayscale' },
      processedWidth: 600,
      processedHeight: 900,
    })
  for (const p of ordered) {
    p.ocr = makeOcrResult(p, ['lav'], { text: 'Sākotnējais sintētiskais OCR' }, 1, 100)
    p.ocr.editedText = 'Lietotāja labotais OCR'
  }
  let session = { ...stored.draft, pages: ordered }
  session = createDocument(session, [ordered[1].id, ordered[0].id], 'Rēķins ĀČĒĢĪĶĻŅŠŪŽ')
  const first = session.documents[0].id
  for (const [key, value] of [
    ['document_type', 'invoice'],
    ['document_number', 'INV-001'],
    ['sender', 'Тестовый отправитель'],
    ['total_amount', '121.00'],
    ['currency', 'EUR'],
  ])
    session = editValue(session, first, key, value)
  if (many)
    for (let i = 0; i < 28; i++)
      session = addCustomField(
        session,
        first,
        `Lauks ${i}`,
        `Sākums${i} ${'Garš teksts ar diakritiku āēž un кириллица. '.repeat(18)} Beigas${i}`,
      )
  session = confirmDocument(session, first)
  session = createDocument(
    session,
    oriented ? [ordered[2].id, ordered[3].id] : [ordered[2].id],
    'Otra grupa',
  )
  session = editValue(session, session.documents[1].id, 'sender', 'Cita dokumenta nosūtītājs')
  session = confirmDocument(session, session.documents[1].id)
  await page.evaluate(
    async ({ documents, pages, processed, processedImage }) => {
      const db = await new Promise((resolve) => {
        const r = indexedDB.open('gaso-document-ai', 1)
        r.onsuccess = () => resolve(r.result)
      })
      try {
        await new Promise((resolve, reject) => {
          const tx = db.transaction(['drafts', 'pages', 'images'], 'readwrite')
          tx.oncomplete = resolve
          tx.onabort = () => reject(tx.error)
          const request = tx.objectStore('drafts').getAll()
          request.onsuccess = () =>
            tx.objectStore('drafts').put({ ...request.result[0], documents })
          for (const p of pages) {
            const request = tx.objectStore('pages').get(p.id)
            request.onsuccess = () => tx.objectStore('pages').put({ ...request.result, ...p })
          }
          if (processedImage) {
            const request = tx.objectStore('images').get(pages[0].id)
            request.onsuccess = () =>
              tx.objectStore('images').put({
                ...request.result,
                processed: new Blob([new Uint8Array(processed)], { type: 'image/png' }),
              })
          }
        })
      } finally {
        db.close()
      }
    },
    { documents: session.documents, pages: ordered, processed, processedImage },
  )
  // Complete initial PWA installation before this fixture's forced reload.
  if (offlineReady) {
    await page.evaluate(() => navigator.serviceWorker.ready)
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller))
  }
  await page.reload()
  await expect(groups(page)).toHaveCount(2)
  return storage(page)
}
async function open(page, index = 0) {
  await groups(page).nth(index).getByRole('button', { name: 'Izveidot PDF', exact: true }).click()
  await expect(dialog(page)).toBeVisible()
  return dialog(page)
}
async function preview(page) {
  await dialog(page)
    .getByRole('button', { name: /^(?:Saglabāt un priekšskatīt PDF|Priekšskatīt PDF)$/ })
    .click()
  await expect(dialog(page).getByTestId('pdf-preview')).toBeVisible({ timeout: 30_000 })
}
async function download(page) {
  const pending = page.waitForEvent('download')
  await dialog(page).getByRole('button', { name: 'Lejupielādēt PDF', exact: true }).click()
  const downloaded = await pending
  return {
    parsed: await readPdf(await readFile(await downloaded.path())),
    filename: downloaded.suggestedFilename(),
  }
}
async function close(page) {
  await dialog(page).getByRole('button', { name: 'Atcelt', exact: true }).last().click()
  await expect(dialog(page)).toHaveCount(0)
  expect(await page.evaluate(() => ({ urls: pdfUrls.size, workers: pdfWorkers.size }))).toEqual({
    urls: 0,
    workers: 0,
  })
}

test('PDF with searchable Unicode information uses only the selected group, approved full images and correct page order without mutating data', async ({
  page,
}, testInfo) => {
  const requests = []
  page.on('request', (request) => {
    if (
      /^(?:https?|wss?):/.test(request.url()) &&
      !request.url().startsWith('http://127.0.0.1:4173')
    )
      requests.push(request.url())
  })
  const before = await seed(page)
  await open(page)
  await preview(page)
  await expect(dialog(page).getByText('PDF lapas: 3', { exact: true })).toBeVisible()
  const { parsed, filename } = await download(page)
  expect(filename).toBe('Rekins_INV-001.pdf')
  expect(parsed.pageCount).toBe(3)
  expect(parsed.pages[0].text).toContain('ĀČĒĢĪĶĻŅŠŪŽ')
  expect(parsed.pages[0].text).toContain('Тестовый отправитель')
  expect(parsed.pages[0].text).not.toContain('Cita dokumenta nosūtītājs')
  expect(parsed.pages[1].images[0]).toMatchObject({
    width: 1000,
    height: 600,
    sample: [0, 0, 255, 0],
  })
  expect(parsed.pages[2].images[0].width).toBe(600)
  expect(parsed.pages[2].images[0].sample.slice(0, 3)).toEqual([255, 255, 0])
  expect(parsed.pages[1].width).toBeGreaterThan(parsed.pages[1].height)
  expect(parsed.pages[2].width).toBeLessThan(parsed.pages[2].height)
  expect(await storage(page)).toEqual(before)
  expect(requests).toEqual([])
  await page.screenshot({ path: testInfo.outputPath('pdf-preview.png'), fullPage: true })
  await close(page)
})

test('unconfirmed or stale data block an information page, review returns to the card and scans-only export saves pending changes safely', async ({
  page,
}) => {
  await seed(page)
  await groups(page)
    .nth(0)
    .getByLabel('Dokumenta nosaukums', { exact: true })
    .fill('Labots nosaukums')
  await open(page)
  await expect(
    dialog(page).getByRole('button', { name: 'Saglabāt un priekšskatīt PDF', exact: true }),
  ).toBeDisabled()
  await expect(dialog(page).getByRole('status')).toContainText('nav apstiprināta')
  await dialog(page).getByRole('button', { name: 'Atgriezties pie datu pārbaudes' }).click()
  await expect(dialog(page)).toHaveCount(0)
  await expect(page.getByTestId('document-information')).toBeFocused()
  await open(page)
  await dialog(page).getByLabel('Iekļaut dokumenta informācijas lapu').uncheck()
  await preview(page)
  const { parsed, filename } = await download(page)
  expect(parsed.pageCount).toBe(2)
  expect(parsed.pages.every((p) => p.text === '')).toBe(true)
  expect(filename).toMatch(/^Dokuments_[\w-]+\.pdf$/)
  expect((await storage(page)).draft.documents[0].values.document_title).toBe('Labots nosaukums')
  await close(page)
})

test('WebP conversion, EXIF orientation, image-sized pages and optimized quality preserve visual proportions', async ({
  page,
}) => {
  await seed(page, { oriented: true })
  await open(page, 1)
  await dialog(page).getByLabel('Iekļaut dokumenta informācijas lapu').uncheck()
  await dialog(page).getByLabel('Skenēto lapu formāts').selectOption('image')
  await preview(page)
  let { parsed } = await download(page)
  expect(parsed.pageCount).toBe(2)
  expect(parsed.pages[0].images[0]).toMatchObject({ width: 640, height: 800 })
  expect(parsed.pages[0].images[0].sample.slice(0, 3)).toEqual([0, 255, 0])
  expect(parsed.pages[1].images[0]).toMatchObject({ width: 200, height: 300 })
  expect(parsed.pages[1].images[0].sample[2]).toBeGreaterThan(240)
  expect(parsed.pages[0].width / parsed.pages[0].height).toBeCloseTo(640 / 800, 5)
  await dialog(page).getByLabel('Attēla kvalitāte').selectOption('optimized')
  await expect(dialog(page).getByTestId('pdf-preview')).toHaveCount(0)
  await expect(
    dialog(page).getByText('Sīks teksts un tabulu līnijas', { exact: false }),
  ).toBeVisible()
  await preview(page)
  ;({ parsed } = await download(page))
  expect(parsed.pages[1].images[0]).toMatchObject({ width: 200, height: 300 })
  expect(await page.evaluate(() => pdfUrls.size)).toBe(1)
  await close(page)
})

test('long attributes continue over information pages and preview fallback remains accessible on mobile and desktop', async ({
  page,
}, testInfo) => {
  await page.addInitScript(() =>
    Object.defineProperty(Navigator.prototype, 'pdfViewerEnabled', { get: () => false }),
  )
  await seed(page, { many: true })
  await open(page)
  await preview(page)
  await expect(dialog(page).locator('iframe')).toHaveCount(0)
  await expect(dialog(page).getByText('Šis pārlūks nepiedāvā', { exact: false })).toBeVisible()
  const { parsed } = await download(page)
  expect(parsed.pageCount).toBeGreaterThan(3)
  const popupEvent = page.waitForEvent('popup')
  await dialog(page).getByRole('link', { name: 'Atvērt PDF jaunā cilnē', exact: true }).click()
  const popup = await popupEvent
  await expect(popup).toHaveURL(/^blob:/)
  await popup.close()
  const text = parsed.pages
    .map((p) => p.text)
    .join(' ')
    .replace(/\s/g, '')
  for (let i = 0; i < 28; i++) {
    expect(text).toContain(`Sākums${i}`)
    expect(text).toContain(`Beigas${i}`)
  }
  for (const dark of [false, true]) {
    if (dark) {
      await close(page)
      await page.locator('.theme-toggle').click()
      await open(page)
      await preview(page)
    }
    await page.waitForFunction(() =>
      document.getAnimations().every((a) => a.playState !== 'running'),
    )
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze()
    expect(
      result.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
    ).toEqual([])
    expect(await dialog(page).evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
  }
  await page.screenshot({ path: testInfo.outputPath('pdf-dialog-dark.png'), fullPage: true })
  await close(page)
})

test('failed autosave prevents generation and a retry exports the complete saved document', async ({
  page,
}) => {
  await seed(page)
  await groups(page)
    .nth(0)
    .getByLabel('Dokumenta nosaukums', { exact: true })
    .fill('Nesaglabāts nosaukums')
  await page.evaluate(() => {
    window.savedPut = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'drafts') throw new DOMException('Synthetic quota', 'QuotaExceededError')
      return window.savedPut.apply(this, args)
    }
  })
  await open(page)
  await dialog(page).getByLabel('Iekļaut dokumenta informācijas lapu').uncheck()
  await dialog(page)
    .getByRole('button', { name: 'Saglabāt un priekšskatīt PDF', exact: true })
    .click()
  await expect(dialog(page).getByRole('alert')).toContainText('nepietiek vietas')
  await expect(dialog(page).getByTestId('pdf-preview')).toHaveCount(0)
  expect(await page.evaluate(() => pdfWorkers.size)).toBe(0)
  expect((await storage(page)).draft.documents[0].values.document_title).not.toBe(
    'Nesaglabāts nosaukums',
  )
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = window.savedPut
  })
  await preview(page)
  expect((await download(page)).parsed.pageCount).toBe(2)
  await close(page)
})

test('missing images fail visibly without partial download; restoration permits a real retry', async ({
  page,
}) => {
  const stored = await seed(page)
  const id = stored.draft.documents[0].pageIds[1]
  await page.evaluate(async (id) => {
    const db = await new Promise((resolve) => {
      const r = indexedDB.open('gaso-document-ai', 1)
      r.onsuccess = () => resolve(r.result)
    })
    await new Promise((resolve) => {
      const tx = db.transaction('images', 'readwrite')
      const store = tx.objectStore('images')
      const r = store.get(id)
      r.onsuccess = () => {
        window.imageBackup = r.result
        store.delete(id)
      }
      tx.oncomplete = resolve
    })
    db.close()
  }, id)
  await open(page)
  await dialog(page).getByRole('button', { name: 'Priekšskatīt PDF', exact: true }).click()
  await expect(dialog(page).getByRole('alert')).toContainText('attēls nav pieejams')
  await expect(dialog(page).getByRole('button', { name: 'Lejupielādēt PDF' })).toHaveCount(0)
  expect(await page.evaluate(() => pdfWorkers.size)).toBe(0)
  await page.evaluate(async () => {
    const db = await new Promise((resolve) => {
      const r = indexedDB.open('gaso-document-ai', 1)
      r.onsuccess = () => resolve(r.result)
    })
    await new Promise((resolve) => {
      const tx = db.transaction('images', 'readwrite')
      tx.objectStore('images').put(window.imageBackup)
      tx.oncomplete = resolve
    })
    db.close()
  })
  await preview(page)
  await close(page)
})

test('PDF generation works offline after reload and neither generated PDFs nor document images enter the PWA cache', async ({
  page,
  context,
}) => {
  await seed(page, { offlineReady: true })
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller))
  await context.setOffline(true)
  await page.reload()
  await expect(groups(page)).toHaveCount(2)
  await open(page)
  await preview(page)
  expect((await download(page)).parsed.pageCount).toBe(3)
  const paths = await page.evaluate(async () => {
    const paths = []
    for (const key of await caches.keys())
      for (const request of await (await caches.open(key)).keys()) paths.push(request.url)
    return paths
  })
  expect(paths.some((url) => url.includes('NotoSans-Regular'))).toBe(true)
  expect(paths.every((url) => !url.startsWith('blob:') && !/\.pdf(?:$|\?)/i.test(url))).toBe(true)
  expect((await storage(page)).stores.sort()).toEqual(['drafts', 'images', 'pages'])
  await close(page)
})

test('a changed saved revision blocks downloading a preview from another tab', async ({
  page,
  context,
}) => {
  await seed(page)
  await open(page)
  await preview(page)
  const other = await context.newPage()
  await other.goto(page.url())
  await groups(other)
    .nth(0)
    .getByLabel('Dokumenta nosaukums', { exact: true })
    .fill('Citas cilnes versija')
  await other.getByRole('button', { name: 'Saglabāt melnrakstu', exact: true }).click()
  await expect(other.getByText('Melnraksts sekmīgi saglabāts', { exact: false })).toBeVisible()
  await dialog(page).getByRole('button', { name: 'Lejupielādēt PDF', exact: true }).click()
  await expect(dialog(page).getByRole('alert')).toContainText(
    'vairs neatbilst pašreizējai versijai',
  )
  await expect(dialog(page).getByTestId('pdf-preview')).toHaveCount(0)
  await other.close()
  await close(page)
})

test('cancelling an active PDF process terminates its worker, releases URLs and leaves saved data unchanged', async ({
  page,
}) => {
  const before = await seed(page)
  await page.evaluate(() => {
    const NativeWorker = window.Worker
    let once = true
    window.Worker = new Proxy(NativeWorker, {
      construct(target, args) {
        const worker = Reflect.construct(target, args)
        if (String(args[0]).includes('pdf.worker') && once) {
          once = false
          const post = worker.postMessage.bind(worker),
            terminate = worker.terminate.bind(worker)
          let timer
          worker.postMessage = (data) => {
            timer = setTimeout(() => post(data), 2000)
          }
          worker.terminate = () => {
            clearTimeout(timer)
            terminate()
          }
        }
        return worker
      },
    })
  })
  await open(page)
  await dialog(page).getByRole('button', { name: 'Priekšskatīt PDF', exact: true }).click()
  await expect.poll(() => page.evaluate(() => pdfWorkers.size)).toBe(1)
  await expect(
    dialog(page).getByRole('button', { name: 'Priekšskatīt PDF', exact: true }),
  ).toBeDisabled()
  await close(page)
  expect(await storage(page)).toEqual(before)
  await open(page)
  await preview(page)
  await close(page)
})
