import { editField } from '../test-support/uxFixtures.js'
import { test, expect } from '@playwright/test'
import sharp from 'sharp'
import { continuePages, goStep, toggleTheme, navigate } from '../test-support/workflowUi.js'

async function image() {
  return {
    name: 'synthetic-mobile.png',
    mimeType: 'image/png',
    buffer: await sharp({ create: { width: 500, height: 700, channels: 3, background: '#fff' } })
      .png()
      .toBuffer(),
  }
}

test('Home gallery opens the real file chooser and a single page needs no manual group', async ({
  page,
}) => {
  await page.goto('/')
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Pievienot no galerijas', exact: true }).click()
  await (await chooser).setFiles(await image())
  await expect(page.getByTestId('page-card')).toHaveCount(1)
  await expect(page.locator('.single-document-choice')).toHaveCount(0)
  await continuePages(page)
  await expect(page.getByTestId('document-information')).toBeVisible()
  await expect(page.locator('.workspace-savebar strong')).toHaveText('Saglabāts ierīcē')
})

test('manual fields persist and status follows confirmation rather than a past PDF download', async ({
  page,
}) => {
  await page.goto('/#/scan')
  await page.getByTestId('gallery-input').setInputFiles(await image())
  await continuePages(page)
  await editField(page, 'Nosūtītājs', 'Sintētisks mobilais dokuments')
  await page.getByRole('button', { name: 'Apstiprināt dokumentu', exact: true }).click()
  await expect(page.locator('.completion-card')).toBeVisible()
  await page.getByRole('button', { name: 'Izveidot PDF', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'PDF eksports', exact: true })
  const download = page.waitForEvent('download')
  await dialog.getByRole('button', { name: 'Lejupielādēt PDF', exact: true }).click()
  expect((await download).suggestedFilename()).toMatch(/\.pdf$/)
  await dialog.getByRole('link', { name: 'Uz dokumentiem', exact: true }).click()
  await expect(page.getByTestId('document-card')).toContainText('Apstiprināts')
  await page.getByRole('button', { name: /Apskatīt dokumentu:/ }).click()
  await page.getByRole('button', { name: 'Rediģēt', exact: true }).click()
  await editField(page, 'Nosūtītājs', 'Mainīts pēc lejupielādes')
  await page.getByRole('button', { name: 'Uz sākumu', exact: true }).first().click()
  await page.goto('/#/documents')
  await expect(page.getByTestId('document-card')).toContainText('Jāpārbauda dati')
  await page.getByRole('button', { name: /Apskatīt dokumentu:/ }).click()
  await expect(page.locator('.compact-attributes')).toContainText('Mainīts pēc lejupielādes')
})

test('the last editable field and fixed action remain usable in both themes and simulated safe areas', async ({
  page,
}, testInfo) => {
  await page.goto('/#/scan')
  await page.getByTestId('gallery-input').setInputFiles(await image())
  await continuePages(page)
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--safe-area-inset-top', '24px')
    document.documentElement.style.setProperty('--safe-area-inset-bottom', '32px')
  })
  for (const theme of ['light', 'dark']) {
    if (theme === 'dark') await toggleTheme(page)
    if (theme === 'light') await editField(page, 'Valūta', 'EUR')
    const field = page.locator('[data-field="currency"]')
    await field.scrollIntoViewIfNeeded()
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    const box = await field.boundingBox()
    const footer = await page.locator('.mobile-step-footer').boundingBox()
    expect(box.y + box.height).toBeLessThanOrEqual(footer.y)
    expect(footer.x).toBeGreaterThanOrEqual(0)
    expect(footer.width).toBeLessThanOrEqual(430)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await expect(
      page.getByRole('button', { name: 'Apstiprināt dokumentu', exact: true }),
    ).toBeInViewport()
    await page.screenshot({ path: testInfo.outputPath(`mobile-fields-${theme}.png`) })
  }
})
