import { analyzePages } from '../src/features/documents/analysis.js'
import { expect } from '@playwright/test'
export async function goStep(page, number) {
  const names = ['Foto', 'Lapas', 'Dati', 'PDF']
  if (await page.locator('.completion-card').isVisible()) {
    if (number === 4) return
    await page.getByRole('button', { name: 'Atpakaļ', exact: true }).first().click()
  }
  const button = page
    .getByRole('navigation', { name: 'Dokumenta sagatavošanas soļi' })
    .getByRole('button', { name: new RegExp('^' + names[number - 1]) })
  await expect(button).toBeVisible()
  if ((await button.getAttribute('aria-current')) !== 'step') await button.click()
  if (number === 4) await expect(page.locator('.workflow-result')).toBeVisible()
  else await expect(button).toHaveAttribute('aria-current', 'step')
  await expect(page.getByText('Apstrādā…', { exact: true })).toHaveCount(0)
}
export async function pageTools(page, index = 0) {
  await goStep(page, 2)
  const details = page.getByTestId('page-card').nth(index).locator('.page-extra-tools')
  if (!(await details.evaluate((element) => element.open)))
    await details.locator(':scope > summary').click()
}
export async function sessionTools(page) {
  const details = page.locator('.session-menu')
  if (!(await details.evaluate((element) => element.open)))
    await details.locator(':scope > summary').click()
}
export async function groupingTools(page) {
  await goStep(page, 2)
  const choice = page.getByRole('button', { name: 'Sadalīt vairākos dokumentos', exact: true })
  if (await choice.isVisible()) await choice.click()
  if (!(await page.locator('.group-manual-creation').count())) {
    await sessionTools(page)
    await page.getByRole('button', { name: 'Pārvaldīt dokumentus', exact: true }).click()
  }
  const details = page.locator('.group-manual-creation')
  if (!(await details.evaluate((element) => element.open)))
    await details.locator(':scope > summary').click()
}
export async function textTools(page) {
  await goStep(page, 2)
  const details = page.locator('.legacy-text-tools')
  if (!(await details.evaluate((element) => element.open)))
    await details.locator(':scope > summary').click()
}
export async function pdfSettings(page) {
  const dialog = page.getByRole('dialog', { name: 'PDF eksports', exact: true })
  // Auto-preview completes before changing its settings.
  await expect(dialog.locator('.pdf-progress')).toHaveCount(0, { timeout: 30000 })
  const details = dialog.locator('.pdf-advanced')
  if (!(await details.evaluate((element) => element.open)))
    await details.locator(':scope > summary').click()
}
export async function reviewDocument(page, index = 0) {
  await goStep(page, 2)
  const choice = page.getByRole('button', { name: 'Sadalīt vairākos dokumentos', exact: true })
  if (await choice.isVisible()) await choice.click()
  await page
    .getByTestId('document-group')
    .nth(index)
    .getByRole('button', { name: 'Dokumenta informācija', exact: true })
    .click()
  await expect(page.getByTestId('document-information')).toBeVisible()
}
export async function analysisDetails(page) {
  const details = page.locator('.review-sources')
  if (!(await details.evaluate((element) => element.open)))
    await details.locator(':scope > summary').click()
}
export async function extraFields(page) {
  const details = page.locator('.review-extra')
  if (!(await details.evaluate((element) => element.open)))
    await details.locator(':scope > summary').click()
  await details.locator('select').selectOption('custom')
}
export async function analyzeDocument(page, index = 0) {
  await reviewDocument(page, index)
  const pages = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const req = indexedDB.open('gaso-document-ai:account:000000000000000000000001')
        req.onsuccess = () => {
          const db = req.result
          const tx = db.transaction(['drafts', 'pages'])
          let drafts, rows
          const done = () => {
            if (!drafts || !rows) return
            const draft = drafts[0],
              document =
                draft.documents.find((item) => item.id === draft.workflow.documentId) ||
                draft.documents[0]
            resolve(document.pageIds.map((id) => rows.find((page) => page.id === id)))
            db.close()
          }
          tx.objectStore('drafts').getAll().onsuccess = (e) => {
            drafts = e.target.result
            done()
          }
          tx.objectStore('pages').getAll().onsuccess = (e) => {
            rows = e.target.result
            done()
          }
        }
      }),
  )
  // Fixture-derived output is a fake backend response; no browser OCR or real AI request runs.
  const result = { ...analyzePages(pages), provider: 'openai' }
  await page.route('**/api/document-analysis', (route) => route.fulfill({ json: { result } }))
  const details = page.locator('.analysis-choice')
  if ((await details.locator('summary').count()) && !(await details.evaluate((el) => el.open)))
    await details.locator('summary').click()
  await page.getByRole('checkbox', { name: /Piekrītu šī dokumenta/ }).check()
  await page.getByRole('button', { name: /^Analizēt (dokumentu|atkārtoti)$/ }).click()
  await expect(page.locator('.analysis-choice > summary')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Atcelt analīzi' })).toHaveCount(0)
}

export async function toggleTheme(page) {
  await sessionTools(page)
  await page.locator('.theme-toggle').click()
  await page.locator('.session-menu > summary').click()
}
export async function navigate(page, name) {
  if (name === 'Skenēt') {
    await page.getByRole('button', { name: 'Atpakaļ', exact: true }).click()
    return
  }
  if (await page.locator('.session-menu').count()) await sessionTools(page)
  await page.getByRole('link', { name, exact: true }).click()
}
export async function continuePages(page) {
  const one = page.getByRole('button', { name: 'Visas lapas ir viens dokuments', exact: true })
  if (await one.isVisible()) await one.click()
  await page.getByRole('button', { name: 'Turpināt uz datiem', exact: true }).click()
}
export async function acceptSuggestions(page) {
  await expect(page.getByTestId('document-information')).toBeVisible()
  const done = page.getByRole('button', { name: 'Gatavs', exact: true })
  if (await done.isVisible()) await done.click()
}
