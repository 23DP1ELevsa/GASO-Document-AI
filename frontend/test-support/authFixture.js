import { test as base } from '@playwright/test'

export const employee = {
  id: '000000000000000000000001',
  firstName: 'Anna',
  lastName: 'Testiņa',
  email: 'anna.testina@gaso.lv',
  createdAt: '2026-11-24T00:00:00.000Z',
}

export async function allowEmployee(context) {
  await context.route('**/api/auth/me', (route) => route.fulfill({ json: employee }))
  await context.route('**/api/auth/stats', (route) =>
    route.fulfill({ json: { documents: 0, collections: 0 } }),
  )
  await context.route('**/api/storage/v1/status', (route) =>
    route.fulfill({ status: 503, json: { error: { code: 'storage_disabled' } } }),
  )
}

export const test = base.extend({
  context: async ({ context }, use) => {
    await allowEmployee(context)
    await use(context)
  },
})

export { expect } from '@playwright/test'
