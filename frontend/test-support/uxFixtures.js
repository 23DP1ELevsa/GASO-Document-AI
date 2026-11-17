import { expect } from '@playwright/test'
import sharp from 'sharp'
import grouping from '../src/locales/grouping.lv.js'
import { ALL_FIELDS } from '../src/features/documents/catalog.js'
import { continuePages } from './workflowUi.js'
export function aiResult(overrides = {}) {
  const entries = [
    ['document_title', 'Dokumenta nosaukums', 'Sintētisks rēķins', 'text'],
    ['document_number', 'Dokumenta numurs', 'UX-001', 'text'],
    ['sender', 'Nosūtītājs', 'SIA Sintētisks piemērs', 'text'],
    ['recipient', 'Saņēmējs', 'SIA Klients', 'text'],
    ['issue_date', 'Izdošanas datums', '2026-11-17', 'date'],
    ['total_amount', 'Kopējā summa', '125.50', 'amount'],
    ['currency', 'Valūta', 'EUR', 'currency'],
    [null, 'Īpašais nosacījums', 'Pārbaudāms nosacījums', 'text'],
  ]
  return {
    version: 2,
    provider: 'openai',
    requires_review: true,
    document_type: 'invoice',
    attributes: Object.fromEntries(
      ALL_FIELDS.filter((key) => key !== 'document_type').map((key) => [
        key,
        entries.find((entry) => entry[0] === key)?.[2] ?? null,
      ]),
    ),
    dynamic_attributes: entries.map(([key, label, value, dataType], i) => ({
      id: 'ai_' + i,
      key,
      label,
      value,
      dataType,
      page: null,
      pageId: null,
      evidence: null,
      status: 'unreviewed',
      origin: 'ai',
    })),
    evidence: {},
    warnings: [],
    usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
    ...overrides,
  }
}
export async function image(index = 0) {
  return {
    name: 'synthetic-' + index + '.png',
    mimeType: 'image/png',
    buffer: await sharp({
      create: {
        width: 600 + index * 100,
        height: 800,
        channels: 3,
        background: index ? '#e7f1ff' : '#fff7e7',
      },
    })
      .png()
      .toBuffer(),
  }
}
export async function review(page, count = 1) {
  await page.goto('/#/scan')
  await page
    .getByTestId('gallery-input')
    .setInputFiles(await Promise.all(Array.from({ length: count }, (_, i) => image(i))))
  await expect(page.getByTestId('page-card')).toHaveCount(count)
  await continuePages(page)
  await expect(page.getByTestId('document-information')).toBeVisible()
}
export async function mockAi(page, result = aiResult()) {
  await page.route('https://api.openai.com/**', (route) => route.abort())
  await page.route('**/api/document-analysis', (route) => route.fulfill({ json: { result } }))
}
export async function analyze(page) {
  const details = page.locator('.analysis-choice')
  if (await details.locator('summary').count()) {
    if (!(await details.evaluate((el) => el.open))) await details.locator('summary').click()
  }
  await page.getByRole('checkbox', { name: /Piekrītu šī dokumenta/ }).check()
  await page.getByRole('button', { name: /^Analizēt (dokumentu|atkārtoti)$/ }).click()
  await expect(page.locator('.compact-attributes')).toContainText('SIA Sintētisks piemērs')
  await expect(page.getByRole('button', { name: 'Atcelt analīzi' })).toHaveCount(0)
}
export async function editField(page, label, value) {
  const info = page.getByTestId('document-information').filter({ visible: true })
  await expect(info.locator('.review-extra')).toBeVisible()
  const pencil = info.getByRole('button', { name: 'Rediģēt: ' + label, exact: true })
  if (await pencil.count()) await pencil.click()
  else {
    const key = Object.entries(grouping.fields).find((entry) => entry[1] === label)?.[0]
    if (!key) throw new Error('Unknown field label: ' + label)
    const more = info.locator('.review-extra')
    if (!(await more.evaluate((el) => el.open))) await more.locator('summary').click()
    await more.locator('select').selectOption(key)
    await more.getByLabel('Atribūta vērtība', { exact: true }).fill(value)
    await more.getByRole('button', { name: 'Pievienot atribūtu', exact: true }).click()
  }
  await info.getByLabel(label, { exact: true }).fill(value)
  await info.getByRole('button', { name: 'Gatavs', exact: true }).click()
}
export async function records(page, store) {
  return page.evaluate(
    (store) =>
      new Promise((resolve, reject) => {
        const req = indexedDB.open('gaso-document-ai')
        req.onerror = () => reject(req.error)
        req.onsuccess = () => {
          const db = req.result
          const tx = db.transaction(store)
          let value
          tx.objectStore(store).getAll().onsuccess = (e) => (value = e.target.result)
          tx.oncomplete = () => {
            db.close()
            resolve(value)
          }
          tx.onabort = () => reject(tx.error)
        }
      }),
    store,
  )
}
export async function confirm(page) {
  await page.getByRole('button', { name: 'Apstiprināt dokumentu', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Dokuments apstiprināts', exact: true }),
  ).toBeVisible()
}
export async function addToSet(page, name = 'UX komplekts') {
  await page.getByRole('button', { name: 'Pievienot komplektam', exact: true }).click()
  const dialog = page.locator('.collection-dialog')
  await expect(dialog).toBeVisible()
  await dialog.locator('select').selectOption('')
  await dialog.getByLabel('Komplekta nosaukums', { exact: true }).fill(name)
  await dialog.getByRole('button', { name: 'Pievienot', exact: true }).click()
  await expect(page.getByText('Dokuments pievienots komplektam.', { exact: true })).toBeVisible()
}
