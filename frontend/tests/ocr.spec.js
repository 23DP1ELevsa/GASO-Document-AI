// Migrated from the former OCR UI scenarios: local OCR is deliberately inactive.
// The isolated OCR engine/service tests remain in tests-unit/ocr.test.js.
import { test, expect } from '../test-support/authFixture.js'
import sharp from 'sharp'
import {
  aiResult,
  review,
  mockAi,
  analyze,
  editField,
  records,
  confirm,
  image,
} from '../test-support/uxFixtures.js'
import { continuePages, goStep } from '../test-support/workflowUi.js'
async function documentImage(page, text, name = 'synthetic.png', options = {}) {
  const base64 = await page.evaluate(
    ({ text, options }) => {
      const canvas = document.createElement('canvas')
      canvas.width = 1500
      canvas.height = 1100
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = options.dim ? '#939189' : '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = options.dim ? '#45433e' : '#151515'
      ctx.font = `${options.small ? 25 : 48}px Arial`
      const lines = text.split('\n')
      lines.forEach((line, i) => ctx.fillText(line, 100, 120 + i * 85))
      if (options.table) {
        ctx.strokeStyle = '#333'
        for (let i = 0; i <= lines.length; i++) {
          ctx.beginPath()
          ctx.moveTo(70, 65 + i * 85)
          ctx.lineTo(1430, 65 + i * 85)
          ctx.stroke()
        }
        for (const x of [70, 900, 1430]) {
          ctx.beginPath()
          ctx.moveTo(x, 65)
          ctx.lineTo(x, 65 + lines.length * 85)
          ctx.stroke()
        }
      }
      return canvas.toDataURL('image/png').split(',')[1]
    },
    { text, options },
  )
  return { name, mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') }
}

test('Latvian image analysis preserves original photos, manual edits and reloaded draft data without OCR', async ({
  page,
}) => {
  await mockAi(page)
  await review(page)
  const before = await originalHashes(page)
  await analyze(page)
  await editField(page, 'Nosūtītājs', 'Pārbaudīts nosūtītājs')
  await page.getByRole('button', { name: 'Uz sākumu', exact: true }).first().click()
  await page
    .getByTestId('draft-card')
    .getByRole('button', { name: 'Turpināt', exact: true })
    .click()
  await page.reload()
  await expect(page.locator('.compact-attributes')).toContainText('Pārbaudīts nosūtītājs')
  expect(await originalHashes(page)).toEqual(before)
  expect((await records(page, 'pages'))[0].ocr).toBeUndefined()
})

test('LV EN and RU photos use one image API and never request language models', async ({
  page,
}) => {
  const languageRequests = []
  page.on('request', (request) => {
    if (/traineddata|tesseract|\.wasm/.test(request.url())) languageRequests.push(request.url())
  })
  let calls = 0
  await page.route('**/api/document-analysis', (route) => {
    calls++
    expect(route.request().postDataJSON().pages[0].image).toMatch(/^data:image\/jpeg;base64,/)
    return route.fulfill({ json: { result: aiResult() } })
  })
  for (const text of ['RĒĶINS Nr. LV-1', 'INVOICE No. EN-1', 'СЧЁТ № RU-1']) {
    await page.goto('/#/scan')
    await page.getByTestId('gallery-input').setInputFiles(await documentImage(page, text))
    await expect(page.getByTestId('page-card')).toHaveCount(1)
    await continuePages(page)
    await analyze(page)
    await confirm(page)
    await page.getByRole('button', { name: 'Skenēt nākamo', exact: true }).click()
  }
  expect(calls).toBe(3)
  expect(languageRequests).toEqual([])
})

test('multi-page image analysis keeps order and isolates corrupt imports without local batch OCR', async ({
  page,
}) => {
  let payload
  await page.route('**/api/document-analysis', (route) => {
    payload = route.request().postDataJSON()
    return route.fulfill({ json: { result: aiResult() } })
  })
  await page.goto('/#/scan')
  await page
    .getByTestId('gallery-input')
    .setInputFiles([
      await image(),
      { name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('broken synthetic image') },
      await image(1),
    ])
  await expect(page.getByTestId('page-card')).toHaveCount(2)
  await continuePages(page)
  await analyze(page)
  expect(payload.pages.map((item) => item.number)).toEqual([1, 2])
  expect(payload.pages[0].image).not.toBe(payload.pages[1].image)
  expect((await records(page, 'pages')).every((page) => !page.ocr)).toBe(true)
})

test('missing Tesseract and WebAssembly resources do not affect image analysis', async ({
  page,
}) => {
  const requested = []
  await page.route(/\/ocr\/|\.wasm|traineddata/, (route) => {
    requested.push(route.request().url())
    return route.abort()
  })
  await mockAi(page)
  await review(page)
  await analyze(page)
  expect(requested).toEqual([])
  await confirm(page)
  await expect(page.getByRole('button', { name: 'Apskatīt dokumentu', exact: true })).toBeVisible()
})

test('AI cancellation terminates waiting, preserves photos and allows a fresh attempt', async ({
  page,
}) => {
  await page.route('**/api/document-analysis', () => {})
  await review(page)
  const before = await originalHashes(page)
  await page.getByRole('checkbox', { name: /Piekrītu šī dokumenta/ }).check()
  await page.getByRole('button', { name: 'Analizēt dokumentu', exact: true }).click()
  await page.getByRole('button', { name: 'Atcelt analīzi', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('atcelta')
  expect(await originalHashes(page)).toEqual(before)
  await page.unroute('**/api/document-analysis')
  await mockAi(page)
  await analyze(page)
  await confirm(page)
})

test('manual scan export works after PWA preparation without OCR resources', async ({ page }) => {
  const requested = []
  page.on('request', (request) => {
    if (/traineddata|tesseract|\.wasm/.test(request.url())) requested.push(request.url())
  })
  await review(page)
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller))
  await page.getByRole('button', { name: 'Izlaist — saglabāt tikai skenējumu' }).click()
  await expect(page.getByRole('dialog', { name: 'PDF eksports', exact: true })).toBeVisible()
  await expect(page.locator('.pdf-progress')).toHaveCount(0, { timeout: 30000 })
  expect(requested).toEqual([])
})

test('legacy corrected OCR remains stored while the current UI offers only image analysis', async ({
  page,
}) => {
  await review(page)
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        const req = indexedDB.open('gaso-document-ai:account:000000000000000000000001')
        req.onsuccess = () => {
          const db = req.result
          const tx = db.transaction('pages', 'readwrite')
          tx.objectStore('pages').getAll().onsuccess = (e) => {
            for (const page of e.target.result)
              tx.objectStore('pages').put({
                ...page,
                ocr: {
                  originalText: 'Legacy original',
                  editedText: 'Legacy correction',
                  recognizedAt: 1,
                },
              })
          }
          tx.oncomplete = () => {
            db.close()
            resolve()
          }
        }
      }),
  )
  await page.reload()
  await expect(page.getByRole('button', { name: 'Atpazīt tekstu', exact: true })).toHaveCount(0)
  await expect(page.getByRole('group', { name: 'Dokumenta OCR valodas' })).toHaveCount(0)
  expect((await records(page, 'pages'))[0].ocr.editedText).toBe('Legacy correction')
})

test('AI receives the rotated full processed image while the original remains unchanged', async ({
  page,
}) => {
  let dimensions
  await page.route('**/api/document-analysis', async (route) => {
    const data = route.request().postDataJSON()
    dimensions = await sharp(Buffer.from(data.pages[0].image.split(',')[1], 'base64')).metadata()
    await route.fulfill({ json: { result: aiResult() } })
  })
  await review(page)
  const before = await originalHashes(page)
  await goStep(page, 2)
  await page.getByRole('button', { name: 'Rediģēt 1. lapu', exact: true }).click()
  await page.getByRole('button', { name: '90° pa labi', exact: true }).click()
  await page.getByRole('button', { name: 'Apstiprināt izmaiņas', exact: true }).click()
  await goStep(page, 3)
  await analyze(page)
  expect(dimensions.width).toBeGreaterThan(dimensions.height)
  expect(dimensions.width).toBeGreaterThan(480)
  expect(await originalHashes(page)).toEqual(before)
})

test('cancelling a later document preserves an already confirmed document', async ({ page }) => {
  await mockAi(page)
  await review(page)
  await analyze(page)
  await confirm(page)
  const first = (await records(page, 'drafts'))[0]
  await page.getByRole('button', { name: 'Skenēt nākamo', exact: true }).click()
  await review(page)
  await page.route('**/api/document-analysis', () => {})
  await page.getByRole('checkbox', { name: /Piekrītu šī dokumenta/ }).check()
  await page.getByRole('button', { name: 'Analizēt dokumentu', exact: true }).click()
  await page.getByRole('button', { name: 'Atcelt analīzi', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('atcelta')
  expect(
    (await records(page, 'drafts')).find((item) => item.id === first.id).documents[0].confirmation,
  ).toEqual(first.documents[0].confirmation)
})

test('AI save quota failures retain values and retry commits the same photos and attributes', async ({
  page,
}) => {
  await mockAi(page)
  await review(page)
  const before = await originalHashes(page)
  await page.evaluate(() => {
    window.originalPut = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'drafts') throw new DOMException('Synthetic quota', 'QuotaExceededError')
      return window.originalPut.apply(this, args)
    }
  })
  await analyze(page)
  await expect(page.getByRole('alert')).toContainText('nepietiek vietas')
  await page.evaluate(() => (IDBObjectStore.prototype.put = window.originalPut))
  await page.getByRole('button', { name: 'Uz sākumu', exact: true }).first().click()
  await expect(page).toHaveURL(/#\/$/)
  expect((await records(page, 'drafts'))[0].documents[0].analysis.result.provider).toBe('openai')
  expect(await originalHashes(page)).toEqual(before)
})

async function originalHashes(page) {
  return page.evaluate(async () => {
    const db = await new Promise((resolve) => {
      const req = indexedDB.open('gaso-document-ai:account:000000000000000000000001')
      req.onsuccess = () => resolve(req.result)
    })
    const images = await new Promise((resolve) => {
      const req = db.transaction('images').objectStore('images').getAll()
      req.onsuccess = () => resolve(req.result)
    })
    db.close()
    return Promise.all(
      images
        .filter((image) => image.blob)
        .map(async (image) => [
          image.id,
          [
            ...new Uint8Array(
              await crypto.subtle.digest('SHA-256', await image.blob.arrayBuffer()),
            ),
          ].join(','),
        ]),
    )
  })
}
