import { expect, test } from '@playwright/test'
import { addToSet, confirm, mockAi } from '../test-support/uxFixtures.js'
import { continuePages, goStep, groupingTools } from '../test-support/workflowUi.js'
import {
  horizontalOverflow,
  longEvidence,
  longLabel,
  longTitle,
  longValue,
  responsiveResult,
  scanPages,
} from '../test-support/responsiveUi.js'

test.describe.configure({ mode: 'parallel' })

async function fits(page, screen) {
  await expect.poll(() => horizontalOverflow(page), { message: screen }).toEqual([])
}

for (const [index, width] of [320, 360, 375, 390, 412, 430, 480, 768].entries()) {
  const theme = index % 2 === 0 ? 'light' : 'dark'
  test(`main screens, attributes and dialogs fit at ${width}px in ${theme} mode`, async ({
    page,
  }) => {
    test.setTimeout(60000)
    await page.setViewportSize({ width, height: index % 2 === 0 ? 692 : 844 })
    await page.addInitScript(
      (value) => localStorage.setItem('gaso-document-ai:theme', value),
      theme,
    )
    await page.goto('/')
    await expect(page.locator('.v-application')).toHaveClass(new RegExp(`v-theme--${theme}`))
    await fits(page, 'Home')
    await page.getByRole('button', { name: 'Skenēt dokumentu', exact: true }).click()
    await expect(page.locator('.capture-panel')).toBeVisible()
    await fits(page, 'Capture')
    await page.locator('.session-menu > summary').click()
    await expect(page.locator('.header-menu')).toBeVisible()
    await fits(page, 'Header menu')
    await page.keyboard.press('Escape')
    await scanPages(page)
    await fits(page, 'Scan pages with long filenames')
    const card = page.getByTestId('page-card').first()
    await card.getByRole('button', { name: '1. lapas darbības' }).click()
    await expect(page.locator('.page-action-menu')).toBeVisible()
    await fits(page, 'Page action menu')
    await page.keyboard.press('Escape')
    await card.locator('.page-image-button').click()
    const preview = page.getByRole('dialog', { name: 'Lapu priekšskatījums' })
    await expect(preview.locator('.image-dialog > img')).toBeVisible()
    await fits(page, 'Image preview and page navigation')
    await preview.getByRole('button', { name: 'Aizvērt priekšskatījumu' }).click()
    await card.locator('.page-card-actions > button').first().click()
    const editor = page.getByRole('dialog', { name: 'Rediģēt skenējumu' })
    await editor.getByRole('button', { name: 'Papildu darbības' }).click()
    await editor.locator('.corner-numeric summary').click()
    await fits(page, 'Image editor and coordinate controls at default zoom')
    await editor.locator('.editor-heading button').click()
    await page.getByRole('button', { name: 'Visas lapas ir viens dokuments' }).click()
    await groupingTools(page)
    const group = page.getByTestId('document-group').first()
    await group.locator('.group-membership summary').click()
    await fits(page, 'Grouping and page controls')
    await continuePages(page)
    let finishAnalysis
    const analysis = new Promise((resolve) => {
      finishAnalysis = resolve
    })
    await page.route('**/api/document-analysis', async (route) => {
      await analysis
      await route.fulfill({ json: { result: responsiveResult() } })
    })
    await page.getByRole('checkbox', { name: /Piekrītu šī dokumenta/ }).check()
    await page.getByRole('button', { name: 'Analizēt dokumentu', exact: true }).click()
    try {
      await expect(page.getByRole('heading', { name: 'AI analizē dokumentu…' })).toBeVisible()
      await fits(page, 'AI loading overlay')
    } finally {
      finishAnalysis()
    }
    const info = page.getByTestId('document-information')
    const row = info.locator('.compact-attribute').filter({ hasText: longLabel })
    await expect(row).toContainText(longValue)
    await info.locator('.review-sources summary').click()
    await expect(info.getByText(longEvidence, { exact: true })).toBeVisible()
    await fits(page, 'Long attribute values and source evidence')
    await row.getByRole('button', { name: 'Rediģēt: ' + longLabel }).click()
    await expect(row.getByLabel(longLabel, { exact: true })).toHaveValue(longValue)
    await fits(page, 'Long attribute and name in the editor')
    await row.getByRole('button', { name: 'Gatavs' }).click()
    const addField = info.locator('.review-extra')
    await addField.locator('summary').click()
    await addField.getByLabel('Atribūta nosaukums').fill('Jauns pārbaudes lauks')
    await addField.getByLabel('Atribūta vērtība').fill(longValue)
    await fits(page, 'Add attribute form with a long typed value')
    await addField.locator('summary').click()
    const amount = info.locator('[data-field="total_amount"]')
    await amount.getByRole('button', { name: /Rediģēt:/ }).click()
    await amount.getByRole('textbox').fill('nederīgs')
    await expect(amount.locator('.field-error')).toBeVisible()
    await fits(page, 'Invalid attribute feedback')
    await amount.getByRole('textbox').fill('125.50')
    await amount.getByRole('button', { name: 'Gatavs' }).click()
    await goStep(page, 1)
    await fits(page, 'Capture with seven thumbnails')
    await goStep(page, 3)
    await confirm(page)
    await fits(page, 'Confirmed document')
    await page.getByRole('button', { name: 'Izveidot PDF', exact: true }).click()
    await page.locator('.pdf-advanced summary').click()
    await page.getByRole('button', { name: 'Priekšskatīt PDF', exact: true }).click()
    await expect(page.getByTestId('pdf-preview')).toBeVisible()
    await fits(page, 'PDF export and preview')
    await page.locator('.pdf-cancel').click()
    await page.getByRole('button', { name: 'Pievienot komplektam', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Pievienot komplektam' })).toBeVisible()
    await fits(page, 'Add to collection dialog')
    await page.getByRole('button', { name: 'Atcelt', exact: true }).click()
    await addToSet(page, 'Komplekts — ' + longLabel)
    await page.getByRole('button', { name: 'Apskatīt dokumentu', exact: true }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(longTitle)
    await fits(page, 'Saved document with a long title and seven thumbnails')
    await page.getByRole('button', { name: 'Izveidot PDF', exact: true }).click()
    const pdf = page.getByRole('dialog', { name: 'PDF eksports' })
    await expect(pdf.getByText('Lejupielādēt PDF')).toBeVisible()
    await fits(page, 'Saved document PDF dialog')
    await pdf.getByRole('button', { name: 'Aizvērt PDF' }).click()
    await page.goto('/#/documents')
    await expect(page.getByTestId('document-card')).toBeVisible()
    await fits(page, 'Document list')
    await page.getByRole('link', { name: 'Komplekti', exact: true }).click()
    await page.getByRole('button', { name: 'Izveidot komplektu' }).click()
    await expect(page.getByRole('dialog', { name: 'Jauns komplekts' })).toBeVisible()
    await fits(page, 'Create collection dialog')
    await page.getByRole('button', { name: 'Atcelt', exact: true }).click()
    await fits(page, 'Collection list')
    await page.getByRole('button', { name: /Komplekts —/ }).click()
    await expect(page.locator('.collection-name')).toBeVisible()
    await fits(page, 'Collection details')
    await page.getByRole('link', { name: 'Iestatījumi', exact: true }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Iestatījumi')
    await fits(page, 'Settings')
  })
}

test('enlarged font, safe insets, landscape and a keyboard-height viewport keep editing usable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 692 })
  await page.addInitScript(() => {
    document.addEventListener(
      'DOMContentLoaded',
      () => {
        const { style } = document.documentElement
        style.fontSize = '175%'
        style.setProperty('--safe-area-inset-top', '24px')
        style.setProperty('--safe-area-inset-bottom', '24px')
        style.setProperty('--safe-area-inset-left', '12px')
        style.setProperty('--safe-area-inset-right', '12px')
      },
      { once: true },
    )
  })
  await mockAi(page, responsiveResult())
  await page.goto('/#/settings')
  await expect(page.locator('.settings-view')).toBeVisible()
  await expect(page.locator('html')).toHaveCSS('font-size', '28px')
  await expect(page.locator('.app-header')).toHaveCSS('padding-left', '28px')
  await fits(page, 'Settings at 175% font size')
  await page.goto('/#/scan')
  await scanPages(page)
  await continuePages(page)
  await page.getByRole('checkbox', { name: /Piekrītu šī dokumenta/ }).check()
  await page.getByRole('button', { name: 'Analizēt dokumentu', exact: true }).click()
  const row = page.locator('.compact-attribute').filter({ hasText: longLabel })
  await expect(row).toContainText(longValue)
  await fits(page, 'Data review with large type and side insets')
  await page.setViewportSize({ width: 692, height: 320 })
  expect(await page.evaluate(() => matchMedia('(orientation: landscape)').matches)).toBe(true)
  await fits(page, 'Landscape data review')
  await row.getByRole('button', { name: /Rediģēt:/ }).click()
  const input = row.getByLabel(longLabel, { exact: true })
  await page.setViewportSize({ width: 320, height: 390 })
  await expect(input).toBeFocused()
  await expect(page.locator('.mobile-step-footer')).toBeHidden()
  await input.fill(longValue + ' PAPILDINĀTS')
  await fits(page, 'Short viewport with the text editor focused')
  await row.getByRole('button', { name: 'Gatavs' }).click()
  await expect(row).toContainText('PAPILDINĀTS')
  await expect(page.locator('.mobile-step-footer')).toBeInViewport()
})
