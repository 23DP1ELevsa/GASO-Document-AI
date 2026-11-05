import { test, expect } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const generator = fileURLToPath(new URL('../../backend/tools/generate-fixtures.php', import.meta.url))
const photo = fileURLToPath(new URL('../../backend/storage/app/test-fixtures/clear.jpg', import.meta.url))
test.beforeAll(() => { execFileSync('php', ['-d','extension=gd','-d','memory_limit=512M',generator]) })

test('real upload, detection, crop, six variants and mocked paid recognition', async ({ page }) => {
  const errors=[]; page.on('pageerror', error => errors.push(error.message))
  let paidCalls=0
  await page.route('**/api/recognize', async route => {
    paidCalls++
    expect(route.request().postDataBuffer().toString()).toContain('privacy_confirmed')
    await route.fulfill({ json: { reading: '03874', model: 'mock', tokens: { input: 100, cached_input: 0, output: 10 }, estimated_cost_usd: .0001 } })
  })
  await page.goto('/')
  await page.getByLabel('Fotogrāfija', { exact: true }).setInputFiles(photo)
  await expect(page.getByRole('heading', { name: '2. Atlasiet ciparu lodziņu' })).toBeVisible()
  await expect(page.getByText('Atrasts eksperimentāls lodziņa ieteikums.', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Salīdzināt 6 izmēra / kontrasta variantus' }).click()
  await expect(page.getByRole('button', { name: 'Izvēlēties variantu' })).toHaveCount(6)
  await page.getByRole('button', { name: 'Izvēlēties variantu' }).first().click()
  await expect(page.getByAltText('MI nosūtāmais fragments')).toBeVisible()
  const recognize=page.getByRole('button', { name: 'Sākt MI atpazīšanu (maksas API)', exact: true })
  await expect(recognize).toBeDisabled()
  await page.getByLabel('Apstiprinu:', { exact: false }).check()
  await page.getByLabel('Zināmais pareizais rādījums', { exact: false }).fill('03874')
  await recognize.click()
  await expect(page.locator('.reading')).toContainText('03874')
  await expect(page.getByText('Salīdzinājums: Sakrīt')).toBeVisible()
  expect(paidCalls).toBe(1)
  await page.screenshot({ path: '../.cache/prototype-desktop.png', fullPage: true })
  await page.getByLabel('Platums', { exact: true }).fill('0.4')
  await expect(page.getByAltText('MI nosūtāmais fragments')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('mobile drag, explicit privacy check and retryable null/error', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  let n=0
  await page.route('**/api/recognize', async route => {
    n++
    if(n===1) await route.fulfill({ json: { reading: null, model: 'mock', tokens: null, estimated_cost_usd: null } })
    else await route.fulfill({ status: 504, json: { message: 'MI pakalpojums nav sasniedzams. Mēģiniet vēlreiz.' } })
  })
  await page.goto('/')
  await page.getByLabel('Fotogrāfija', { exact: true }).setInputFiles(photo)
  const image=page.locator('.selection'); await expect(image).toBeVisible()
  const box=await image.boundingBox()
  await page.mouse.move(box.x+box.width*.25, box.y+box.height*.3)
  await page.mouse.down(); await page.mouse.move(box.x+box.width*.75, box.y+box.height*.5); await page.mouse.up()
  await page.getByRole('button', { name: 'Sagatavot fragmentu', exact: true }).click()
  await expect(page.getByAltText('MI nosūtāmais fragments')).toBeVisible()
  await page.getByLabel('Apstiprinu:', { exact: false }).check()
  await page.getByRole('button', { name: 'Sākt MI atpazīšanu (maksas API)' }).click()
  await expect(page.getByText('Rādījumu nevar droši atpazīt.', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Sākt MI atpazīšanu (maksas API)' }).click()
  await expect(page.getByRole('alert')).toContainText('Mēģiniet vēlreiz')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: '../.cache/prototype-mobile.png', fullPage: true })
})
