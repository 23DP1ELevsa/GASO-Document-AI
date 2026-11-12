import { expect } from '@playwright/test'
export async function goStep(page, number) {
  const names = ['Pievienošana', 'Lapas', 'Informācija', 'PDF']
  const button = page
    .getByRole('navigation', { name: 'Dokumenta sagatavošanas soļi' })
    .getByRole('button', { name: new RegExp('^' + names[number - 1]) })
  await expect(button).toBeVisible()
  if ((await button.getAttribute('aria-current')) !== 'step') await button.click()
  await expect(button).toHaveAttribute('aria-current', 'step')
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
}
export async function analyzeDocument(page, index = 0) {
  await reviewDocument(page, index)
  await analysisDetails(page)
  await page
    .getByTestId('document-information')
    .getByRole('button', { name: 'Analizēt lokāli', exact: true })
    .click()
}
