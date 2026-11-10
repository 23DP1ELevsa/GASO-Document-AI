import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// Real browser canvas documents with known transcriptions; no worker mocking.
async function documentImage(page, text, name = 'synthetic.png', options = {}) {
  const base64 = await page.evaluate(
    ({ text, options }) => {
      const canvas = document.createElement('canvas')
      canvas.width = 1500
      canvas.height = 1100
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = options.dim ? '#939189' : '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = options.dim ? '#45433e' : '#151515'
      ctx.font = `${options.small ? 25 : 48}px Arial`
      const lines = text.split('\n')
      lines.forEach((line, i) => ctx.fillText(line, 100, 120 + i * 85))
      if (options.table) {
        ctx.strokeStyle = '#333'
        for (let i = 0; i <= lines.length; i++) {
          ctx.beginPath()
          ctx.moveTo(70, 65 + i * 85)
          ctx.lineTo(1430, 65 + i * 85)
          ctx.stroke()
        }
        for (const x of [70, 900, 1430]) {
          ctx.beginPath()
          ctx.moveTo(x, 65)
          ctx.lineTo(x, 65 + lines.length * 85)
          ctx.stroke()
        }
      }
      return canvas.toDataURL('image/png').split(',')[1]
    },
    { text, options },
  )
  return { name, mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') }
}
async function importFiles(page, files) {
  await page.getByTestId('gallery-input').setInputFiles(files)
  await expect(page.getByTestId('page-card')).toHaveCount(Array.isArray(files) ? files.length : 1)
}
function dialog(page) {
  return page.getByRole('dialog', { name: 'Lapas teksts', exact: true })
}
async function recognize(page, index = 0) {
  await page
    .getByTestId('page-card')
    .nth(index)
    .getByRole('button', { name: 'Atpazīt tekstu', exact: true })
    .click()
  await expect(dialog(page).getByRole('button', { name: 'Atkārtot OCR', exact: true })).toBeEnabled(
    { timeout: 60_000 },
  )
  return dialog(page)
}
async function storedPages(page) {
  return page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const r = indexedDB.open('gaso-document-ai', 1)
      r.onsuccess = () => resolve(r.result)
      r.onerror = () => reject(r.error)
    })
    const pages = await new Promise((resolve) => {
      const request = db.transaction('pages').objectStore('pages').getAll()
      request.onsuccess = () => resolve(request.result)
    })
    db.close()
    return pages
  })
}
async function setLanguages(page, selected) {
  const group = page.getByRole('group', { name: 'Dokumenta OCR valodas' }).filter({ visible: true })
  const labels = { lav: 'Latviešu', eng: 'Angļu', rus: 'Krievu' }
  for (const lang of selected)
    await group.getByRole('checkbox', { name: labels[lang], exact: true }).check()
  for (const lang of ['lav', 'eng', 'rus'].filter((item) => !selected.includes(item)))
    await group.getByRole('checkbox', { name: labels[lang], exact: true }).uncheck()
}
async function closeResult(page) {
  await dialog(page).getByRole('button', { name: 'Aizvērt teksta apskati' }).click()
  await expect(dialog(page)).toHaveCount(0)
}
async function saveDraft(page) {
  await page.getByRole('button', { name: 'Saglabāt melnrakstu', exact: true }).click()
  await expect(page.getByText('Melnraksts sekmīgi saglabāts', { exact: false })).toBeVisible()
}
function characterErrorRate(expected, actual) {
  const clean = (text) => [...text.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim()]
  const a = clean(expected),
    b = clean(actual)
  let row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 0; i < a.length; i++) {
    const next = [i + 1]
    for (let j = 0; j < b.length; j++)
      next.push(Math.min(next[j] + 1, row[j + 1] + 1, row[j] + Number(a[i] !== b[j])))
    row = next
  }
  return row[b.length] / Math.max(1, a.length)
}
test('real Latvian OCR, editing, original preservation, rerun confirmation and IndexedDB reload', async ({
  page,
  context,
}, testInfo) => {
  test.setTimeout(120_000)
  const requests = [],
    errors = []
  context.on('request', (r) => {
    if (!r.url().startsWith('http://127.0.0.1:4173') && !/^(blob|data):/.test(r.url()))
      requests.push(r.url())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/#/scan')
  const fixture = await documentImage(
    page,
    'RĒĶINS Nr. 2026-001\nDatums: 10.11.2026\nPakalpojums: dokumentu apstrāde\nSumma: 125.00 EUR',
  )
  await importFiles(page, fixture)
  const view = await recognize(page)
  await expect(view.getByTestId('ocr-text')).toHaveValue(/2026-001/)
  await expect(view.getByTestId('ocr-text')).toHaveValue(/125.00 EUR/)
  const original = await view.getByTestId('ocr-text').inputValue()
  await view.getByTestId('ocr-text').fill('Manuāli labots teksts')
  await view.getByRole('button', { name: 'Saglabāt tekstu', exact: true }).click()
  await expect(view.getByText('Teksts un sesija saglabāti', { exact: false })).toBeVisible()
  let stored = await storedPages(page)
  expect(stored[0].ocr.originalText).toBe(original)
  expect(stored[0].ocr.editedText).toBe('Manuāli labots teksts')
  expect(stored[0].ocr.languages).toEqual(['lav'])
  page.once('dialog', (d) => d.dismiss())
  await view.getByRole('button', { name: 'Atkārtot OCR', exact: true }).click()
  await expect(view.getByTestId('ocr-text')).toHaveValue('Manuāli labots teksts')
  await page.reload()
  await page
    .getByTestId('page-card')
    .getByRole('button', { name: 'Skatīt tekstu', exact: true })
    .click()
  await expect(dialog(page).getByTestId('ocr-text')).toHaveValue('Manuāli labots teksts')
  for (const dark of [false, true]) {
    if (dark) {
      await dialog(page).getByRole('button', { name: 'Aizvērt teksta apskati' }).click()
      await page.locator('.theme-toggle').click()
      await page.getByRole('button', { name: 'Skatīt tekstu', exact: true }).click()
    }
    await page.waitForFunction(() =>
      document.getAnimations().every((a) => a.playState !== 'running'),
    )
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze()
    expect(
      result.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
    ).toEqual([])
    expect(await dialog(page).evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
  }
  await page.screenshot({ path: testInfo.outputPath('ocr-result-dark.png'), fullPage: true })
  expect(requests).toEqual([])
  expect(errors).toEqual([])
  await closeResult(page)
  await page.getByRole('button', { name: 'Jauna sesija', exact: true }).click()
  await importFiles(page, fixture)
  await expect(page.locator('.ocr-session .ocr-progress')).toHaveCount(0)
})

test('real EN/RU/LV documents, tables, dim light, small print and multilingual recognition report CER', async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000)
  await page.goto('/#/scan')
  const cases = [
    {
      lang: 'lav',
      text: 'RĒĶINS Nr. LV-2026\nPircējs: Testa uzņēmums\nPakalpojums: dokumentu apstrāde\nKopā: 125.00 EUR',
      options: {},
    },
    {
      lang: 'eng',
      text: 'INVOICE No. EN-2026\nCustomer: Example Company\nService: document processing\nTotal: 125.00 EUR',
      options: {},
    },
    {
      lang: 'rus',
      text: 'СЧЕТ Номер RU-2026\nПокупатель: Тестовая компания\nУслуга: обработка документов\nСумма: 125.00 EUR',
      options: {},
    },
    {
      lang: 'eng',
      text: 'Item                         Price\nDocument scanning     25.00\nText processing          50.00\nTotal                         75.00 EUR',
      options: { table: true },
    },
    {
      lang: 'lav',
      text: 'Rēķins Nr. LV-2026\nDokumenta apstrāde\nSumma: 125.00 EUR',
      options: { dim: true },
    },
    {
      lang: 'eng',
      text: 'Small print invoice No. SMALL-2026\nDocument processing service\nTotal amount: 125.00 EUR',
      options: { small: true },
    },
  ]
  const fixtures = []
  for (const [index, item] of cases.entries())
    fixtures.push(await documentImage(page, item.text, `quality-${index}.png`, item.options))
  await importFiles(page, fixtures)
  const report = []
  for (const [index, item] of cases.entries()) {
    await setLanguages(page, [item.lang])
    const view = await recognize(page, index)
    const actual = await view.getByTestId('ocr-text').inputValue()
    const cer = characterErrorRate(item.text, actual)
    report.push({
      case: fixtures[index].name,
      language: item.lang,
      options: item.options,
      expected: item.text,
      actual,
      cer,
    })
    expect(cer, JSON.stringify(report.at(-1))).toBeLessThan(0.2)
    await closeResult(page)
  }
  await setLanguages(page, ['lav', 'eng', 'rus'])
  page.once('dialog', (d) => d.accept())
  const view = await recognize(page, 0)
  await expect(view.getByTestId('ocr-text')).toHaveValue(/LV-2026/)
  expect((await storedPages(page)).find((p) => p.ocr.languages.length === 3)).toBeTruthy()
  await testInfo.attach('real-ocr-quality.json', {
    body: JSON.stringify(report, null, 2),
    contentType: 'application/json',
  })
  console.log(
    `OCR CER ${testInfo.project.name}: ${report.map((r) => `${r.case}=${(r.cer * 100).toFixed(2)}%`).join(', ')}`,
  )
})

test('real batch OCR reuses the worker, combines in page order and isolates a corrupt page and empty result', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await page.goto('/#/scan')
  const files = [
    await documentImage(page, 'FIRST PAGE INVOICE 100'),
    await documentImage(page, 'CORRUPTED PAGE'),
    await documentImage(page, ''),
    await documentImage(page, 'LAST PAGE INVOICE 200'),
  ]
  await importFiles(page, files)
  await saveDraft(page)
  await page.evaluate(async () => {
    const db = await new Promise((resolve) => {
      const r = indexedDB.open('gaso-document-ai', 1)
      r.onsuccess = () => resolve(r.result)
    })
    await new Promise((resolve) => {
      const tx = db.transaction(['drafts', 'images'], 'readwrite')
      const r = tx.objectStore('drafts').getAll()
      r.onsuccess = () => {
        const id = r.result[0].pageIds[1],
          images = tx.objectStore('images')
        images.put({ id, blob: new Blob(['invalid image bytes'], { type: 'image/png' }) })
      }
      tx.oncomplete = resolve
    })
    db.close()
  })
  await page.reload()
  await setLanguages(page, ['eng'])
  const workerLoads = []
  page.on('worker', (worker) => {
    if (/ocr.worker/.test(worker.url())) workerLoads.push(worker.url())
  })
  await page.getByRole('button', { name: 'Atpazīt visas lapas', exact: true }).click()
  await expect(page.getByText('Lapa 4 no 4 · pabeigtas: 3 · kļūdas: 1')).toBeVisible({
    timeout: 60_000,
  })
  await expect(page.getByRole('button', { name: 'Atpazīt visas lapas', exact: true })).toBeEnabled()
  const stored = await storedPages(page)
  expect(stored.filter((p) => p.ocr)).toHaveLength(3)
  expect(stored.filter((p) => p.ocrAttempt?.status === 'error')).toHaveLength(1)
  expect(stored.find((p) => p.ocr?.status === 'empty').ocr.originalText.trim()).toBe('')
  // A failed image resets the worker; both following pages share its replacement.
  expect(workerLoads.length).toBe(2)
  await page.getByText('Visu lapu teksts sesijas secībā', { exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Visu lapu teksts sesijas secībā' })).toHaveValue(
    /FIRST PAGE[\s\S]*LAST PAGE/,
  )
  await page.getByRole('button', { name: 'Pārvietot 4. lapu uz augšu' }).click()
  await expect(page.getByRole('textbox', { name: 'Visu lapu teksts sesijas secībā' })).toHaveValue(
    /3. lapa\nLAST PAGE/,
  )
})

test('unavailable model and WebAssembly initialization failures release work and allow a real retry', async ({
  browser,
}) => {
  test.setTimeout(120_000)
  // Disable SW here so fault injection cannot be satisfied by its public-asset cache.
  const context = await browser.newContext({ serviceWorkers: 'block' })
  const page = await context.newPage()
  await page.goto('http://127.0.0.1:4173/#/scan')
  await importFiles(page, await documentImage(page, 'INVOICE RETRY 123'))
  await setLanguages(page, ['eng'])
  await context.route('**/eng.traineddata', (route) =>
    route.fulfill({ status: 404, body: 'missing model' }),
  )
  await page.getByRole('button', { name: 'Atpazīt tekstu', exact: true }).click()
  await expect(
    dialog(page).getByText('OCR valodas modeli nevar ielādēt.', { exact: false }),
  ).toBeVisible({ timeout: 30_000 })
  await expect(
    dialog(page).getByRole('button', { name: 'Atpazīt tekstu', exact: true }),
  ).toBeEnabled()
  await context.unroute('**/eng.traineddata')
  await context.route('**/core/*.wasm.js', (route) =>
    route.fulfill({ status: 404, body: 'missing core' }),
  )
  await dialog(page).getByRole('button', { name: 'Atpazīt tekstu', exact: true }).click()
  await expect(
    dialog(page).getByText('Neizdevās palaist OCR WebAssembly vai Worker.', { exact: false }),
  ).toBeVisible({ timeout: 30_000 })
  await context.unroute('**/core/*.wasm.js')
  await dialog(page).getByRole('button', { name: 'Atpazīt tekstu', exact: true }).click()
  await expect(dialog(page).getByTestId('ocr-text')).toHaveValue(/RETRY 123/, { timeout: 60_000 })
  await context.close()
})

test('cancellation during real model initialization terminates workers and retry has no stale completion', async ({
  browser,
}) => {
  test.setTimeout(120_000)
  const context = await browser.newContext({ serviceWorkers: 'block' })
  const page = await context.newPage()
  await page.goto('http://127.0.0.1:4173/#/scan')
  await importFiles(page, await documentImage(page, 'CANCEL AND RETRY 456'))
  await setLanguages(page, ['eng'])
  let modelRequested
  const requested = new Promise((resolve) => (modelRequested = resolve))
  let release
  const gate = new Promise((resolve) => (release = resolve))
  await context.route('**/eng.traineddata', async (route) => {
    modelRequested()
    await gate
    await route.continue().catch(() => {})
  })
  await page.getByRole('button', { name: 'Atpazīt tekstu', exact: true }).click()
  await requested
  const supervisor = page.workers().find((worker) => /ocr.worker/.test(worker.url()))
  expect(supervisor).toBeTruthy()
  const closed = supervisor.waitForEvent('close')
  await dialog(page).getByRole('button', { name: 'Apturēt OCR', exact: true }).click()
  await closed
  await expect(
    dialog(page).getByRole('button', { name: 'Atpazīt tekstu', exact: true }),
  ).toBeEnabled()
  await expect(dialog(page).getByTestId('ocr-text')).toHaveValue('')
  release()
  await context.unroute('**/eng.traineddata')
  await dialog(page).getByRole('button', { name: 'Atpazīt tekstu', exact: true }).click()
  await expect(dialog(page).getByTestId('ocr-text')).toHaveValue(/RETRY 456/, { timeout: 60_000 })
  await context.close()
})

test('prepared OCR resources work after internet disconnect and a full offline reload with no CDN', async ({
  page,
  context,
}) => {
  test.setTimeout(120_000)
  await page.goto('/#/settings')
  await setLanguages(page, ['lav', 'eng', 'rus'])
  await page.getByRole('button', { name: 'Sagatavot OCR bezsaistei', exact: true }).click()
  await expect(
    page.getByText('Izvēlēto valodu modeļi un OCR kods pārbaudīti', { exact: false }),
  ).toBeVisible({ timeout: 60_000 })
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller)
      await new Promise((resolve) =>
        navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }),
      )
  })
  await page.goto('/#/scan')
  const fixtures = []
  for (const text of ['RĒĶINS Nr. LV-789', 'OFFLINE INVOICE 789', 'СЧЕТ Номер RU-789'])
    fixtures.push(await documentImage(page, text))
  await importFiles(page, fixtures)
  await saveDraft(page)
  await context.setOffline(true)
  await page.reload()
  for (const [index, lang] of ['lav', 'eng', 'rus'].entries()) {
    await setLanguages(page, [lang])
    const view = await recognize(page, index)
    await expect(view.getByTestId('ocr-text')).toHaveValue(/789/)
    await closeResult(page)
  }
  await page.reload()
  await page.getByRole('button', { name: 'Skatīt tekstu', exact: true }).nth(1).click()
  await expect(dialog(page).getByTestId('ocr-text')).toHaveValue(/OFFLINE INVOICE 789/)
  await context.setOffline(false)
})

test('legacy drafts acquire real OCR and processing makes results stale; replacement and deletion clean OCR', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await page.goto('/#/scan')
  await importFiles(page, await documentImage(page, 'LEGACY INVOICE 2026'))
  await saveDraft(page)
  expect((await storedPages(page))[0].ocr).toBeUndefined()
  await page.reload()
  await setLanguages(page, ['eng'])
  await recognize(page)
  await closeResult(page)
  await page.getByRole('button', { name: /lapas darbības/ }).click()
  await page.getByRole('button', { name: 'Rediģēt skenējumu', exact: true }).click()
  const editor = page.getByRole('dialog', { name: 'Rediģēt skenējumu', exact: true })
  await expect(editor.getByRole('button', { name: 'Priekšskatīt', exact: true })).toBeEnabled()
  await editor.getByRole('button', { name: 'Pelēktoņi', exact: true }).click()
  await expect(
    editor.getByRole('button', { name: 'Apstiprināt izmaiņas', exact: true }),
  ).toBeEnabled()
  await editor.getByRole('button', { name: 'Apstiprināt izmaiņas', exact: true }).click()
  await expect(editor).toHaveCount(0)
  await page.getByRole('button', { name: 'Skatīt tekstu', exact: true }).click()
  await expect(
    dialog(page).getByText('Teksts tika atpazīts no iepriekšējās attēla versijas.', {
      exact: false,
    }),
  ).toBeVisible()
  page.once('dialog', (d) => d.accept())
  await dialog(page).getByRole('button', { name: 'Atkārtot OCR', exact: true }).click()
  await expect(
    dialog(page).getByRole('button', { name: 'Atkārtot OCR', exact: true }),
  ).toBeEnabled()
  await expect(dialog(page).getByTestId('ocr-text')).toHaveValue(/LEGACY INVOICE/)
  await expect(
    dialog(page).getByText('Teksts tika atpazīts no iepriekšējās attēla versijas.', {
      exact: false,
    }),
  ).toHaveCount(0)
  await closeResult(page)
  const replacement = await documentImage(page, 'REPLACEMENT')
  await page.getByRole('button', { name: /lapas darbības/ }).click()
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Aizstāt attēlu', exact: true }).click()
  await (await chooser).setFiles(replacement)
  await expect(page.getByRole('button', { name: 'Skatīt tekstu', exact: true })).toHaveCount(0)
  await saveDraft(page)
  expect((await storedPages(page))[0].ocr).toBeUndefined()
  await page.getByRole('button', { name: /lapas darbības/ }).click()
  await page.getByRole('button', { name: 'Dzēst lapu', exact: true }).click()
  await saveDraft(page)
  expect(await storedPages(page)).toEqual([])
})

test('real OCR reads the saved perspective-corrected, rotated, filtered full image', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000)
  await page.goto('/#/scan')
  const reference = 'PERSPECTIVE INVOICE 2026\nDocument scanning service\nTotal amount 125.00 EUR'
  const flat = await documentImage(page, reference)
  const photoBase64 = await page.evaluate(async (base64) => {
    const image = new Image()
    image.src = `data:image/png;base64,${base64}`
    await image.decode()
    const rotated = document.createElement('canvas')
    rotated.width = image.height
    rotated.height = image.width
    const rctx = rotated.getContext('2d')
    rctx.translate(rotated.width, 0)
    rctx.rotate(Math.PI / 2)
    rctx.drawImage(image, 0, 0)
    const source = rctx.getImageData(0, 0, rotated.width, rotated.height)
    const photo = document.createElement('canvas')
    photo.width = 1400
    photo.height = 1900
    const ctx = photo.getContext('2d')
    const target = ctx.createImageData(photo.width, photo.height)
    // Independent inverse projection onto a known trapezoid, without importing
    // the application's homography/warp implementation into the fixture.
    for (let y = 0; y < photo.height; y++)
      for (let x = 0; x < photo.width; x++) {
        const yn = y / (photo.height - 1),
          xn = x / (photo.width - 1)
        const v = (yn - 0.1) / (0.6 + (2 / 9) * yn)
        const u = (xn * (1 - (2 / 9) * v) + v / 9 - 0.15) / 0.7
        const to = (y * photo.width + x) * 4
        if (u >= 0 && u <= 1 && v >= 0 && v <= 1) {
          const from =
            (Math.round(v * (source.height - 1)) * source.width +
              Math.round(u * (source.width - 1))) *
            4
          target.data.set(source.data.subarray(from, from + 3), to)
        } else target.data.fill(50, to, to + 3)
        target.data[to + 3] = 255
      }
    ctx.putImageData(target, 0, 0)
    return photo.toDataURL('image/png').split(',')[1]
  }, flat.buffer.toString('base64'))
  await importFiles(page, {
    name: 'slanted-rotated.png',
    mimeType: 'image/png',
    buffer: Buffer.from(photoBase64, 'base64'),
  })
  await page.getByRole('button', { name: /lapas darbības/ }).click()
  await page.getByRole('button', { name: 'Rediģēt skenējumu', exact: true }).click()
  const editor = page.getByRole('dialog', { name: 'Rediģēt skenējumu', exact: true })
  await expect(editor.getByRole('button', { name: 'Priekšskatīt', exact: true })).toBeEnabled()
  await editor.locator('.corner-numeric summary').click()
  const points = [
    [15, 10],
    [85, 10],
    [95, 90],
    [5, 90],
  ]
  for (const [index, point] of points.entries())
    for (const [axis, value] of [
      ['X', point[0]],
      ['Y', point[1]],
    ])
      await editor
        .getByRole('spinbutton', { name: `${index + 1}. stūra ${axis} (%)`, exact: true })
        .fill(String(value))
  await editor.getByRole('button', { name: 'Priekšskatīt', exact: true }).click()
  await expect(editor.getByRole('button', { name: '90° pa kreisi', exact: true })).toBeEnabled()
  await editor.getByRole('button', { name: '90° pa kreisi', exact: true }).click()
  await expect(editor.getByRole('button', { name: 'Pelēktoņi', exact: true })).toBeEnabled()
  await editor.getByRole('button', { name: 'Pelēktoņi', exact: true }).click()
  await expect(
    editor.getByRole('button', { name: 'Apstiprināt izmaiņas', exact: true }),
  ).toBeEnabled()
  await editor.getByRole('button', { name: 'Apstiprināt izmaiņas', exact: true }).click()
  await expect(editor).toHaveCount(0)
  await saveDraft(page)
  await page.reload()
  await setLanguages(page, ['eng'])
  const view = await recognize(page)
  const actual = await view.getByTestId('ocr-text').inputValue()
  const cer = characterErrorRate(reference, actual)
  expect(cer, actual).toBeLessThan(0.15)
  const stored = (await storedPages(page))[0]
  expect(stored.ocr.imageVersion).toContain('grayscale')
  expect(stored.ocr.imageVersion).toContain('270')
  expect(stored.processing.corners[0]).toEqual({ x: 0.15, y: 0.1 })
  const size = await view
    .getByRole('img', { name: 'OCR ievades attēls' })
    .evaluate((img) => [img.naturalWidth, img.naturalHeight])
  expect(Math.max(...size)).toBeGreaterThan(480)
  await testInfo.attach('perspective-ocr.json', {
    body: JSON.stringify({ expected: reference, actual, cer, size }, null, 2),
    contentType: 'application/json',
  })
  console.log(`Perspective OCR CER ${testInfo.project.name}: ${(cer * 100).toFixed(2)}%`)
})

test('cancelling an active real batch keeps completed pages and persists the cancelled status', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await page.goto('/#/scan')
  const first = await documentImage(page, 'COMPLETED INVOICE PAGE 101')
  const denseBase64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 3000
    canvas.height = 4000
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#111'
    ctx.font = '30px Arial'
    for (let y = 70; y < 3900; y += 48)
      ctx.fillText('Invoice line: document processing service 125.00 EUR '.repeat(3), 50, y)
    return canvas.toDataURL('image/png').split(',')[1]
  })
  await importFiles(page, [
    first,
    { name: 'dense.png', mimeType: 'image/png', buffer: Buffer.from(denseBase64, 'base64') },
  ])
  await setLanguages(page, ['eng'])
  await page.getByRole('button', { name: 'Atpazīt visas lapas', exact: true }).click()
  await expect(page.getByText('Lapa 2 no 2 · pabeigtas: 1 · kļūdas: 0')).toBeVisible({
    timeout: 60_000,
  })
  await expect(
    page.locator('.ocr-session').getByText('Atpazīst tekstu…', { exact: false }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Apturēt OCR', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Atpazīt visas lapas', exact: true })).toBeEnabled()
  const stored = await storedPages(page)
  expect(stored.find((p) => p.ocr)?.ocr.originalText).toContain('COMPLETED INVOICE PAGE 101')
  expect(stored.find((p) => p.ocrAttempt)?.ocrAttempt.status).toBe('cancelled')
  await page.reload()
  await expect(page.getByTestId('page-card').nth(0)).toContainText('Teksts atpazīts')
  await expect(page.getByTestId('page-card').nth(1)).toContainText('OCR atcelts')
})

test('OCR quota failures remain visible in the result dialog and saving can be retried', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await page.goto('/#/scan')
  await importFiles(page, await documentImage(page, 'QUOTA INVOICE 123'))
  await page.evaluate(() => {
    window.ocrRealPut = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'pages' && args[0].ocr)
        throw new DOMException('Test quota', 'QuotaExceededError')
      return window.ocrRealPut.apply(this, args)
    }
  })
  await recognize(page)
  await expect(dialog(page).getByRole('alert')).toContainText('nepietiek vietas')
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = window.ocrRealPut
  })
  await dialog(page).getByTestId('ocr-text').fill('Quota retry corrected text')
  await dialog(page).getByRole('button', { name: 'Saglabāt tekstu', exact: true }).click()
  await expect(dialog(page).getByText('Teksts un sesija saglabāti', { exact: false })).toBeVisible()
  expect((await storedPages(page))[0].ocr.editedText).toBe('Quota retry corrected text')
  await closeResult(page)
  await expect(page.getByRole('alert')).toHaveCount(0)
})
