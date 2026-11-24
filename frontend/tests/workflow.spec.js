import { aiResult, mockAi, analyze, editField } from '../test-support/uxFixtures.js'
import { continuePages, acceptSuggestions } from '../test-support/workflowUi.js'
import { toggleTheme } from '../test-support/workflowUi.js'
import { test, expect } from '../test-support/authFixture.js'
import AxeBuilder from '@axe-core/playwright'
import sharp from 'sharp'
import { readFile } from 'node:fs/promises'
import { readPdf } from '../test-support/readPdf.js'
import { goStep } from '../test-support/workflowUi.js'

const info = (page) => page.getByTestId('document-information')
async function raster(page, text, name) {
  const data = await page.evaluate((text) => {
    const canvas = document.createElement('canvas')
    canvas.width = 1500
    canvas.height = 1100
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#111'
    ctx.font = '46px Arial'
    text.split('\n').forEach((line, index) => ctx.fillText(line, 100, 110 + index * 100))
    return canvas.toDataURL('image/png').split(',')[1]
  }, text)
  return { name, mimeType: 'image/png', buffer: Buffer.from(data, 'base64') }
}
async function blank(index = 0) {
  return {
    name: `synthetic-${index + 1}.png`,
    mimeType: 'image/png',
    buffer: await sharp({
      create: { width: 400 + index * 10, height: 600, channels: 3, background: '#f5f5f5' },
    })
      .png()
      .toBuffer(),
  }
}
async function upload(page, files) {
  await page.getByTestId('gallery-input').setInputFiles(files)
  await expect(page.getByTestId('page-card')).toHaveCount(Array.isArray(files) ? files.length : 1)
  await expect(page.getByRole('heading', { name: 'Pārbaudiet lapas', exact: true })).toBeVisible()
  await expect(page.getByText('Apstrādā…', { exact: true })).toHaveCount(0)
}
async function one(page) {
  await continuePages(page)
  await expect(info(page)).toBeVisible()
}
async function pdf(page, scansOnly = false) {
  if (await page.locator('.completion-card').isVisible())
    await page.getByRole('button', { name: 'Izveidot PDF', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'PDF eksports', exact: true })
  await expect(dialog).toBeVisible()
  await dialog
    .getByRole('radio', { name: scansOnly ? /Tikai skenējums/ : /PDF ar informāciju/ })
    .check()
  const pending = page.waitForEvent('download')
  await dialog.getByRole('button', { name: 'Lejupielādēt PDF', exact: true }).click()
  const result = await pending
  const parsed = await readPdf(await readFile(await result.path()))
  await expect(dialog.getByRole('heading', { name: 'Gatavs!', exact: true })).toBeVisible()
  await expect(
    dialog.getByRole('button', { name: 'Izveidot PDF vēlreiz', exact: true }),
  ).toBeEnabled()
  await expect(page.getByText('Apstrādā…', { exact: true })).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Izveidot PDF vēlreiz', exact: true }).click()
  await dialog.getByRole('button', { name: 'Atcelt', exact: true }).last().click()
  await expect(dialog).toHaveCount(0)
  return parsed
}
async function stored(page) {
  return page.evaluate(async () => {
    const db = await new Promise((resolve) => {
      const r = indexedDB.open('gaso-document-ai:account:000000000000000000000001')
      r.onsuccess = () => resolve(r.result)
    })
    try {
      const tx = db.transaction(['drafts', 'pages'])
      const all = (name) =>
        new Promise((resolve) => {
          const r = tx.objectStore(name).getAll()
          r.onsuccess = () => resolve(r.result)
        })
      const [drafts, pages] = await Promise.all(['drafts', 'pages'].map(all))
      return {
        drafts: drafts.map(({ cover, ...draft }) => draft),
        pages: pages.map(({ thumbnail, ...p }) => p),
      }
    } finally {
      db.close()
    }
  })
}

test('first-time user corrects orientation, analyzes two synthetic photos, accepts fields and downloads an information PDF', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000)
  await page.goto('/')
  await page.getByRole('button', { name: 'Skenēt dokumentu', exact: true }).click()
  const first = await raster(
    page,
    'RĒĶINS Nr. UX-001\nPārdevējs: Sintētisks uzņēmums\nSaņēmējs: Sintētiska Persona\nKopā apmaksai: 125.50 EUR',
    'synthetic-invoice.png',
  )
  const second = await raster(
    page,
    'Pakalpojumu apraksts\nDokumenta otrā lapa',
    'synthetic-continuation.png',
  )
  second.buffer = await sharp(second.buffer).rotate(90).png().toBuffer()
  await upload(page, [first, second])
  await page.getByRole('button', { name: 'Rediģēt 2. lapu', exact: true }).click()
  const editor = page.getByRole('dialog', { name: 'Rediģēt skenējumu', exact: true })
  await expect(editor.getByRole('button', { name: '90° pa kreisi', exact: true })).toBeEnabled()
  await editor.getByRole('button', { name: '90° pa kreisi', exact: true }).click()
  await expect(
    editor.getByRole('button', { name: 'Apstiprināt izmaiņas', exact: true }),
  ).toBeEnabled()
  await editor.getByRole('button', { name: 'Apstiprināt izmaiņas', exact: true }).click()
  await expect(editor).toHaveCount(0)
  await one(page)
  const result = aiResult()
  result.attributes.recipient = 'Sintētiska Persona'
  result.dynamic_attributes.find((field) => field.key === 'recipient').value = 'Sintētiska Persona'
  await mockAi(page, result)
  await analyze(page)
  await expect(info(page).locator('.compact-attributes')).toContainText('Sintētiska Persona')
  await expect(info(page).locator('.compact-attributes')).toContainText('125.50')
  expect((await stored(page)).pages.every((page) => !page.ocr)).toBe(true)
  await analyze(page)
  await page.getByRole('button', { name: 'Apstiprināt dokumentu', exact: true }).click()
  await expect(page.getByTestId('workflow-document')).toHaveCount(1)
  const parsed = await pdf(page)
  expect(parsed.pageCount).toBe(3)
  expect(parsed.pages[0].text).toContain('125.50')
  expect(parsed.pages[0].text).toMatch(/Sintētiska Persona/i)
  const data = await stored(page)
  expect(data.drafts[0].documents[0].pageIds).toEqual(data.drafts[0].pageIds)
  expect(data.drafts[0].documents[0].confirmation).not.toBeNull()
  expect(data.drafts[0].workflow.step).toBe(4)
  await page.screenshot({ path: testInfo.outputPath('workflow-result.png'), fullPage: true })
})

test('six page thumbnails split into three documents whose reviewed values and PDF images stay isolated', async ({
  page,
}, testInfo) => {
  await page.goto('/#/scan')
  await upload(page, await Promise.all(Array.from({ length: 6 }, (_, index) => blank(index))))
  await page.getByRole('button', { name: 'Sadalīt vairākos dokumentos', exact: true }).click()
  const picker = page.getByTestId('boundary-picker')
  await picker.getByRole('checkbox').nth(1).check()
  await picker.getByRole('checkbox').nth(3).check()
  await picker.screenshot({ path: testInfo.outputPath('workflow-boundaries.png') })
  await picker.getByRole('button', { name: 'Izveidot dokumentus (3)', exact: true }).click()
  page.once('dialog', (dialog) => dialog.dismiss())
  await page.getByRole('button', { name: 'Visas lapas ir viens dokuments', exact: true }).click()
  await expect(page.getByTestId('document-group')).toHaveCount(3)
  await page.getByRole('button', { name: 'Turpināt uz datiem', exact: true }).click()
  const documentIds = (await stored(page)).drafts[0].documents.map((item) => item.id)
  for (let index = 0; index < 3; index++) {
    if (index) await goStep(page, 3)
    await page.locator('.workflow-document-select select').selectOption(documentIds[index])
    await editField(page, 'Dokumenta nosaukums', 'Dokuments ' + (index + 1))
    await editField(page, 'Nosūtītājs', 'Persona ' + (index + 1))
    await page.getByRole('button', { name: 'Apstiprināt dokumentu', exact: true }).click()
    await expect(page.locator('.completion-card')).toBeVisible()
  }
  const cards = page.getByTestId('workflow-document')
  await expect(cards).toHaveCount(3)
  for (let index = 0; index < 3; index++) {
    await cards.nth(index).click()
    const parsed = await pdf(page)
    expect(parsed.pageCount).toBe(3)
    expect(parsed.pages[0].text).toContain(`Persona ${index + 1}`)
    expect(parsed.pages[1].images[0].width).toBe(400 + index * 20)
    expect(parsed.pages[2].images[0].width).toBe(410 + index * 20)
  }
})

test('saved work resumes from Home at the correct step and previous steps retain all pages and manually entered values', async ({
  page,
  context,
}) => {
  await page.goto('/#/scan')
  await upload(page, await blank())
  await page.getByRole('button', { name: 'Turpināt uz datiem', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(info(page)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Dokumenta dati', exact: true })).toBeFocused()
  await expect(page.getByRole('button', { name: 'Analizēt dokumentu', exact: true })).toBeDisabled()
  await editField(page, 'Dokumenta nosaukums', 'Turpināmais dokuments')
  await editField(page, 'Saņēmējs', 'Saglabāts saņēmējs')
  await page.getByRole('button', { name: 'Saglabāt melnrakstu', exact: true }).click()
  await expect(page.getByText('Melnraksts sekmīgi saglabāts', { exact: false })).toBeVisible()
  const resumed = await context.newPage()
  await resumed.goto('/')
  await expect(
    resumed.getByRole('heading', { name: 'Turpināt iesākto', exact: true }),
  ).toBeVisible()
  await resumed
    .getByTestId('draft-card')
    .getByRole('button', { name: 'Turpināt', exact: true })
    .click()
  await expect(info(resumed).locator('.compact-attributes')).toContainText('Saglabāts saņēmējs')
  await goStep(resumed, 2)
  await expect(resumed.getByTestId('page-card')).toHaveCount(1)
  await goStep(resumed, 1)
  await goStep(resumed, 3)
  await expect(info(resumed).locator('.compact-attributes')).toContainText('Saglabāts saņēmējs')
  await resumed.close()
})

test('PDF without recognition is a direct path and the responsive form and stepper work in both themes', async ({
  page,
}, testInfo) => {
  const models = []
  page.on('request', (r) => {
    if (r.url().includes('traineddata')) models.push(r.url())
  })
  await page.goto('/#/scan')
  await upload(page, await blank())
  await one(page)
  for (const dark of [false, true]) {
    if (dark) await toggleTheme(page)
    await page.waitForFunction(() =>
      document.getAnimations().every((animation) => animation.playState !== 'running'),
    )
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze()
    expect(
      result.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
    ).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await page.screenshot({
    path: testInfo.outputPath('workflow-information-dark.png'),
    fullPage: true,
  })
  await page
    .getByRole('button', { name: 'Izlaist — saglabāt tikai skenējumu', exact: true })
    .last()
    .click()
  const parsed = await pdf(page, true)
  expect(parsed.pageCount).toBe(1)
  expect(parsed.pages[0].text).toBe('')
  expect(models).toEqual([])
})

test('failed step-transition save stays actionable and a retry preserves pending images and document grouping', async ({
  page,
}) => {
  await page.goto('/#/scan')
  await upload(page, await blank())
  await page.evaluate(() => {
    window.realPut = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'drafts') throw new DOMException('Synthetic quota', 'QuotaExceededError')
      return window.realPut.apply(this, args)
    }
  })
  await page.getByRole('button', { name: 'Turpināt uz datiem', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('nepietiek vietas')
  await expect(page.getByRole('heading', { name: 'Pārbaudiet lapas', exact: true })).toBeVisible()
  await expect(page.getByText('Melnraksts sekmīgi saglabāts', { exact: false })).toHaveCount(0)
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = window.realPut
  })
  await page.getByRole('button', { name: 'Mēģināt saglabāt vēlreiz', exact: true }).click()
  await expect(page.getByText('Melnraksts sekmīgi saglabāts', { exact: false })).toBeVisible()
  await goStep(page, 3)
  const data = await stored(page)
  expect(data.pages).toHaveLength(1)
  expect(data.drafts[0].documents[0].pageIds).toHaveLength(1)
})

test.describe('recognition failure', () => {
  test.use({ serviceWorkers: 'block' })
  test('unavailable AI leaves manual entry and confirmed information PDF available', async ({
    page,
    context,
  }) => {
    await page.route('**/api/document-analysis', (route) =>
      route.fulfill({ status: 503, json: { error: { code: 'ai_disabled' } } }),
    )
    await page.goto('/#/scan')
    await upload(page, await blank())
    await one(page)
    await page.getByRole('checkbox', { name: /Piekrītu šī dokumenta/ }).check()
    await page.getByRole('button', { name: 'Analizēt dokumentu', exact: true }).click()
    await expect(
      page.getByRole('alert').filter({ hasText: 'AI analīze serverī nav ieslēgta.' }),
    ).toBeVisible()
    await editField(page, 'Saņēmējs', 'Manuāli pārbaudīta persona')
    await editField(page, 'Kopējā summa', '125,50')
    await editField(page, 'Valūta', 'EUR')
    await page.getByRole('button', { name: 'Apstiprināt dokumentu', exact: true }).click()
    await expect(page.locator('.completion-card')).toBeVisible()
    const parsed = await pdf(page)
    expect(parsed.pageCount).toBe(2)
    expect(parsed.pages[0].text).toContain('Manuāli pārbaudīta persona')
    expect(parsed.pages[0].text).toContain('125.50')
  })
})
