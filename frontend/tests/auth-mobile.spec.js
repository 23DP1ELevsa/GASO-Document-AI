import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { employee } from '../test-support/authFixture.js'

const loginTitle = 'Laipni lūdzam!'
const registerTitle = 'Izveidojiet kontu'
const password = (page) => page.getByLabel('Parole', { exact: true })
const confirmation = (page) => page.getByLabel('Paroles apstiprinājums', { exact: true })
const email = (page) => page.getByLabel('Darba e-pasts', { exact: true })

test.use({ serviceWorkers: 'allow' })

test.beforeEach(async ({ context }) => {
  await context.route('**/api/auth/me', (route) => route.fulfill({ status: 401, json: {} }))
  await context.route('**/api/auth/csrf-cookie', (route) => route.fulfill({ status: 204 }))
})

async function assertLayout(page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth === window.innerWidth),
  ).toBe(true)
  const form = page.locator('form')
  const formBounds = await form.boundingBox()
  const submitBounds = await form.locator('button[type="submit"]').boundingBox()
  expect(formBounds.x).toBeGreaterThanOrEqual(16)
  expect(formBounds.x).toBeLessThanOrEqual(24)
  expect(submitBounds.width).toBeCloseTo(formBounds.width)
  for (const target of await page.locator('header button, form button, form input, main a').all()) {
    const bounds = await target.boundingBox()
    expect(bounds.height).toBeGreaterThanOrEqual(48)
    expect(bounds.width).toBeGreaterThanOrEqual(48)
  }
}

for (const [width, height] of [
  [320, 680],
  [360, 800],
  [375, 812],
  [390, 844],
  [412, 892],
  [430, 932],
]) {
  for (const theme of ['light', 'dark']) {
    test(`auth screens fit ${width}px in ${theme} mode`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height })
      await page.addInitScript(
        (value) => localStorage.setItem('gaso-document-ai:theme', value),
        theme,
      )
      await page.goto('/#/login')
      await expect(page.getByRole('heading', { name: loginTitle })).toBeVisible()
      await expect(page.locator('.v-application')).toHaveClass(new RegExp(`v-theme--${theme}`))
      await expect(email(page)).toHaveAttribute('inputmode', 'email')
      await expect(email(page)).toHaveAttribute('autocomplete', 'username')
      await expect(password(page)).toHaveAttribute('autocomplete', 'current-password')
      await assertLayout(page)
      const capture = [360, 390, 430].includes(width)
      if (capture) {
        await page.screenshot({
          path: testInfo.outputPath(`login-${width}-${theme}.png`),
          fullPage: true,
        })
      }

      await page.getByRole('link', { name: 'Reģistrēties' }).click()
      await expect(page.getByRole('heading', { name: registerTitle })).toBeFocused()
      await expect(page.getByRole('heading', { name: 'Paroles prasības' })).toBeInViewport()
      await expect(page.getByText('Vēl jāizpilda.', { exact: true })).toHaveCount(2)
      await expect(password(page)).toHaveAttribute('autocomplete', 'new-password')
      await expect(confirmation(page)).toHaveAttribute('autocomplete', 'new-password')
      const firstName = await page.getByLabel('Vārds', { exact: true }).boundingBox()
      const lastName = await page.getByLabel('Uzvārds', { exact: true }).boundingBox()
      if (width === 320) expect(lastName.y).toBeGreaterThan(firstName.y)
      else expect(lastName.y).toBe(firstName.y)
      await assertLayout(page)
      if (capture) {
        await page.screenshot({
          path: testInfo.outputPath(`register-${width}-${theme}.png`),
          fullPage: true,
        })
      }
      if (width === 390) {
        const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
        expect(result.violations).toEqual([])
      }
      await page.goBack()
      await expect(page.getByRole('heading', { name: loginTitle })).toBeFocused()
    })
  }
}

test('registration tracks Unicode length, matching passwords and independent visibility', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/#/register')
  const lengthRule = page.locator('#password-length')
  const matchRule = page.locator('#password-match')
  await expect(lengthRule).toContainText('Vēl jāizpilda.')
  await expect(matchRule).toContainText('Vēl jāizpilda.')

  const unicode = '🔐'.repeat(12)
  await password(page).fill('🔐'.repeat(11))
  await expect(lengthRule).toContainText('Vēl jāizpilda.')
  await password(page).fill(unicode)
  await expect(lengthRule).toContainText('Izpildīta.')
  await expect(matchRule).toContainText('Vēl jāizpilda.')
  await confirmation(page).fill(unicode)
  await expect(matchRule).toContainText('Izpildīta.')

  await page.getByRole('button', { name: 'Rādīt paroli', exact: true }).tap()
  await expect(password(page)).toHaveAttribute('type', 'text')
  await expect(confirmation(page)).toHaveAttribute('type', 'password')
  await page.getByRole('button', { name: 'Rādīt paroles apstiprinājumu' }).tap()
  await expect(confirmation(page)).toHaveAttribute('type', 'text')
  await page.getByRole('button', { name: 'Paslēpt paroli', exact: true }).tap()
  await expect(password(page)).toHaveAttribute('type', 'password')
  await expect(confirmation(page)).toHaveValue(unicode)
  await page.getByRole('button', { name: 'Paslēpt paroles apstiprinājumu' }).tap()
  await expect(confirmation(page)).toHaveAttribute('type', 'password')

  await confirmation(page).fill('neatbilst')
  await expect(matchRule).toContainText('Vēl jāizpilda.')
  await password(page).fill('🔐'.repeat(1024))
  await expect(lengthRule).toContainText('Izpildīta.')
  await password(page).fill('🔐'.repeat(1025))
  await expect(lengthRule).toContainText('Vēl jāizpilda.')
  await password(page).clear()
  await expect(lengthRule).toContainText('Vēl jāizpilda.')
})

test('registration validates locally, displays a Laravel field error and signs in after retry', async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 360, height: 800 })
  let attempts = 0
  let user = null
  await context.route('**/api/auth/me', (route) =>
    user ? route.fulfill({ json: user }) : route.fulfill({ status: 401, json: {} }),
  )
  await context.route('**/api/storage/v1/status', (route) =>
    route.fulfill({ status: 503, json: {} }),
  )
  const unicode = '🔐'.repeat(12)
  await context.route('**/api/auth/register', (route) => {
    const payload = route.request().postDataJSON()
    expect(payload).toMatchObject({
      firstName: 'Anna',
      password: unicode,
      password_confirmation: unicode,
    })
    if (++attempts === 1) {
      return route.fulfill({
        status: 422,
        json: { errors: { email: ['Šī darba e-pasta adrese jau ir reģistrēta.'] } },
      })
    }
    user = { ...employee, email: payload.email }
    return route.fulfill({ status: 201, json: user })
  })
  await page.goto('/#/register')
  const submit = page.getByRole('button', { name: 'Izveidot kontu' })
  await submit.click()
  await expect(page.getByLabel('Vārds', { exact: true })).toBeFocused()
  await page.getByLabel('Vārds', { exact: true }).fill('Anna')
  await page.getByLabel('Uzvārds', { exact: true }).fill('Testiņa')
  await email(page).fill('malformed')
  await password(page).fill(unicode)
  await confirmation(page).fill('neatbilst')
  await submit.click()
  await expect(email(page)).toHaveAccessibleDescription(/Ievadiet derīgu darba e-pasta adresi/)
  await expect(confirmation(page)).toHaveAccessibleDescription(/Paroles nesakrīt/)
  await email(page).fill('anna.testina@example.com')
  await confirmation(page).fill(unicode)
  await submit.click()
  await expect(email(page)).toHaveAccessibleDescription(/Izmantojiet GASO darba e-pastu/)
  expect(attempts).toBe(0)

  await email(page).fill(employee.email)
  await submit.click()
  await expect(email(page)).toBeFocused()
  await expect(email(page)).toHaveAttribute('aria-invalid', 'true')
  await expect(email(page)).toHaveAccessibleDescription(/jau ir reģistrēta/)
  await expect(password(page)).toHaveValue(unicode)
  await email(page).fill('anna.testina-test@gaso.lv')
  await expect(email(page)).not.toHaveAttribute('aria-invalid', 'true')
  await submit.click()
  await expect(page.getByRole('link', { name: 'Mans profils' })).toBeVisible()
  expect(attempts).toBe(2)
})

test('login handles visibility, failed requests, loading and double submission', async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  let attempts = 0
  let release
  let user = null
  const response = new Promise((resolve) => {
    release = resolve
  })
  await context.route('**/api/auth/me', (route) =>
    user ? route.fulfill({ json: user }) : route.fulfill({ status: 401, json: {} }),
  )
  await context.route('**/api/storage/v1/status', (route) =>
    route.fulfill({ status: 503, json: {} }),
  )
  await context.route('**/api/auth/login', async (route) => {
    const credentials = route.request().postDataJSON()
    if (++attempts === 1) {
      await response
      return route.fulfill({ status: 429, json: { error: { code: 'rate_limit' } } })
    }
    if (attempts === 2) {
      return route.fulfill({
        status: 422,
        json: {
          errors: { email: ['Darba e-pasts vai parole nav pareiza, vai konts ir deaktivizēts.'] },
        },
      })
    }
    expect(credentials).toEqual({ email: employee.email, password: 'derīga-parole' })
    user = employee
    return route.fulfill({ json: user })
  })
  await page.goto('/#/login')
  await email(page).fill(employee.email)
  await password(page).fill('vecā-parole')
  await page.getByRole('button', { name: 'Rādīt paroli' }).tap()
  await expect(password(page)).toHaveAttribute('type', 'text')
  await page.getByRole('button', { name: 'Paslēpt paroli' }).tap()
  await expect(password(page)).toHaveAttribute('type', 'password')
  const submit = page.getByRole('button', { name: 'Pieslēgties' })
  await password(page).press('Enter')
  try {
    await expect(submit).toBeDisabled()
    await expect(submit).toHaveAttribute('aria-busy', 'true')
    await expect.poll(() => attempts).toBe(1)
    await page.locator('form').evaluate((form) => form.requestSubmit())
  } finally {
    release()
  }
  await expect(page.getByRole('alert').filter({ hasText: 'Pārāk daudz mēģinājumu.' })).toBeVisible()
  expect(attempts).toBe(1)
  await submit.click()
  await expect(email(page)).toHaveAccessibleDescription(/Darba e-pasts vai parole nav pareiza/)
  await password(page).fill('derīga-parole')
  await submit.click()
  await expect(page.getByRole('link', { name: 'Mans profils' })).toBeVisible()
})

test('short mobile viewport follows focus, respects safe areas and preserves the theme', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/#/login')
  await page.getByRole('heading', { name: loginTitle }).waitFor()
  await page.evaluate(() => {
    for (const [edge, inset] of [
      ['top', 24],
      ['bottom', 32],
      ['left', 5],
      ['right', 7],
    ]) {
      document.documentElement.style.setProperty(`--safe-area-inset-${edge}`, `${inset}px`)
    }
  })
  await page.getByRole('button', { name: 'Tumšs' }).click()
  await expect(page.locator('.v-application')).toHaveClass(/v-theme--dark/)
  await page.getByRole('link', { name: 'Reģistrēties' }).click()
  await expect(page.locator('header')).toHaveCSS('padding-top', '32px')
  await expect(page.locator('main')).toHaveCSS('padding-bottom', '56px')
  await confirmation(page).focus()
  await page.setViewportSize({ width: 390, height: 340 })
  await expect(confirmation(page)).toBeInViewport({ ratio: 1 })
  await expect(confirmation(page)).toBeFocused()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
  await page.getByRole('link', { name: 'Pieslēgties' }).click()
  await expect(page.getByRole('heading', { name: loginTitle })).toBeFocused()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
  await page.reload()
  await expect(page.locator('.v-application')).toHaveClass(/v-theme--dark/)
})
