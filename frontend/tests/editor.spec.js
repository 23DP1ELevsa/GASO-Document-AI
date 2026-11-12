import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import sharp from 'sharp'
import { createHash } from 'node:crypto'

let photo, plain, thumbnail
const corners = [
  { x: 0.15, y: 0.1333 },
  { x: 0.825, y: 0.1833 },
  { x: 0.775, y: 0.8917 },
  { x: 0.11875, y: 0.7833 },
]
test.beforeAll(async () => {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#353e4a"/><polygon points="120,80 660,110 620,535 95,470" fill="#eee9df"/><path d="M170 175L590 198M160 220L580 243M150 265L570 290M145 310L560 338" stroke="#445266" stroke-width="4"/><rect x="240" y="350" width="120" height="65" fill="#3568b5"/><text x="190" y="150" font-size="24" fill="#202832">SYNTHETIC TEST</text></svg>'
  photo = {
    name: 'perspective-test.png',
    mimeType: 'image/png',
    buffer: await sharp(Buffer.from(svg)).png().toBuffer(),
  }
  plain = {
    name: 'plain.png',
    mimeType: 'image/png',
    buffer: await sharp({ create: { width: 800, height: 600, channels: 3, background: '#fafafa' } })
      .png()
      .toBuffer(),
  }
  thumbnail = await sharp(photo.buffer)
    .resize({ width: 480, height: 480, fit: 'inside' })
    .jpeg()
    .toBuffer()
})
const nav = (page) =>
  page.getByRole('navigation', { name: 'Galvenā navigācija' }).filter({ visible: true })
async function importPhoto(page, files = photo) {
  await page.goto('/#/scan')
  await page.getByTestId('gallery-input').setInputFiles(files)
  await expect(page.getByText('Apstrādā…', { exact: true })).toHaveCount(0)
  await expect(page.getByTestId('page-card')).toHaveCount(Array.isArray(files) ? files.length : 1)
}
async function ready(dialog) {
  await expect(dialog.getByText('Apstrādā attēlu…', { exact: false })).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Priekšskatīt', exact: true })).toBeEnabled()
}
async function openEditor(page, index = 0) {
  await page
    .getByTestId('page-card')
    .nth(index)
    .getByRole('button', { name: /lapas darbības/ })
    .click()
  await page.getByRole('button', { name: 'Rediģēt skenējumu', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Rediģēt skenējumu', exact: true })
  await expect(dialog.getByRole('img', { name: 'Oriģināls un stūri', exact: true })).toBeVisible()
  await expect(
    dialog.getByRole('img', { name: 'Apstrādātais skenējums', exact: true }),
  ).toBeVisible()
  await ready(dialog)
  await page.waitForFunction(() =>
    document.getAnimations().every((animation) => animation.playState !== 'running'),
  )
  return dialog
}
async function setCorners(dialog, points = corners) {
  const details = dialog.locator('.corner-numeric')
  if (!(await details.evaluate((el) => el.open))) await details.locator('summary').click()
  for (let i = 0; i < 4; i++)
    for (const axis of ['x', 'y'])
      await dialog
        .getByRole('spinbutton', { name: `${i + 1}. stūra ${axis.toUpperCase()} (%)`, exact: true })
        .fill(String(points[i][axis] * 100))
}
async function preview(dialog) {
  await dialog.getByRole('button', { name: 'Priekšskatīt', exact: true }).click()
  await ready(dialog)
}
async function apply(page, dialog) {
  await dialog.getByRole('button', { name: 'Apstiprināt izmaiņas', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
}
async function save(page) {
  await page
    .getByRole('button', { name: /^(Saglabāt melnrakstu|Mēģināt saglabāt vēlreiz)$/, exact: true })
    .click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Melnraksts sekmīgi saglabāts' }),
  ).toBeVisible()
}
async function state(page) {
  return page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const r = indexedDB.open('gaso-document-ai', 1)
      r.onsuccess = () => resolve(r.result)
      r.onerror = () => reject(r.error)
    })
    const version = db.version
    const tx = db.transaction(['drafts', 'pages', 'images'], 'readonly')
    const all = (name) =>
      new Promise((resolve, reject) => {
        const r = tx.objectStore(name).getAll()
        r.onsuccess = () => resolve(r.result)
        r.onerror = () => reject(r.error)
      })
    const [drafts, pages, records] = await Promise.all(['drafts', 'pages', 'images'].map(all))
    db.close()
    const images = []
    for (const record of records) {
      const originalHash = [
        ...new Uint8Array(await crypto.subtle.digest('SHA-256', await record.blob.arrayBuffer())),
      ]
        .map((x) => x.toString(16).padStart(2, '0'))
        .join('')
      let stats = null
      if (record.processed) {
        const bitmap = await createImageBitmap(record.processed),
          canvas = document.createElement('canvas')
        canvas.width = bitmap.width
        canvas.height = bitmap.height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(bitmap, 0, 0)
        bitmap.close()
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
        let colored = 0,
          binary = true,
          black = 0,
          white = 0
        for (let i = 0; i < data.length; i += 4) {
          if (data[i] !== data[i + 1] || data[i] !== data[i + 2]) colored++
          if (![0, 255].includes(data[i]) || data[i] !== data[i + 1] || data[i] !== data[i + 2])
            binary = false
          if (data[i] === 0) black++
          if (data[i] === 255) white++
        }
        stats = { width: canvas.width, height: canvas.height, colored, binary, black, white }
        canvas.width = 0
        canvas.height = 0
      }
      images.push({
        id: record.id,
        originalHash,
        processedType: record.processed?.type || null,
        stats,
      })
    }
    return {
      version,
      drafts: drafts.map(({ cover, ...draft }) => draft),
      pages: pages.map(({ thumbnail, ...p }) => p),
      images,
    }
  })
}

test('automatic corners, manual coordinates, perspective and parameters survive save and reload', async ({
  page,
}, testInfo) => {
  const external = []
  page.on('request', (r) => {
    if (
      !r.url().startsWith('http://127.0.0.1:4173') &&
      !r.url().startsWith('blob:') &&
      !r.url().startsWith('data:')
    )
      external.push(r.url())
  })
  await importPhoto(page)
  const dialog = await openEditor(page)
  await expect(
    dialog.getByText('Atrasts iespējams dokumenta četrstūris.', { exact: false }),
  ).toBeVisible()
  await setCorners(dialog)
  await preview(dialog)
  await dialog.locator('.scan-editor').evaluate((el) => {
    el.scrollTop = 0
  })
  await page.screenshot({ path: testInfo.outputPath('editor.png'), fullPage: false })
  await apply(page, dialog)
  await expect(page.getByTestId('page-card')).toContainText('Apstrādāts')
  await save(page)
  let stored = await state(page)
  expect(stored.version).toBe(1)
  expect(stored.pages[0].processing.filter).toBe('original')
  stored.pages[0].processing.corners.forEach((p, i) => {
    expect(p.x).toBeCloseTo(corners[i].x, 4)
    expect(p.y).toBeCloseTo(corners[i].y, 4)
  })
  expect(stored.images[0].originalHash).toBe(
    createHash('sha256').update(photo.buffer).digest('hex'),
  )
  expect(stored.images[0].processedType).toBe('image/png')
  expect(stored.images[0].stats.width).toBeGreaterThan(520)
  expect(stored.images[0].stats.width).toBeLessThan(560)
  expect(stored.images[0].stats.height).toBeGreaterThan(420)
  expect(stored.images[0].stats.height).toBeLessThan(460)
  await page.reload()
  await expect(page.getByTestId('page-card')).toContainText('Apstrādāts')
  const reopened = await openEditor(page)
  await setCorners(reopened, stored.pages[0].processing.corners)
  await expect(reopened.getByRole('button', { name: 'Apstiprināt izmaiņas' })).toBeDisabled()
  await reopened.getByRole('button', { name: 'Atcelt rediģēšanu', exact: true }).last().click()
  expect(external).toEqual([])
})

test('invalid corners are blocked, drag and keyboard movement respect scaled coordinates', async ({
  page,
  context,
}, testInfo) => {
  await importPhoto(page, plain)
  const dialog = await openEditor(page)
  await expect(
    dialog.getByText('Dokumenta robežas nevar droši noteikt.', { exact: false }),
  ).toBeVisible()
  const board = await dialog.getByTestId('corner-board').boundingBox()
  const point = await dialog.getByTestId('corner-0').boundingBox()
  if (testInfo.project.name.startsWith('mobile')) {
    const cdp = await context.newCDPSession(page)
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: point.x + 22, y: point.y + 22 }],
    })
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: board.x + board.width * 0.1, y: board.y + board.height * 0.1 }],
    })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await cdp.detach()
  } else {
    await page.mouse.move(point.x + 22, point.y + 22)
    await page.mouse.down()
    await page.mouse.move(board.x + board.width * 0.1, board.y + board.height * 0.1, { steps: 5 })
    await page.mouse.up()
  }
  await dialog.locator('.corner-numeric summary').click()
  // Pointer coordinates are quantized to physical pixels by the emulated device.
  const xInput = dialog.getByRole('spinbutton', { name: '1. stūra X (%)', exact: true })
  const yInput = dialog.getByRole('spinbutton', { name: '1. stūra Y (%)', exact: true })
  expect(Math.abs(Number(await xInput.inputValue()) / 100 - 0.1) * board.width).toBeLessThanOrEqual(
    1,
  )
  expect(
    Math.abs(Number(await yInput.inputValue()) / 100 - 0.1) * board.height,
  ).toBeLessThanOrEqual(1)
  await xInput.fill('10')
  await dialog.getByTestId('corner-0').focus()
  await page.keyboard.press('ArrowRight')
  await expect(dialog.getByRole('spinbutton', { name: '1. stūra X (%)', exact: true })).toHaveValue(
    '10.2',
  )
  await dialog.locator('#editor-zoom').focus()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  const zoomed = await dialog.getByTestId('corner-board').boundingBox()
  expect(zoomed.width).toBeGreaterThan(board.width * 1.45)
  const handle = await dialog.getByTestId('corner-0').boundingBox()
  await page.mouse.move(handle.x + 22, handle.y + 22)
  await page.mouse.down()
  await page.mouse.move(zoomed.x + zoomed.width * 0.2, zoomed.y + zoomed.height * 0.2, { steps: 4 })
  await page.mouse.up()
  expect(
    Math.abs(Number(await xInput.inputValue()) / 100 - 0.2) * zoomed.width,
  ).toBeLessThanOrEqual(1)
  await dialog.getByRole('spinbutton', { name: '1. stūra X (%)', exact: true }).fill('100')
  await dialog.getByRole('spinbutton', { name: '1. stūra Y (%)', exact: true }).fill('100')
  await expect(dialog.getByRole('button', { name: 'Priekšskatīt', exact: true })).toBeDisabled()
  await expect(dialog.getByRole('button', { name: 'Apstiprināt izmaiņas' })).toBeDisabled()
  await expect(dialog.getByRole('alert')).toContainText('nepārkrustojošs')
  await dialog.getByRole('button', { name: 'Atiestatīt stūrus', exact: true }).click()
  await ready(dialog)
  await expect(dialog.getByRole('button', { name: 'Priekšskatīt', exact: true })).toBeEnabled()
})

test('right-angle rotations, all filters and restore always start from the unchanged original', async ({
  page,
}) => {
  await importPhoto(page)
  let dialog = await openEditor(page)
  await dialog.getByRole('button', { name: '90° pa labi', exact: true }).click()
  await ready(dialog)
  await dialog.getByRole('button', { name: 'Pelēktoņi', exact: true }).click()
  await ready(dialog)
  await apply(page, dialog)
  await save(page)
  let stored = await state(page)
  expect(stored.pages[0].processing.rotation).toBe(90)
  expect(stored.pages[0].processing.filter).toBe('grayscale')
  expect(stored.images[0].stats.colored).toBe(0)
  expect(stored.images[0].stats.height).toBeGreaterThan(stored.images[0].stats.width)
  dialog = await openEditor(page)
  await dialog.getByRole('button', { name: '90° pa kreisi', exact: true }).click()
  await ready(dialog)
  await dialog.getByRole('button', { name: '180°', exact: true }).click()
  await ready(dialog)
  await dialog.getByRole('button', { name: 'Melnbalts', exact: true }).click()
  await ready(dialog)
  await apply(page, dialog)
  await save(page)
  stored = await state(page)
  expect(stored.pages[0].processing.rotation).toBe(180)
  expect(stored.images[0].stats.binary).toBe(true)
  expect(stored.images[0].stats.black).toBeGreaterThan(100)
  expect(stored.images[0].stats.white).toBeGreaterThan(1000)
  dialog = await openEditor(page)
  await dialog.getByRole('button', { name: 'Uzlabots', exact: true }).click()
  await ready(dialog)
  await dialog.getByRole('button', { name: 'Atiestatīt pagriezienu', exact: true }).click()
  await ready(dialog)
  await apply(page, dialog)
  await save(page)
  stored = await state(page)
  expect(stored.pages[0].processing.filter).toBe('enhanced')
  expect(stored.images[0].stats.colored).toBeGreaterThan(1000)
  dialog = await openEditor(page)
  await dialog.getByRole('button', { name: 'Atjaunot oriģinālu', exact: true }).click()
  await ready(dialog)
  await apply(page, dialog)
  await save(page)
  stored = await state(page)
  expect(stored.pages[0].processing).toBeNull()
  expect(stored.images[0].processedType).toBeNull()
  expect(stored.pages[0].processedWidth).toBe(800)
  expect(stored.pages[0].processedHeight).toBe(600)
  expect(stored.images[0].originalHash).toBe(
    createHash('sha256').update(photo.buffer).digest('hex'),
  )
})

test('legacy v1 records remain readable and editing is non-destructive when canceled', async ({
  page,
}) => {
  await page.goto('/#/settings')
  await page.evaluate(
    async ({ original, small }) => {
      const db = await new Promise((resolve, reject) => {
        const r = indexedDB.open('gaso-document-ai', 1)
        r.onupgradeneeded = () => {
          for (const name of ['drafts', 'pages', 'images'])
            r.result.createObjectStore(name, { keyPath: 'id' })
        }
        r.onsuccess = () => resolve(r.result)
        r.onerror = () => reject(r.error)
      })
      const blob = new Blob([new Uint8Array(original)], { type: 'image/png' }),
        thumb = new Blob([new Uint8Array(small)], { type: 'image/jpeg' })
      await new Promise((resolve, reject) => {
        const tx = db.transaction(['drafts', 'pages', 'images'], 'readwrite')
        tx.oncomplete = resolve
        tx.onabort = () => reject(tx.error)
        tx.objectStore('drafts').put({
          id: 'legacy-draft',
          createdAt: 1700000000000,
          updatedAt: 1700000000000,
          status: 'draft',
          revision: 1,
          pageIds: ['legacy-page'],
          cover: thumb,
        })
        tx.objectStore('pages').put({
          id: 'legacy-page',
          name: 'legacy.png',
          mime: 'image/png',
          size: blob.size,
          width: 800,
          height: 600,
          thumbnail: thumb,
          thumbnailWidth: 480,
          thumbnailHeight: 360,
        })
        tx.objectStore('images').put({ id: 'legacy-page', blob })
      })
      db.close()
    },
    { original: [...photo.buffer], small: [...thumbnail] },
  )
  await page.goto('/#/scan?draft=legacy-draft')
  await expect(page.getByTestId('page-card')).toHaveCount(1)
  const before = await state(page)
  let dialog = await openEditor(page)
  await dialog.getByRole('button', { name: 'Melnbalts', exact: true }).click()
  await ready(dialog)
  await dialog.getByRole('button', { name: 'Atcelt rediģēšanu', exact: true }).last().click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(await state(page)).toEqual(before)
  await expect(page.locator('.workspace-savebar button')).toBeDisabled()
  dialog = await openEditor(page)
  await apply(page, dialog)
  await save(page)
  await page.reload()
  await expect(page.getByTestId('page-card')).toContainText('Apstrādāts')
  const stored = await state(page)
  expect(stored.version).toBe(1)
  expect(stored.images[0].originalHash).toBe(before.images[0].originalHash)
})

test('editing multiple pages survives reordering, replacement and deletion without orphaned results', async ({
  page,
}) => {
  await importPhoto(page, [photo, { ...photo, name: 'second.png' }])
  let dialog = await openEditor(page, 0)
  await dialog.getByRole('button', { name: 'Pelēktoņi', exact: true }).click()
  await ready(dialog)
  await apply(page, dialog)
  dialog = await openEditor(page, 1)
  await dialog.getByRole('button', { name: 'Melnbalts', exact: true }).click()
  await ready(dialog)
  await apply(page, dialog)
  await page.getByRole('button', { name: 'Pārvietot 2. lapu uz augšu' }).click()
  await save(page)
  await page.reload()
  let stored = await state(page)
  expect(
    stored.drafts[0].pageIds.map((id) => stored.pages.find((p) => p.id === id).processing.filter),
  ).toEqual(['bw', 'grayscale'])
  await page
    .getByTestId('page-card')
    .first()
    .getByRole('button', { name: /lapas darbības/ })
    .click()
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Aizstāt attēlu', exact: true }).click()
  await (await chooser).setFiles(plain)
  await expect(page.getByText('Apstrādā…', { exact: true })).toHaveCount(0)
  await save(page)
  stored = await state(page)
  expect(stored.images.filter((i) => i.processedType)).toHaveLength(1)
  expect(stored.pages.find((p) => p.name === plain.name).processing).toBeUndefined()
  await page
    .getByTestId('page-card')
    .last()
    .getByRole('button', { name: /lapas darbības/ })
    .click()
  await page.getByRole('button', { name: 'Dzēst lapu', exact: true }).click()
  await save(page)
  stored = await state(page)
  expect(stored.images).toHaveLength(1)
  expect(stored.images[0].processedType).toBeNull()
})

test('worker failure and cancellation preserve the session, with no overlapping requests', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const Native = window.Worker
    window.terminatedProcessors = 0
    window.Worker = class extends Native {
      postMessage(data, options) {
        if (window.failRender && data.action === 'render') {
          queueMicrotask(() => this.dispatchEvent(new ErrorEvent('error', { cancelable: true })))
          return
        }
        if (window.stallRender && data.action === 'render') return
        super.postMessage(data, options)
      }
      terminate() {
        window.terminatedProcessors++
        super.terminate()
      }
    }
  })
  await importPhoto(page)
  await save(page)
  const before = await state(page)
  let dialog = await openEditor(page)
  await page.evaluate(() => {
    window.failRender = true
  })
  await dialog.getByRole('button', { name: 'Pelēktoņi', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('apstrāde neizdevās')
  await dialog.getByRole('button', { name: 'Atcelt rediģēšanu', exact: true }).last().click()
  expect(await state(page)).toEqual(before)
  await page.evaluate(() => {
    window.failRender = false
  })
  dialog = await openEditor(page)
  await page.evaluate(() => {
    window.stallRender = true
  })
  await dialog.getByRole('button', { name: 'Pelēktoņi', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'Uzlabots', exact: true })).toBeDisabled()
  const terminated = await page.evaluate(() => window.terminatedProcessors)
  await dialog.getByRole('button', { name: 'Atcelt rediģēšanu', exact: true }).last().click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(await page.evaluate(() => window.terminatedProcessors)).toBeGreaterThan(terminated)
  expect(await state(page)).toEqual(before)
})

test('editor remains accessible in both themes and can process saved images offline', async ({
  page,
  context,
}) => {
  await importPhoto(page)
  await save(page)
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller)
      await new Promise((resolve) =>
        navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }),
      )
  })
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByTestId('page-card')).toHaveCount(1)
  let dialog = await openEditor(page)
  for (const dark of [false, true]) {
    if (dark) {
      await dialog.getByRole('button', { name: 'Atcelt rediģēšanu', exact: true }).last().click()
      await page.locator('.theme-toggle').click()
      dialog = await openEditor(page)
    }
    await page.waitForFunction(() =>
      document.getAnimations().every((a) => a.playState !== 'running'),
    )
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze()
    expect(
      result.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({ target: n.target, reason: n.failureSummary })),
      })),
    ).toEqual([])
    expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
  }
  await apply(page, dialog)
  await save(page)
  await nav(page).getByRole('link', { name: 'Dokumenti', exact: true }).click()
  await expect(page.getByTestId('draft-card')).toHaveCount(1)
})

test('EXIF-oriented originals retain their coordinate system through editing', async ({ page }) => {
  const oriented = {
    name: 'oriented.jpg',
    mimeType: 'image/jpeg',
    buffer: await sharp({ create: { width: 300, height: 200, channels: 3, background: '#456a9b' } })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer(),
  }
  await importPhoto(page, oriented)
  await expect(page.getByTestId('page-card')).toContainText('200 × 300 px')
  const dialog = await openEditor(page)
  await dialog.getByRole('button', { name: '90° pa labi', exact: true }).click()
  await ready(dialog)
  await apply(page, dialog)
  await save(page)
  const stored = await state(page)
  expect(stored.images[0].stats.width).toBe(300)
  expect(stored.images[0].stats.height).toBe(200)
  expect(stored.images[0].originalHash).toBe(
    createHash('sha256').update(oriented.buffer).digest('hex'),
  )
})

test('failed processed-image commit rolls back to the saved original and allows retry', async ({
  page,
}) => {
  await importPhoto(page)
  await save(page)
  const before = await state(page)
  const dialog = await openEditor(page)
  await apply(page, dialog)
  await page.evaluate(() => {
    window.realImagePut = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'images' && args[0].processed)
        throw new DOMException('Test quota', 'QuotaExceededError')
      return window.realImagePut.apply(this, args)
    }
  })
  await page.getByRole('button', { name: 'Saglabāt melnrakstu' }).click()
  await expect(page.getByRole('alert')).toContainText('nepietiek vietas')
  expect(await state(page)).toEqual(before)
  await expect(page.getByTestId('page-card')).toContainText('Apstrādāts')
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = window.realImagePut
  })
  await save(page)
  const after = await state(page)
  expect(after.images[0].processedType).toBe('image/png')
  expect(after.images[0].originalHash).toBe(before.images[0].originalHash)
})
