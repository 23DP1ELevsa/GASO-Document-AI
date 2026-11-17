import { test, expect } from '@playwright/test'
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
        const request = indexedDB.open('gaso-document-ai', 1)
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
    expect(data.pages[0].text).toBe(text)
    expect(Object.keys(data.pages[0]).sort()).toEqual(['id', 'number', 'text'])
    await route.fulfill({ json: { result: result() } })
  })
  await seed(page)
  await expect(page.getByLabel('Dokumenta analīze', { exact: true })).toHaveValue('local')
  await page.getByLabel('Dokumenta analīze', { exact: true }).selectOption('openai')
  const recognize = page.getByRole('button', { name: 'Atpazīt dokumentu', exact: true }).last()
  await recognize.click()
  await expect(
    page.getByText('Pirms AI analīzes apstipriniet OCR teksta nosūtīšanu OpenAI.', { exact: true }),
  ).toBeVisible()
  expect(calls).toBe(0)
  await page.getByRole('checkbox', { name: /Piekrītu šī dokumenta/ }).check()
  const info = page.getByTestId('document-information')
  await info.getByLabel('Nosūtītājs', { exact: true }).fill('Manuāls pārdevējs')
  await recognize.click()
  await expect(info.getByText(/OpenAI ieteikumi/)).toBeVisible()
  await expect(info.getByLabel('Nosūtītājs', { exact: true })).toHaveValue('Manuāls pārdevējs')
  expect(calls).toBe(1)
  await acceptSuggestions(page)
  await page.getByRole('button', { name: 'Apstiprināt un turpināt', exact: true }).click()
  await expect(page.getByTestId('workflow-document')).toBeVisible()
  await page.reload()
  await page.getByTestId('workflow-document').click()
  const dialog = page.getByRole('dialog', { name: 'PDF eksports', exact: true })
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('.pdf-progress')).toHaveCount(0, { timeout: 30000 })
  await expect(dialog.locator('.pdf-error')).toHaveCount(0)
})
test('offline AI offers an explicit local continuation without network requests', async ({
  page,
  context,
}) => {
  let calls = 0
  await page.route('**/api/document-analysis', (route) => {
    calls++
    return route.abort()
  })
  await seed(page)
  await page.getByLabel('Dokumenta analīze', { exact: true }).selectOption('openai')
  await page.getByRole('checkbox', { name: /Piekrītu šī dokumenta/ }).check()
  // The explicitly local action in source details must stay local even with AI selected.
  await page.getByText('Ieteikumu avoti un papildu informācija', { exact: true }).click()
  await page.getByRole('button', { name: 'Analizēt lokāli', exact: true }).click()
  await expect(page.getByTestId('document-information').getByText(/Analīze veikta/)).toBeVisible()
  expect(calls).toBe(0)
  await context.setOffline(true)
  await page.getByRole('button', { name: 'Atpazīt dokumentu', exact: true }).last().click()
  await expect(
    page.getByText('Nav interneta savienojuma. Varat turpināt ar lokālo analīzi.', { exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Turpināt ar lokālo analīzi', exact: true }).click()
  await expect(page.getByLabel('Dokumenta analīze', { exact: true })).toHaveValue('local')
  await expect(
    page.getByRole('button', { name: 'Atpazīt dokumentu', exact: true }).last(),
  ).toBeEnabled()
  expect(calls).toBe(0)
})
