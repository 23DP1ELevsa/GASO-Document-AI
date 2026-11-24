import { editField } from '../test-support/uxFixtures.js'
import { test, expect } from '../test-support/authFixture.js'
import sharp from 'sharp'
import { ALL_FIELDS } from '../src/features/documents/catalog.js'
import { processingKey } from '../src/features/processing/geometry.js'
import { continuePages, acceptSuggestions } from '../test-support/workflowUi.js'

const text =
  'INVOICE Nr. SYN-001\nSeller: Synthetic Seller\nBuyer: Synthetic Buyer\nTotal: 125.50 EUR'
async function seed(page) {
  await page.goto('/#/scan')
  await page.getByTestId('gallery-input').setInputFiles({
    name: 'synthetic.png',
    mimeType: 'image/png',
    buffer: await sharp({ create: { width: 600, height: 800, channels: 3, background: '#ffffff' } })
      .png()
      .toBuffer(),
  })
  await expect(page.getByTestId('page-card')).toHaveCount(1)
  await continuePages(page)
  await expect(page.getByTestId('document-information')).toBeVisible()
  await page.evaluate(
    async ({ text, key }) => {
      const db = await new Promise((resolve) => {
        const request = indexedDB.open('gaso-document-ai:account:000000000000000000000001')
        request.onsuccess = () => resolve(request.result)
      })
      await new Promise((resolve, reject) => {
        const tx = db.transaction('pages', 'readwrite')
        tx.oncomplete = resolve
        tx.onabort = () => reject(tx.error)
        const read = tx.objectStore('pages').getAll()
        read.onsuccess = () =>
          read.result.forEach((page) =>
            tx.objectStore('pages').put({
              ...page,
              ocr: {
                schemaVersion: 1,
                pageId: page.id,
                imageVersion: `${page.id}:${key}`,
                languages: ['eng'],
                originalText: text,
                editedText: null,
                editedAt: null,
                recognizedAt: 100,
                status: 'success',
              },
            }),
          )
      })
      db.close()
    },
    { text, key: processingKey() },
  )
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller))
  await page.reload()
  await expect(page.getByTestId('document-information')).toBeVisible()
}
function result() {
  return {
    version: 1,
    provider: 'openai',
    document_type: 'invoice',
    requires_review: true,
    attributes: Object.fromEntries(
      ALL_FIELDS.filter((key) => key !== 'document_type').map((key) => [
        key,
        {
          sender: 'Synthetic Seller',
          recipient: 'Synthetic Buyer',
          total_amount: '125.50',
          currency: 'EUR',
        }[key] || null,
      ]),
    ),
    evidence: {},
    warnings: [],
  }
}
test.beforeEach(async ({ page }) => {
  // Even an accidental direct provider call must never leave the test browser.
  await page.route('https://api.openai.com/**', (route) => route.abort())
})
test('AI consent, suggestions, manual edits, IndexedDB reload, confirmation and PDF stay connected', async ({
  page,
}) => {
  let calls = 0
  await page.route('**/api/document-analysis', async (route) => {
    calls++
    const data = route.request().postDataJSON()
    expect(Object.keys(data).sort()).toEqual(['consent', 'pages'])
    expect(data.consent).toBe(true)
    expect(data.pages).toHaveLength(1)
    expect(data.pages[0].image).toMatch(/^data:image\/jpeg;base64,/)
    expect(Object.keys(data.pages[0]).sort()).toEqual(['id', 'image', 'number'])
    await route.fulfill({ json: { result: result() } })
  })
  await seed(page)
  await expect(page.getByLabel('Dokumenta analīze', { exact: true })).toHaveCount(0)
  const recognize = page.getByRole('button', { name: 'Analizēt dokumentu', exact: true })
  await expect(recognize).toBeDisabled()
  expect(calls).toBe(0)
  await page.getByRole('checkbox', { name: /Piekrītu šī dokumenta/ }).check()
  const info = page.getByTestId('document-information')
  await editField(page, 'Nosūtītājs', 'Manuāls pārdevējs')
  await recognize.click()
  await expect(page.locator('.analysis-choice > summary')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Atcelt analīzi' })).toHaveCount(0)
  await expect(info.locator('.compact-attributes')).toContainText('Manuāls pārdevējs')
  expect(calls).toBe(1)
  await acceptSuggestions(page)
  await page.getByRole('button', { name: 'Apstiprināt dokumentu', exact: true }).click()
  await expect(page.getByTestId('workflow-document')).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: 'Izveidot PDF', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'PDF eksports', exact: true })
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('.pdf-progress')).toHaveCount(0, { timeout: 30000 })
  await expect(dialog.locator('.pdf-error')).toHaveCount(0)
})
test('an offline account lock prevents document analysis requests', async ({ page, context }) => {
  let calls = 0
  await page.route('**/api/document-analysis', (route) => {
    calls++
    return route.abort()
  })
  await seed(page)
  await page.getByRole('checkbox', { name: /Piekrītu šī dokumenta/ }).check()
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller))
  await context.setOffline(true)
  await expect(page.getByRole('heading', { name: 'Pieslēgties' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Analizēt dokumentu', exact: true })).toHaveCount(0)
  expect(calls).toBe(0)
})
