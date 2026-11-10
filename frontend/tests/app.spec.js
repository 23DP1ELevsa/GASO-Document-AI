import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const headings = {
  '/': 'Dokumentu kārtība sākas šeit.',
  '/scan': 'Dodiet papīram digitālu dzīvi.',
  '/documents': 'Vieta visiem svarīgajiem dokumentiem.',
  '/settings': 'Iestatījumi',
}

test('all four screens render without overflow, errors or external requests', async ({
  page,
}, testInfo) => {
  const errors = []
  const external = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('request', (request) => {
    if (!request.url().startsWith('http://127.0.0.1:4173') && !request.url().startsWith('data:'))
      external.push(request.url())
  })
  for (const [route, title] of Object.entries(headings)) {
    await page.goto(`/#${route}`)
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
    await expect(page.locator('.v-application')).toHaveClass(/v-theme--light/)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const navigation = page
      .getByRole('navigation', { name: 'Galvenā navigācija' })
      .filter({ visible: true })
    await expect(navigation).toBeVisible()
    await expect(navigation.getByRole('link')).toHaveCount(4)
    for (const link of await navigation.getByRole('link').all()) {
      const box = await link.boundingBox()
      expect(box.height).toBeGreaterThanOrEqual(44)
      expect(box.width).toBeGreaterThanOrEqual(44)
    }
    await page.screenshot({
      path: testInfo.outputPath(`${route === '/' ? 'home' : route.slice(1)}.png`),
      fullPage: true,
    })
  }
  expect(errors).toEqual([])
  expect(external).toEqual([])
})

test('navigation and browser back work without reloading the document', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    window.navigationSentinel = 'mounted'
  })
  await page.getByRole('link', { name: 'Skenēt dokumentu', exact: true }).click()
  await expect(page).toHaveURL(/#\/scan$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(headings['/scan'])
  const navigation = page
    .getByRole('navigation', { name: 'Galvenā navigācija' })
    .filter({ visible: true })
  await navigation.getByRole('link', { name: 'Dokumenti', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(headings['/documents'])
  await page.goBack()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(headings['/scan'])
  expect(await page.evaluate(() => window.navigationSentinel)).toBe('mounted')
})

test('appearance persists and applies to every screen', async ({ page }, testInfo) => {
  await page.goto('/#/settings')
  await page
    .getByRole('group', { name: 'Vizuālais režīms' })
    .getByRole('button', { name: 'Tumšs', exact: true })
    .click()
  await expect(page.locator('.v-application')).toHaveClass(/v-theme--dark/)
  await expect(
    page
      .getByRole('group', { name: 'Vizuālais režīms' })
      .getByRole('button', { name: 'Tumšs', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await page.reload()
  await expect(page.locator('.v-application')).toHaveClass(/v-theme--dark/)
  for (const route of Object.keys(headings)) {
    await page.goto(`/#${route}`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(headings[route])
    await expect(page.locator('.v-application')).toHaveClass(/v-theme--dark/)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({
      path: testInfo.outputPath(`dark-${route === '/' ? 'home' : route.slice(1)}.png`),
      fullPage: true,
    })
  }
  await page
    .getByRole('group', { name: 'Vizuālais režīms' })
    .getByRole('button', { name: 'Gaišs', exact: true })
    .click()
  await page.reload()
  await expect(page.locator('.v-application')).toHaveClass(/v-theme--light/)
})

test('browser capture inputs are available and new archive is empty', async ({ page }) => {
  await page.goto('/#/scan')
  await expect(page.getByRole('button', { name: 'Fotografēt', exact: true })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Pievienot no galerijas' })).toBeEnabled()
  await expect(page.getByTestId('camera-input')).toHaveAttribute('capture', 'environment')
  await expect(page.getByTestId('gallery-input')).toHaveAttribute('multiple', '')
  await expect(page.getByRole('button', { name: 'Saglabāt melnrakstu' })).toBeDisabled()
  await page.goto('/#/documents')
  await expect(page.getByRole('heading', { name: 'Vēl nav saglabātu melnrakstu' })).toBeVisible()
  await expect(page.locator('.count-badge')).toHaveText('0')
})

test('installed shell and unvisited routes open offline; cache holds only app assets', async ({
  page,
  context,
}) => {
  await page.goto('/')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller)
      await new Promise((resolve) =>
        navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }),
      )
  })
  const manifest = await (await page.request.get('/manifest.webmanifest')).json()
  expect(manifest.name).toBe('GASO Document AI')
  expect(manifest.icons.some((icon) => icon.purpose === 'maskable')).toBe(true)
  for (const icon of manifest.icons)
    expect((await page.request.get(`/${icon.src}`)).ok()).toBe(true)
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(headings['/'])
  for (const route of ['/scan', '/documents', '/settings']) {
    await page.goto(`/#${route}`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(headings[route])
  }
  const cacheUrls = await page.evaluate(async () => {
    const urls = []
    for (const key of await caches.keys())
      for (const request of await (await caches.open(key)).keys()) urls.push(request.url)
    return urls
  })
  expect(cacheUrls.length).toBeGreaterThan(5)
  for (const url of cacheUrls)
    expect(new URL(url).pathname).toMatch(
      /^\/(?:index\.html|assets\/[^/]+\.(?:js|css|woff2)|icons\/[^/]+\.png|icon\.svg|manifest\.webmanifest)$/,
    )
})

test('storage restriction does not prevent rendering or changing appearance', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('Blocked', 'SecurityError')
      },
    })
  })
  await page.goto('/#/settings')
  await page
    .getByRole('group', { name: 'Vizuālais režīms' })
    .getByRole('button', { name: 'Tumšs', exact: true })
    .click()
  await expect(page.locator('.v-application')).toHaveClass(/v-theme--dark/)
  await expect(
    page.getByText('Pārlūks neļauj saglabāt iestatījumus.', { exact: false }),
  ).toBeVisible()
})

test('unknown routes return home and repository link is safe', async ({ page }) => {
  await page.goto('/#/unknown')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(headings['/'])
  await page.goto('/#/settings')
  const link = page.getByRole('link', { name: /Projekts GitHub/ })
  await expect(link).toHaveAttribute('href', 'https://github.com/23DP1ELevsa/GASO-Document-AI')
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer')
})

test('screens pass automated WCAG AA checks in both themes', async ({ page }) => {
  for (const theme of ['light', 'dark']) {
    await page.goto('/#/settings')
    await page
      .getByRole('group', { name: 'Vizuālais režīms' })
      .getByRole('button', { name: theme === 'light' ? 'Gaišs' : 'Tumšs', exact: true })
      .click()
    for (const route of Object.keys(headings)) {
      await page.goto(`/#${route}`)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(headings[route])
      await expect(page.locator('.page-enter-active')).toHaveCount(0)
      const result = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
      expect(
        result.violations.map(({ id, nodes }) => ({
          id,
          nodes: nodes.map((node) => ({ target: node.target, reason: node.failureSummary })),
        })),
      ).toEqual([])
    }
  }
})

test('skip link preserves current route and mobile safe zones reserve space', async ({
  page,
}, testInfo) => {
  await page.goto('/#/documents')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Pāriet uz saturu' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('main')).toBeFocused()
  await expect(page).toHaveURL(/#\/documents$/)
  if (testInfo.project.name.startsWith('mobile')) {
    await page.evaluate(() => {
      document.documentElement.style.setProperty('--safe-area-inset-top', '24px')
      document.documentElement.style.setProperty('--safe-area-inset-bottom', '32px')
    })
    expect(
      await page
        .locator('.bottom-nav')
        .evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom)),
    ).toBeGreaterThanOrEqual(32)
    expect(
      await page.locator('.topbar').evaluate((el) => parseFloat(getComputedStyle(el).paddingTop)),
    ).toBeGreaterThanOrEqual(24)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
})
