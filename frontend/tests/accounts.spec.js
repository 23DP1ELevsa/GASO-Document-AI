import { expect, test } from '@playwright/test'
import { image } from '../test-support/uxFixtures.js'
import { employee } from '../test-support/authFixture.js'
import { fileURLToPath } from 'node:url'

test.use({ serviceWorkers: 'block' })

const other = {
  ...employee,
  id: '000000000000000000000002',
  firstName: 'Jānis',
  lastName: 'Testiņš',
  email: 'janis.testins@gaso.lv',
}

async function mockSessions(context, initial = null) {
  let signedIn = initial
  await context.route('**/api/auth/*', (route) => {
    const path = new URL(route.request().url()).pathname.split('/').at(-1)
    if (path === 'csrf-cookie') return route.fulfill({ status: 204 })
    if (path === 'login' || path === 'register') {
      const { email } = route.request().postDataJSON()
      signedIn = [employee, other].find((user) => user.email === email)
      return route.fulfill({ status: path === 'register' ? 201 : 200, json: signedIn })
    }
    if (path === 'logout') {
      expect(route.request().headers()['x-gaso-account']).toBe(signedIn.id)
      signedIn = null
      return route.fulfill({ status: 204 })
    }
    if (path === 'stats') return route.fulfill({ json: { documents: 0, collections: 0 } })
    return signedIn
      ? route.fulfill({ json: signedIn })
      : route.fulfill({ status: 401, json: { error: { code: 'unauthenticated' } } })
  })
  await context.route('**/api/storage/v1/status', (route) =>
    route.fulfill({ json: { status: 'connected', driver: 'mongodb' } }),
  )
}

async function login(page, user) {
  await page.getByRole('textbox', { name: 'Darba e-pasts' }).fill(user.email)
  await page.getByLabel('Parole', { exact: true }).fill('sintetiska-parole-123')
  await page.getByRole('button', { name: 'Pieslēgties' }).click()
  await expect(page.getByRole('link', { name: 'Mans profils' })).toBeVisible({ timeout: 20_000 })
}

async function logout(page) {
  await page.goto('/#/profile')
  await page.getByRole('button', { name: 'Izrakstīties' }).click()
  await expect(page.getByRole('heading', { name: 'Pieslēgties' })).toBeVisible({ timeout: 20_000 })
}

test('account changes isolate drafts, queue and preferences and abort active sync', async ({
  page,
  context,
}) => {
  await mockSessions(context)
  await page.goto('/#/documents')
  await expect(page.getByRole('heading', { name: 'Pieslēgties' })).toBeVisible()
  await login(page, employee)
  await page.goto('/#/profile')
  await expect(page.getByRole('heading', { name: 'Anna Testiņa' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Anna Testiņa' })).toBeVisible()
  const secondTab = await context.newPage()
  await secondTab.goto('/#/profile')
  await expect(secondTab.getByRole('heading', { name: 'Anna Testiņa' })).toBeVisible()

  await page.goto('/#/scan')
  await page.getByTestId('gallery-input').setInputFiles(await image(0))
  await expect(page.getByTestId('page-card')).toHaveCount(1)
  await page.getByRole('button', { name: 'Saglabāt melnrakstu' }).click()
  await expect(page).toHaveURL(/draft=/)

  let release
  const hold = new Promise((resolve) => {
    release = resolve
  })
  await context.route('**/api/storage/v1/assets/check', async (route) => {
    await hold
    await route.fulfill({ json: { assets: [], invalid: [] } }).catch(() => {})
  })
  await page.goto('/#/settings')
  const backupStarted = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Lejupielādēt lokālo rezerves kopiju' }).click()
  const backup = await (await backupStarted).path()
  page.on('dialog', (dialog) => dialog.accept())
  await page.getByRole('checkbox', { name: 'Sinhronizēt turpmākās izmaiņas ar MongoDB' }).check()
  const started = page.waitForRequest('**/api/storage/v1/assets/check')
  await page.getByRole('button', { name: 'Migrēt lokālos dokumentus' }).click()
  expect((await started).headers()['x-gaso-account']).toBe(employee.id)
  const aborted = page.waitForEvent('requestfailed', {
    predicate: (request) => request.url().endsWith('/assets/check'),
  })
  await logout(page)
  await aborted
  release()
  await expect(secondTab.getByRole('heading', { name: 'Pieslēgties' })).toBeVisible()
  await secondTab.close()
  await login(page, other)
  await page.goto('/#/documents')
  await expect(page.getByTestId('draft-card')).toHaveCount(0)
  await page.goto('/#/settings')
  await expect(
    page.getByRole('checkbox', { name: 'Sinhronizēt turpmākās izmaiņas ar MongoDB' }),
  ).not.toBeChecked()
  await expect(page.getByText(/Rindā \d+ ieraksti/)).toHaveCount(0)
  await page.locator('input[accept=".gaso-backup"]').setInputFiles(backup)
  await expect(page.getByText(/Rezerves kopija pieder citam kontam/)).toBeVisible()

  await logout(page)
  await login(page, employee)
  await page.goto('/#/documents')
  await expect(page.getByTestId('draft-card')).toHaveCount(1)
  await page.goto('/#/settings')
  await expect(
    page.getByRole('checkbox', { name: 'Sinhronizēt turpmākās izmaiņas ar MongoDB' }),
  ).toBeChecked()
  const names = await page.evaluate(async () =>
    (await indexedDB.databases()).map(({ name }) => name),
  )
  expect(names).toContain('gaso-document-ai:account:' + employee.id)
  expect(names).toContain('gaso-document-ai:account:' + other.id)
})

test('real Laravel cookies restore the session and protect writes with CSRF', async ({
  page,
  context,
}) => {
  test.skip(
    process.env.GASO_E2E_REAL_AUTH !== '1',
    'Requires a dedicated loopback Laravel test backend',
  )
  test.setTimeout(120_000)
  await page.goto('/#/profile')
  await expect(page.getByRole('heading', { name: 'Pieslēgties' })).toBeVisible({ timeout: 20_000 })
  const missing = await page.evaluate(async () => {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: '{}',
    })
    return response.status
  })
  expect(missing).toBe(419)

  await page.getByRole('link', { name: 'Izveidot kontu' }).click()
  await page.getByRole('textbox', { name: 'Vārds', exact: true }).fill('Austra')
  await page.getByRole('textbox', { name: 'Uzvārds', exact: true }).fill('Sintētiska')
  const email =
    'austra.' +
    Array.from(crypto.randomUUID().slice(0, 8), (char) =>
      String.fromCharCode(97 + parseInt(char, 16)),
    ).join('') +
    '@gaso.lv'
  await page.getByRole('textbox', { name: 'Darba e-pasts' }).fill(email)
  await page.getByLabel('Parole', { exact: true }).fill('sintetiska-parole-123')
  await page.getByLabel('Paroles apstiprinājums', { exact: true }).fill('sintetiska-parole-123')
  await page.getByRole('button', { name: 'Reģistrēties' }).click()
  await expect(page.getByRole('link', { name: 'Mans profils' })).toBeVisible({ timeout: 30_000 })
  expect(
    (await context.cookies()).some((cookie) => cookie.httpOnly && cookie.name.endsWith('_session')),
  ).toBe(true)
  await page.goto('/#/profile')
  await page.reload()
  await expect(page.getByText(email)).toBeVisible({ timeout: 20_000 })
  const denied = await page.evaluate(async () => {
    const user = await (
      await fetch('/api/auth/me', { headers: { Accept: 'application/json' } })
    ).json()
    const response = await fetch('/api/storage/v1/assets/check', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-GASO-Storage': '1',
        'X-GASO-Account': user.id,
      },
      body: JSON.stringify({ hashes: ['a'.repeat(64)] }),
    })
    return response.status
  })
  expect(denied).toBe(419)
  await logout(page)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Pieslēgties' })).toBeVisible({ timeout: 20_000 })
  await login(page, { email })
})

test('legacy IndexedDB stays hidden until an explicit idempotent assignment', async ({
  page,
  context,
}) => {
  await mockSessions(context, employee)
  await page.goto('/icon.svg')
  await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open('gaso-document-ai', 1)
        request.onupgradeneeded = () => {
          request.result.createObjectStore('drafts', { keyPath: 'id' }).add({
            id: 'unowned',
            pageIds: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            revision: 1,
          })
        }
        request.onsuccess = () => {
          request.result.close()
          resolve()
        }
        request.onerror = () => reject(request.error)
      }),
  )
  await page.goto('/#/documents')
  await expect(page.getByTestId('draft-card')).toHaveCount(0)
  await page.addScriptTag({
    path: fileURLToPath(new URL('../../tools/assign-legacy-indexeddb.js', import.meta.url)),
  })
  const dry = await page.evaluate(
    (email) => window.assignGasoLegacyIndexedDb(email),
    employee.email,
  )
  expect(dry).toMatchObject({ dryRun: true, state: 'empty', counts: { drafts: 1 } })
  await expect(page.getByTestId('draft-card')).toHaveCount(0)
  for (let attempt = 0; attempt < 2; attempt++) {
    const applied = await page.evaluate(
      (email) => window.assignGasoLegacyIndexedDb(email, { apply: true }),
      employee.email,
    )
    expect(applied.state).toBe('assigned')
  }
  await page.reload()
  await expect(page.getByTestId('draft-card')).toHaveCount(1)
})
