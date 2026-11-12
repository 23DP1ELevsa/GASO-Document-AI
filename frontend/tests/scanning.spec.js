import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import sharp from 'sharp'
import { createHash } from 'node:crypto'

let files, rotated
test.beforeAll(async () => {
  const make = (number) =>
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200"><rect width="900" height="1200" fill="white"/><rect x="60" y="60" width="780" height="130" fill="#2458d3"/><text x="100" y="145" font-size="52" fill="white">TEST PAGE ${number}</text><path d="M80 300H800M80 370H800M80 440H600" stroke="#718096" stroke-width="12"/></svg>`,
    )
  files = [
    {
      name: 'lapa-1.jpg',
      mimeType: 'image/jpeg',
      buffer: await sharp(make(1)).jpeg({ quality: 95 }).toBuffer(),
    },
    { name: 'lapa-2.png', mimeType: 'image/png', buffer: await sharp(make(2)).png().toBuffer() },
    { name: 'lapa-3.webp', mimeType: 'image/webp', buffer: await sharp(make(3)).webp().toBuffer() },
  ]
  rotated = {
    name: 'orientation.jpg',
    mimeType: 'image/jpeg',
    buffer: await sharp({ create: { width: 300, height: 200, channels: 3, background: '#2458d3' } })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer(),
  }
})

function nav(page) {
  return page.getByRole('navigation', { name: 'Galvenā navigācija' }).filter({ visible: true })
}
async function count(page, number) {
  await expect(page.getByTestId('page-card')).toHaveCount(number)
  await expect(page.getByText('Apstrādā…', { exact: true })).toHaveCount(0)
}
async function save(page) {
  await page.getByRole('button', { name: 'Saglabāt melnrakstu', exact: true }).click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Melnraksts sekmīgi saglabāts' }),
  ).toBeVisible()
}
async function pageMenu(page, index, action) {
  const card = page.getByTestId('page-card').nth(index)
  await card.getByRole('button', { name: /lapas darbības/ }).click()
  await page.getByRole('button', { name: action, exact: true }).click()
}
async function storage(page) {
  return page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const r = indexedDB.open('gaso-document-ai', 1)
      r.onsuccess = () => resolve(r.result)
      r.onerror = () => reject(r.error)
    })
    try {
      const tx = db.transaction(['drafts', 'pages', 'images'], 'readonly')
      const request = (name) =>
        new Promise((resolve, reject) => {
          const r = tx.objectStore(name).getAll()
          r.onsuccess = () => resolve(r.result)
          r.onerror = () => reject(r.error)
        })
      const [drafts, pages, images] = await Promise.all(['drafts', 'pages', 'images'].map(request))
      const hashes = []
      for (const image of images)
        hashes.push(
          [...new Uint8Array(await crypto.subtle.digest('SHA-256', await image.blob.arrayBuffer()))]
            .map((b) => b.toString(16).padStart(2, '0'))
            .join(''),
        )
      return {
        drafts: drafts.map(({ cover, ...draft }) => ({
          ...draft,
          hasCover: cover instanceof Blob,
        })),
        pages: pages.map(({ thumbnail, ...p }) => ({
          ...p,
          hasThumbnail: thumbnail instanceof Blob,
        })),
        imageCount: images.length,
        hashes,
      }
    } finally {
      db.close()
    }
  })
}

test('import camera and gallery files; append, preview and release object URLs', async ({
  page,
}, testInfo) => {
  const requests = [],
    errors = []
  page.on('request', (request) => {
    if (
      !request.url().startsWith('http://127.0.0.1:4173') &&
      !request.url().startsWith('blob:') &&
      !request.url().startsWith('data:')
    )
      requests.push(request.url())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  await page.addInitScript(() => {
    window.activeBlobUrls = new Set()
    const create = URL.createObjectURL.bind(URL),
      revoke = URL.revokeObjectURL.bind(URL)
    URL.createObjectURL = (blob) => {
      const url = create(blob)
      window.activeBlobUrls.add(url)
      return url
    }
    URL.revokeObjectURL = (url) => {
      window.activeBlobUrls.delete(url)
      return revoke(url)
    }
  })
  await page.goto('/#/scan')
  const cameraChooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Fotografēt', exact: true }).click()
  await (await cameraChooser).setFiles(files[0])
  await count(page, 1)
  await page.getByTestId('gallery-input').setInputFiles(files.slice(1))
  await count(page, 3)
  await expect(page.getByTestId('page-card').getByRole('heading')).toHaveText(
    files.map((file) => file.name),
  )
  await page.getByRole('button', { name: 'Atvērt 1. lapas priekšskatījumu' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('img', { name: 'Oriģinālā attēla priekšskatījums' })).toBeVisible()
  await page.getByRole('button', { name: 'Aizvērt priekšskatījumu' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Atvērt 1. lapas priekšskatījumu' })).toBeFocused()
  expect(await page.evaluate(() => window.activeBlobUrls.size)).toBe(3)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('scan-with-pages.png'), fullPage: true })
  await nav(page).getByRole('link', { name: 'Iestatījumi', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Iestatījumi')
  await expect.poll(() => page.evaluate(() => window.activeBlobUrls.size)).toBe(0)
  await nav(page).getByRole('link', { name: 'Skenēt', exact: true }).click()
  await count(page, 3)
  expect(requests).toEqual([])
  expect(errors).toEqual([])
})

test('save, reload, reorder, replace and delete preserve blobs and page order atomically', async ({
  page,
}) => {
  await page.goto('/#/scan')
  await page.getByTestId('gallery-input').setInputFiles(files)
  await count(page, 3)
  await page.getByRole('button', { name: 'Pārvietot 3. lapu uz augšu' }).click()
  await expect(page.getByTestId('page-card').getByRole('heading')).toHaveText([
    files[0].name,
    files[2].name,
    files[1].name,
  ])
  await save(page)
  let stored = await storage(page)
  expect(stored.imageCount).toBe(3)
  expect(stored.hashes.sort()).toEqual(
    files.map((file) => createHash('sha256').update(file.buffer).digest('hex')).sort(),
  )
  for (const p of stored.pages) {
    expect(p.hasThumbnail).toBe(true)
    expect(Math.max(p.thumbnailWidth, p.thumbnailHeight)).toBeLessThanOrEqual(480)
    expect(p.original).toBeUndefined()
  }
  await page.reload()
  await count(page, 3)
  await expect(page.getByTestId('page-card').getByRole('heading')).toHaveText([
    files[0].name,
    files[2].name,
    files[1].name,
  ])
  // Full preview now reads just one original from IndexedDB.
  await page.getByRole('button', { name: 'Atvērt 2. lapas priekšskatījumu' }).click()
  await expect(page.getByRole('img', { name: 'Oriģinālā attēla priekšskatījums' })).toBeVisible()
  await page.getByRole('button', { name: 'Aizvērt priekšskatījumu' }).click()
  const chooser = page.waitForEvent('filechooser')
  await pageMenu(page, 1, 'Aizstāt attēlu')
  await (await chooser).setFiles(rotated)
  await count(page, 3)
  await expect(page.getByTestId('page-card').nth(1)).toContainText('200 × 300 px')
  await pageMenu(page, 0, 'Dzēst lapu')
  await count(page, 2)
  await save(page)
  stored = await storage(page)
  expect(stored.imageCount).toBe(2)
  expect(stored.pages).toHaveLength(2)
  expect(stored.hashes.sort()).toEqual(
    [files[1], rotated]
      .map((file) => createHash('sha256').update(file.buffer).digest('hex'))
      .sort(),
  )
  expect(stored.drafts[0].pageIds.map((id) => stored.pages.find((p) => p.id === id).name)).toEqual([
    rotated.name,
    files[1].name,
  ])
  await page.reload()
  await count(page, 2)
  await expect(page.getByTestId('page-card').getByRole('heading')).toHaveText([
    rotated.name,
    files[1].name,
  ])
})

test('draft list opens, continues and deletes sessions only after confirmation', async ({
  page,
}) => {
  await page.goto('/#/scan')
  await page.getByTestId('gallery-input').setInputFiles(files[0])
  await count(page, 1)
  await save(page)
  await page.getByRole('button', { name: 'Jauna sesija', exact: true }).click()
  await count(page, 0)
  await page.getByTestId('gallery-input').setInputFiles(files.slice(1))
  await count(page, 2)
  await save(page)
  await nav(page).getByRole('link', { name: 'Dokumenti', exact: true }).click()
  await expect(page.getByTestId('draft-card')).toHaveCount(2)
  await expect(page.getByTestId('draft-card').getByRole('img')).toHaveCount(2)
  await page
    .getByTestId('draft-card')
    .filter({ hasText: 'Lapas: 1' })
    .getByRole('button', { name: 'Turpināt', exact: true })
    .click()
  await count(page, 1)
  await page.getByTestId('gallery-input').setInputFiles(files[2])
  await count(page, 2)
  await save(page)
  await nav(page).getByRole('link', { name: 'Dokumenti', exact: true }).click()
  page.once('dialog', (dialog) => dialog.dismiss())
  await page
    .getByTestId('draft-card')
    .first()
    .getByRole('button', { name: 'Dzēst melnrakstu' })
    .click()
  await expect(page.getByTestId('draft-card')).toHaveCount(2)
  page.once('dialog', (dialog) => dialog.accept())
  await page
    .getByTestId('draft-card')
    .first()
    .getByRole('button', { name: 'Dzēst melnrakstu' })
    .click()
  await expect(page.getByTestId('draft-card')).toHaveCount(1)
  let stored = await storage(page)
  expect(stored.drafts).toHaveLength(1)
  expect(stored.pages).toHaveLength(2)
  expect(stored.imageCount).toBe(2)
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Dzēst melnrakstu' }).click()
  await expect(page.getByTestId('draft-card')).toHaveCount(0)
  stored = await storage(page)
  expect(stored.drafts).toHaveLength(0)
  expect(stored.pages).toHaveLength(0)
  expect(stored.imageCount).toBe(0)
})

test('reject invalid types, corrupt bytes and oversized rasters; cancellation keeps existing pages', async ({
  page,
}) => {
  await page.goto('/#/scan')
  await page.getByTestId('gallery-input').setInputFiles(files[0])
  await count(page, 1)
  for (const file of [
    { name: 'bad.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') },
    { name: 'fake.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('not an image') },
    { name: 'broken.png', mimeType: 'image/png', buffer: files[1].buffer.subarray(0, 25) },
    { name: 'too-large.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(25 * 1024 ** 2 + 1) },
  ]) {
    await page.getByTestId('gallery-input').setInputFiles(file)
    await expect(page.getByRole('alert')).toBeVisible()
    await count(page, 1)
  }
  const huge = Buffer.from(files[1].buffer)
  huge.writeUInt32BE(20000, 16)
  await page
    .getByTestId('gallery-input')
    .setInputFiles({ name: 'huge.png', mimeType: 'image/png', buffer: huge })
  await expect(page.getByRole('alert')).toContainText('40 megapikseļus')
  await count(page, 1)
  await page.getByTestId('gallery-input').setInputFiles([])
  await page.getByTestId('gallery-input').dispatchEvent('cancel')
  const chooser = page.waitForEvent('filechooser')
  await pageMenu(page, 0, 'Aizstāt attēlu')
  await (await chooser).setFiles([])
  await page.getByTestId('replacement-input').dispatchEvent('cancel')
  await count(page, 1)
  await expect(page.getByTestId('page-card').getByRole('heading')).toHaveText(files[0].name)
  await page.getByTestId('gallery-input').setInputFiles(files[0])
  await count(page, 2)
})

test('failed quota write rolls back all records and retry persists pending images', async ({
  page,
}) => {
  await page.goto('/#/scan')
  await page.getByTestId('gallery-input').setInputFiles(files.slice(0, 2))
  await count(page, 2)
  await page.evaluate(() => {
    window.realPut = IDBObjectStore.prototype.put
    let writes = 0
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'images' && ++writes === 2)
        throw new DOMException('Test quota', 'QuotaExceededError')
      return window.realPut.apply(this, args)
    }
  })
  await page.getByRole('button', { name: 'Saglabāt melnrakstu' }).click()
  await expect(page.getByRole('alert')).toContainText('nepietiek vietas')
  await expect(page.getByText('Melnraksts sekmīgi saglabāts', { exact: false })).toHaveCount(0)
  let stored = await storage(page)
  expect(stored.drafts).toHaveLength(0)
  expect(stored.pages).toHaveLength(0)
  expect(stored.imageCount).toBe(0)
  await count(page, 2)
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = window.realPut
  })
  await save(page)
  stored = await storage(page)
  expect(stored.imageCount).toBe(2)
})

test('unavailable IndexedDB gives a real error while in-memory scanning remains usable', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', {
      get() {
        throw new DOMException('Blocked', 'SecurityError')
      },
    })
  })
  await page.goto('/#/scan')
  await page.getByTestId('gallery-input').setInputFiles(files[0])
  await count(page, 1)
  await page.getByRole('button', { name: 'Saglabāt melnrakstu' }).click()
  await expect(page.getByRole('alert')).toContainText('Lokālā krātuve nav pieejama')
  await expect(page.getByRole('button', { name: 'Saglabāt melnrakstu' })).toBeEnabled()
  await nav(page).getByRole('link', { name: 'Dokumenti', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Lokālā krātuve nav pieejama')
  await expect(page.getByText('Vēl nav saglabātu melnrakstu', { exact: true })).toHaveCount(0)
})

test('empty saved session removes all unused image records, and full-session deletion is confirmed', async ({
  page,
}) => {
  await page.goto('/#/scan')
  await page.getByTestId('gallery-input').setInputFiles(files[0])
  await count(page, 1)
  await save(page)
  await pageMenu(page, 0, 'Dzēst lapu')
  await count(page, 0)
  await save(page)
  let stored = await storage(page)
  expect(stored.drafts).toHaveLength(1)
  expect(stored.drafts[0].hasCover).toBe(false)
  expect(stored.imageCount).toBe(0)
  expect(stored.pages).toHaveLength(0)
  await page.getByTestId('gallery-input').setInputFiles(files[1])
  await count(page, 1)
  page.once('dialog', (dialog) => dialog.dismiss())
  await page.getByRole('button', { name: 'Dzēst sesiju', exact: true }).click()
  await count(page, 1)
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Dzēst sesiju', exact: true }).click()
  await count(page, 0)
  stored = await storage(page)
  expect(stored.drafts).toHaveLength(0)
  expect(stored.imageCount).toBe(0)
})

test('many pages, both themes and page menus pass layout and accessibility checks', async ({
  page,
}, testInfo) => {
  await page.goto('/#/scan')
  await page.getByTestId('gallery-input').setInputFiles(
    Array.from({ length: 21 }, (_, index) => ({
      ...files[index % 3],
      name: `test-${index + 1}.jpg`,
    })),
  )
  await count(page, 20)
  await expect(page.getByRole('alert')).toContainText('ne vairāk kā 20 lapas')
  for (const dark of [false, true]) {
    if (dark) await page.locator('.theme-toggle').click()
    // Vuetify animates surface colors when the theme changes; measure the final colors.
    await page.waitForFunction(() =>
      document.getAnimations().every((animation) => animation.playState !== 'running'),
    )
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze()
    expect(
      result.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({ target: n.target, reason: n.failureSummary })),
      })),
    ).toEqual([])
  }
  await page
    .getByTestId('page-card')
    .first()
    .getByRole('button', { name: /lapas darbības/ })
    .click()
  const menuResult = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(
    menuResult.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
  ).toEqual([])
  await page.keyboard.press('Escape')
  await page.screenshot({ path: testInfo.outputPath('many-pages-dark.png'), fullPage: true })
  await save(page)
  await nav(page).getByRole('link', { name: 'Dokumenti', exact: true }).click()
  await expect(page.getByTestId('draft-card')).toHaveCount(1)
  // Contrast must be measured after the route's opacity transition finishes.
  await expect(page.locator('.page-enter-active')).toHaveCount(0)
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(
    result.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
  ).toEqual([])
})

test('new-session confirmation protects unsaved work and mixed batches keep valid images', async ({
  page,
}) => {
  await page.goto('/#/scan')
  await page
    .getByTestId('gallery-input')
    .setInputFiles([
      files[0],
      { name: 'bad.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a') },
      files[2],
    ])
  await count(page, 2)
  await expect(page.getByRole('alert')).toContainText('Neatbalstīts')
  page.once('dialog', (dialog) => dialog.dismiss())
  await page.getByRole('button', { name: 'Jauna sesija', exact: true }).click()
  await count(page, 2)
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Jauna sesija', exact: true }).click()
  await count(page, 0)
  await expect(page.getByRole('button', { name: 'Saglabāt melnrakstu' })).toBeDisabled()
})

test('a stale tab cannot overwrite a newer draft revision', async ({ page, context }) => {
  await page.goto('/#/scan')
  await page.getByTestId('gallery-input').setInputFiles(files.slice(0, 2))
  await count(page, 2)
  await save(page)
  const other = await context.newPage()
  await other.goto(page.url())
  await count(other, 2)
  await pageMenu(other, 0, 'Dzēst lapu')
  await count(other, 1)
  await save(other)
  await page.getByRole('button', { name: 'Pārvietot 2. lapu uz augšu' }).click()
  await page.getByRole('button', { name: 'Saglabāt melnrakstu' }).click()
  await expect(page.getByRole('alert')).toContainText('citā cilnē')
  const stored = await storage(page)
  expect(stored.drafts[0].revision).toBe(2)
  expect(stored.imageCount).toBe(1)
  await expect(page.getByTestId('page-card')).toHaveCount(2)
  await other.close()
})

test('saved image sessions reopen and accept changes offline without entering service-worker cache', async ({
  page,
  context,
}) => {
  await page.goto('/#/scan')
  await page.getByTestId('gallery-input').setInputFiles(files[0])
  await count(page, 1)
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
  await count(page, 1)
  await page.getByRole('button', { name: 'Atvērt 1. lapas priekšskatījumu' }).click()
  await expect(page.getByRole('img', { name: 'Oriģinālā attēla priekšskatījums' })).toBeVisible()
  await page.getByRole('button', { name: 'Aizvērt priekšskatījumu' }).click()
  await page.getByTestId('gallery-input').setInputFiles(files[1])
  await count(page, 2)
  await save(page)
  const cachePaths = await page.evaluate(async () => {
    const paths = []
    for (const key of await caches.keys())
      for (const request of await (await caches.open(key)).keys())
        paths.push(new URL(request.url).pathname)
    return paths
  })
  for (const path of cachePaths)
    expect(path).toMatch(
      /^\/(?:index\.html|assets\/[^/]+\.(?:js|css|woff2|ttf)|icons\/[^/]+\.png|icon\.svg|manifest\.webmanifest)$/,
    )
  await nav(page).getByRole('link', { name: 'Dokumenti', exact: true }).click()
  await expect(page.getByTestId('draft-card')).toHaveCount(1)
  await expect(page.getByTestId('draft-card')).toContainText('Lapas: 2')
})
