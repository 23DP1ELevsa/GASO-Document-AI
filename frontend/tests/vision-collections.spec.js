import { editField } from '../test-support/uxFixtures.js'
import { test, expect } from '@playwright/test'
import sharp from 'sharp'
import { readFile } from 'node:fs/promises'
import { ALL_FIELDS } from '../src/features/documents/catalog.js'
import { continuePages, goStep } from '../test-support/workflowUi.js'
import { readPdf } from '../test-support/readPdf.js'

function result() {
  return {
    version: 2,
    provider: 'openai',
    requires_review: true,
    document_type: 'invoice',
    attributes: Object.fromEntries(
      ALL_FIELDS.filter((key) => key !== 'document_type').map((key) => [
        key,
        key === 'sender' ? 'Synthetic Seller' : null,
      ]),
    ),
    dynamic_attributes: [
      {
        id: 'ai_0',
        label: 'Nosūtītājs',
        key: 'sender',
        value: 'Synthetic Seller',
        dataType: 'text',
        pageId: null,
        page: null,
        evidence: null,
        origin: 'ai',
        status: 'unreviewed',
      },
      {
        id: 'ai_1',
        label: 'Īpašais nosacījums',
        key: null,
        value: 'Sintētisks nosacījums',
        dataType: 'text',
        pageId: null,
        page: null,
        evidence: null,
        origin: 'ai',
        status: 'unreviewed',
      },
    ],
    evidence: {},
    warnings: [],
    usage: { input_tokens: 12, output_tokens: 8, total_tokens: 20 },
  }
}
async function files(count = 1) {
  return Promise.all(
    Array.from({ length: count }, async (_, index) => ({
      name: 'synthetic-' + index + '.png',
      mimeType: 'image/png',
      buffer: await sharp({
        create: {
          width: 600 + index * 100,
          height: 800,
          channels: 3,
          background: index ? '#0000ff' : '#ff0000',
        },
      })
        .png()
        .toBuffer(),
    })),
  )
}
async function scan(page, count = 1) {
  await page.goto('/#/scan')
  await page.getByTestId('gallery-input').setInputFiles(await files(count))
  await expect(page.getByTestId('page-card')).toHaveCount(count)
  await continuePages(page)
  await expect(page.getByTestId('document-information')).toBeVisible()
}
async function analyze(page) {
  await page.getByRole('checkbox', { name: /Piekrītu šī dokumenta/ }).check()
  await page.getByRole('button', { name: 'Analizēt dokumentu', exact: true }).click()
  await expect(page.locator('.compact-attributes')).toContainText('Synthetic Seller')
}
async function add(page, name) {
  await page.getByRole('button', { name: 'Pievienot komplektam', exact: true }).click()
  const dialog = page.locator('.collection-dialog')
  await expect(dialog).toBeVisible()
  if (name) {
    await dialog.locator('select').selectOption('')
    await dialog.getByLabel('Komplekta nosaukums', { exact: true }).fill(name)
  }
  await dialog.getByRole('button', { name: 'Pievienot', exact: true }).click()
  await expect(page.getByText('Dokuments pievienots komplektam.', { exact: true })).toBeVisible()
}
async function dbRead(page, store) {
  return page.evaluate(
    (store) =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open('gaso-document-ai')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const db = request.result
          const tx = db.transaction(store)
          let rows
          tx.objectStore(store).getAll().onsuccess = (event) => {
            rows = event.target.result
          }
          tx.oncomplete = () => {
            db.close()
            resolve(rows)
          }
        }
      }),
    store,
  )
}
test.beforeEach(async ({ page }) => {
  await page.route('https://api.openai.com/**', (route) => route.abort())
})

test('ordered image analysis has explicit consent, a real waiting overlay, editable attributes and no OCR worker', async ({
  page,
}) => {
  let release, requestData
  const gate = new Promise((resolve) => {
    release = resolve
  })
  await page.route('**/api/document-analysis', async (route) => {
    requestData = route.request().postDataJSON()
    await gate
    await route.fulfill({ json: { result: result() } })
  })
  await page.addInitScript(() => {
    window.ocrWorkers = []
    const Native = Worker
    window.Worker = new Proxy(Native, {
      construct(target, args) {
        if (/ocr.worker|tesseract/.test(String(args[0]))) window.ocrWorkers.push(String(args[0]))
        return Reflect.construct(target, args)
      },
    })
  })
  await scan(page, 2)
  await expect(page.getByRole('button', { name: 'Analizēt dokumentu', exact: true })).toBeDisabled()
  await page.getByRole('checkbox', { name: /Piekrītu šī dokumenta/ }).check()
  await page.getByRole('button', { name: 'Analizēt dokumentu', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'AI analizē dokumentu…' })).toBeVisible()
  expect(requestData.pages.map((page) => page.number)).toEqual([1, 2])
  expect(
    requestData.pages.every(
      (page) => page.image.startsWith('data:image/jpeg;base64,') && !('text' in page),
    ),
  ).toBe(true)
  expect(requestData.pages[0].image).not.toBe(requestData.pages[1].image)
  await expect(
    page.getByRole('progressbar', { name: 'Dokumenta analīzes progress' }),
  ).toHaveAttribute('aria-valuemin', '0')
  release()
  await expect(page.locator('.compact-attributes')).toContainText('Synthetic Seller')
  await expect(page.getByRole('heading', { name: 'AI analizē dokumentu…' })).toHaveCount(0)
  await editField(page, 'Nosūtītājs', 'Lietotāja labojums')
  await page.locator('.analysis-choice > summary').click()
  await page.getByRole('button', { name: 'Analizēt atkārtoti', exact: true }).click()
  await expect(page.locator('.compact-attributes')).toContainText('Lietotāja labojums')
  await expect(page.getByRole('button', { name: 'Atcelt analīzi' })).toHaveCount(0)
  expect(await page.evaluate(() => window.ocrWorkers)).toEqual([])
  const originals = await dbRead(page, 'images')
  expect(originals).toHaveLength(2)
  await page.getByRole('button', { name: 'Apstiprināt dokumentu' }).click()
  await expect(page.locator('.completion-card')).toBeVisible()
  if (await page.locator('.completion-card').isVisible())
    await page.getByRole('button', { name: 'Izveidot PDF', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'PDF eksports', exact: true })).toBeVisible()
  await expect(page.locator('.pdf-progress')).toHaveCount(0, { timeout: 30000 })
  await expect(page.locator('.pdf-error')).toHaveCount(0)
})

test('cancellation and AI errors preserve scans and allow manual or scan-only export', async ({
  page,
}) => {
  await page.route('**/api/document-analysis', () => {})
  await scan(page)
  await page.getByRole('checkbox', { name: /Piekrītu šī dokumenta/ }).check()
  await page.getByRole('button', { name: 'Analizēt dokumentu', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Atcelt analīzi' })).toBeVisible()
  await page.getByRole('button', { name: 'Atcelt analīzi' }).click()
  await expect(page.getByText('AI analīze atcelta. Dokumenta dati ir saglabāti.')).toBeVisible()
  await page.unroute('**/api/document-analysis')
  await page.route('**/api/document-analysis', (route) =>
    route.fulfill({ status: 503, json: { error: { code: 'ai_disabled' } } }),
  )
  await page.getByRole('button', { name: 'Analizēt dokumentu', exact: true }).click()
  await expect(page.getByText('AI analīze serverī nav ieslēgta.', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /lokāli|Atpazīt tekstu/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Izlaist — saglabāt tikai skenējumu' }).click()
  await expect(page.getByRole('dialog', { name: 'PDF eksports', exact: true })).toBeVisible()
})

test('custom attributes can be renamed, removed and reviewed without changing catalog keys', async ({
  page,
}) => {
  await page.route('**/api/document-analysis', (route) =>
    route.fulfill({ json: { result: result() } }),
  )
  await scan(page)
  await analyze(page)
  await page.getByRole('button', { name: 'Rediģēt: Īpašais nosacījums', exact: true }).click()
  await page.getByLabel('Lauka nosaukums', { exact: true }).fill('Lietotāja nosacījums')
  await page.getByRole('button', { name: 'Dzēst', exact: true }).click()
  await expect(page.locator('.compact-attributes')).not.toContainText('Lietotāja nosacījums')
  await page.locator('.analysis-choice > summary').click()
  await page.getByRole('button', { name: 'Analizēt atkārtoti', exact: true }).click()
  await expect(page.locator('.compact-attributes')).not.toContainText('Īpašais nosacījums')
})

test('saved sets survive reload, later additions, draft deletion, ordering and combined Unicode PDF', async ({
  page,
}) => {
  await page.route('**/api/document-analysis', (route) =>
    route.fulfill({ json: { result: result() } }),
  )
  await scan(page)
  await analyze(page)
  await page.getByRole('button', { name: 'Apstiprināt dokumentu' }).click()
  await expect(page.locator('.pdf-progress')).toHaveCount(0, { timeout: 30000 })
  await add(page, 'Komplekts Ābols')
  const firstDraft = (await dbRead(page, 'drafts'))[0]
  let images = await dbRead(page, 'images')
  expect(images.filter((item) => item.blob)).toHaveLength(1)
  expect(images.filter((item) => item.reference)).toHaveLength(1)
  await page.goto('/#/collections')
  await page.reload()
  await page.getByRole('button', { name: /Komplekts Ābols/ }).click()
  await expect(page.getByRole('heading', { name: 'Komplekts Ābols', exact: true })).toBeVisible()
  // Delete the entire originating session. The immutable image reference must remain usable.
  await page.evaluate(
    (id) =>
      new Promise((resolve) => {
        const request = indexedDB.open('gaso-document-ai')
        request.onsuccess = () => {
          const db = request.result
          const tx = db.transaction(['drafts', 'pages', 'images'], 'readwrite')
          tx.objectStore('drafts').get(id).onsuccess = (event) => {
            for (const pageId of event.target.result.pageIds) {
              tx.objectStore('pages').delete(pageId)
              tx.objectStore('images').delete(pageId)
            }
            tx.objectStore('drafts').delete(id)
          }
          tx.oncomplete = () => {
            db.close()
            resolve()
          }
        }
      }),
    firstDraft.id,
  )
  await page.getByRole('button', { name: 'Izveidot komplekta PDF', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Lejupielādēt PDF', exact: true })).toBeVisible({
    timeout: 30000,
  })
  const bytes = await page
    .getByRole('link', { name: 'Lejupielādēt PDF', exact: true })
    .evaluate(async (el) => [...new Uint8Array(await (await fetch(el.href)).arrayBuffer())])
  const pdf = await readPdf(bytes)
  expect(pdf.pages[0].text).toContain('Sintētisks nosacījums')
  expect(pdf.pages.at(-1).images).toHaveLength(1)
  // A new session created later can contribute another document without copying the first image.
  await page.getByRole('button', { name: 'Skenēt un pievienot dokumentu', exact: true }).click()
  await scan(page)
  await page.getByRole('button', { name: 'Izlaist — saglabāt tikai skenējumu' }).click()
  await expect(page.locator('.pdf-progress')).toHaveCount(0, { timeout: 30000 })
  await add(page)
  await page.goto('/#/collections')
  await page.getByRole('button', { name: /Komplekts Ābols/ }).click()
  await expect(page.locator('article.collection-card')).toHaveCount(2)
  await page.getByRole('button', { name: 'Pārvietot lejup' }).first().click()
  await page.getByLabel('Komplekta nosaukums', { exact: true }).fill('Atjaunots komplekts')
  await page.getByRole('button', { name: 'Saglabāt nosaukumu' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Atjaunots komplekts')
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Atjaunots komplekts')
  await expect(page.locator('article.collection-card')).toHaveCount(2)
  await page.getByRole('button', { name: 'Izveidot komplekta PDF', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Lejupielādēt PDF', exact: true })).toBeVisible({
    timeout: 30000,
  })
  const combined = await page
    .getByRole('link', { name: 'Lejupielādēt PDF', exact: true })
    .evaluate(async (el) => [...new Uint8Array(await (await fetch(el.href)).arrayBuffer())])
  const full = await readPdf(combined)
  expect(full.pages[0].images).toHaveLength(1)
  expect(full.pages[1].text).toContain('Sintētisks nosacījums')
  expect(full.pages.at(-1).images).toHaveLength(1)
})

test('phone layouts, dark mode and disabled OCR settings remain accessible', async ({ page }) => {
  await page.goto('/#/collections')
  await expect(page.getByRole('link', { name: 'Komplekti', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Izveidot komplektu' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await page.goto('/#/settings')
  await expect(page.getByText('Sagatavot OCR bezsaistei', { exact: true })).toHaveCount(0)
  await page.locator('.theme-options').getByRole('button', { name: 'Tumšs', exact: true }).click()
  await page.goto('/#/collections')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
})

test('IndexedDB v1 migration preserves original images, OCR, attributes and saved drafts', async ({
  page,
}) => {
  await page.route('**/migration-seed', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<html><body>Migration fixture</body></html>',
    }),
  )
  await page.goto('/migration-seed')
  await page.evaluate(async () => {
    await new Promise((resolve, reject) => {
      const request = indexedDB.open('gaso-document-ai', 1)
      request.onupgradeneeded = () => {
        for (const store of ['drafts', 'pages', 'images'])
          request.result.createObjectStore(store, { keyPath: 'id' })
      }
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const db = request.result
        const tx = db.transaction(['drafts', 'pages', 'images'], 'readwrite')
        tx.objectStore('images').put({ id: 'old-page', blob: new Blob(['synthetic-original']) })
        tx.objectStore('pages').put({
          id: 'old-page',
          name: 'Legacy',
          width: 600,
          height: 800,
          ocr: { originalText: 'Synthetic old text', editedText: 'Corrected old text' },
        })
        tx.objectStore('drafts').put({
          id: 'legacy',
          revision: 1,
          createdAt: 1,
          updatedAt: 1,
          pageIds: ['old-page'],
          documents: [],
          schemaVersion: 1,
        })
        tx.oncomplete = () => {
          db.close()
          resolve()
        }
        tx.onabort = () => reject(tx.error)
      }
    })
  })
  await page.goto('/#/documents')
  await expect(page.getByRole('link', { name: 'Komplekti', exact: true })).toBeVisible()
  // Opening the repository upgrades only the new stores; existing records stay byte-for-byte intact.
  const stored = await dbRead(page, 'pages')
  expect(stored[0].ocr.editedText).toBe('Corrected old text')
  const original = await page.evaluate(async () => {
    const request = indexedDB.open('gaso-document-ai')
    return new Promise((resolve) => {
      request.onsuccess = () => {
        const db = request.result
        const tx = db.transaction('images')
        tx.objectStore('images').get('old-page').onsuccess = async (event) => {
          const value = await event.target.result.blob.text()
          db.close()
          resolve(value)
        }
      }
    })
  })
  expect(original).toBe('synthetic-original')
  const version = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const request = indexedDB.open('gaso-document-ai')
        request.onsuccess = () => {
          const db = request.result
          resolve({ version: db.version, stores: [...db.objectStoreNames] })
          db.close()
        }
      }),
  )
  expect(version.version).toBe(3)
  expect(version.stores).toEqual(
    expect.arrayContaining(['collections', 'savedDocuments', 'drafts', 'images', 'pages', 'storageSync']),
  )
})

test('editing a draft after adding it to a set shares the original and preserves its saved version', async ({
  page,
}) => {
  await scan(page)
  await page.getByRole('button', { name: 'Izlaist — saglabāt tikai skenējumu' }).click()
  await expect(page.locator('.pdf-progress')).toHaveCount(0, { timeout: 30000 })
  await add(page, 'Oriģināla versija')
  const before = await dbRead(page, 'savedDocuments')
  const imageId = before[0].pages[0].imageRecordId
  await goStep(page, 2)
  await page.getByRole('button', { name: 'Rediģēt 1. lapu', exact: true }).click()
  await page.getByRole('button', { name: '90° pa labi', exact: true }).click()
  await page.getByRole('button', { name: 'Apstiprināt izmaiņas', exact: true }).click()
  await goStep(page, 4)
  await expect(page.locator('.pdf-progress')).toHaveCount(0, { timeout: 30000 })
  const images = await dbRead(page, 'images')
  expect(images.filter((image) => image.blob)).toHaveLength(1)
  expect(images.some((image) => image.originalReference === imageId && image.processed)).toBe(true)
  expect((await dbRead(page, 'savedDocuments'))[0].pages[0].imageRecordId).toBe(imageId)
  // Removing a set keeps the original still referenced by the edited draft.
  await page.goto('/#/collections')
  await page.getByRole('button', { name: /Oriģināla versija/ }).click()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Dzēst komplektu', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Izveidot komplektu', exact: true })).toBeVisible()
  expect(await dbRead(page, 'savedDocuments')).toHaveLength(0)
  expect((await dbRead(page, 'images')).some((image) => image.id === imageId)).toBe(true)
  // Deleting the last draft removes every now-unreachable image version.
  await page.goto('/#/documents')
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Dzēst sesiju', exact: true }).click()
  await expect(page.getByTestId('draft-card')).toHaveCount(0)
  expect(await dbRead(page, 'images')).toHaveLength(0)
})
