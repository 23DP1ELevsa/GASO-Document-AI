import { editField } from '../test-support/uxFixtures.js'
import { acceptSuggestions } from '../test-support/workflowUi.js'
import { toggleTheme } from '../test-support/workflowUi.js'
import { test, expect } from '@playwright/test'
import {
  groupingTools,
  reviewDocument,
  analyzeDocument,
  analysisDetails,
  extraFields,
  pageTools,
  goStep,
} from '../test-support/workflowUi.js'
import AxeBuilder from '@axe-core/playwright'
import sharp from 'sharp'
import { processingKey } from '../src/features/processing/geometry.js'

const invoice =
  'Rēķins Nr. SYN-001\nPārdevējs: SIA Sintētiskais pārdevējs\nPircējs: SIA Sintētiskais pircējs\nIzdošanas datums: 10.11.2026\nApmaksas termiņš: 2026-12-01\nSumma bez PVN: 100.00\nPVN summa: 21.00\nKopā apmaksai: 121.00 EUR'
let fixture
test.beforeAll(async () => {
  fixture = {
    name: 'synthetic.png',
    mimeType: 'image/png',
    buffer: await sharp({ create: { width: 600, height: 800, channels: 3, background: '#ffffff' } })
      .png()
      .toBuffer(),
  }
})
const groups = (page) => page.getByTestId('document-group')
const info = (page) => page.getByTestId('document-information')
async function save(page) {
  if ((await page.locator('.workspace-savebar button').count()) === 0) {
    await expect(page.locator('.workspace-savebar strong')).toHaveText('Saglabāts ierīcē')
    return
  }
  await page
    .getByRole('button', { name: /^(Saglabāt melnrakstu|Mēģināt saglabāt vēlreiz)$/, exact: true })
    .click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Melnraksts sekmīgi saglabāts' }),
  ).toBeVisible()
}
async function database(page) {
  return page.evaluate(async () => {
    const db = await new Promise((resolve) => {
      const r = indexedDB.open('gaso-document-ai')
      r.onsuccess = () => resolve(r.result)
    })
    try {
      const tx = db.transaction(['drafts', 'pages', 'images'])
      const read = (store) =>
        new Promise((resolve) => {
          const r = tx.objectStore(store).getAll()
          r.onsuccess = () => resolve(r.result)
        })
      const [drafts, pages, images] = await Promise.all(['drafts', 'pages', 'images'].map(read))
      return { drafts, pages: pages.map(({ thumbnail, ...page }) => page), images: images.length }
    } finally {
      db.close()
    }
  })
}
async function seed(page, texts = ['', '', ''], legacy = false) {
  await page.goto('/#/scan')
  await page
    .getByTestId('gallery-input')
    .setInputFiles(texts.map((_, index) => ({ ...fixture, name: `synthetic-${index + 1}.png` })))
  await expect(page.getByTestId('page-card')).toHaveCount(texts.length)
  await expect(page.getByText('Apstrādā…', { exact: true })).toHaveCount(0)
  await save(page)
  await page.evaluate(
    async ({ texts, legacy, key }) => {
      const db = await new Promise((resolve) => {
        const r = indexedDB.open('gaso-document-ai')
        r.onsuccess = () => resolve(r.result)
      })
      try {
        await new Promise((resolve, reject) => {
          const tx = db.transaction(['drafts', 'pages'], 'readwrite')
          tx.oncomplete = resolve
          tx.onabort = () => reject(tx.error)
          const request = tx.objectStore('drafts').getAll()
          request.onsuccess = () => {
            const draft = request.result[0]
            if (legacy) {
              delete draft.documents
              delete draft.schemaVersion
              tx.objectStore('drafts').put(draft)
            }
            draft.pageIds.forEach((id, index) => {
              const read = tx.objectStore('pages').get(id)
              read.onsuccess = () => {
                tx.objectStore('pages').put({
                  ...read.result,
                  ocr: {
                    schemaVersion: 1,
                    pageId: id,
                    imageVersion: `${id}:${key}`,
                    languages: ['lav'],
                    originalText: texts[index],
                    editedText: legacy ? `${texts[index]}\nManuāls labojums` : null,
                    editedAt: legacy ? 200 : null,
                    recognizedAt: 100,
                    engine: 'tesseract.js',
                    engineVersion: '7.0.0',
                    confidence: null,
                    status: 'success',
                    durationMs: 1,
                  },
                })
              }
            })
          }
        })
      } finally {
        db.close()
      }
    },
    { texts, legacy, key: processingKey() },
  )
  await page.reload()
  await expect(page.getByTestId('page-card')).toHaveCount(texts.length)
  await groupingTools(page)
}
async function create(page, name, indices = []) {
  await groupingTools(page)
  const unassigned = page.getByTestId('unassigned-pages')
  for (const index of indices) await unassigned.getByRole('checkbox').nth(index).check()
  await page.getByLabel('Jaunā dokumenta nosaukums', { exact: true }).fill(name)
  await page.getByRole('button', { name: 'Izveidot dokumentu', exact: true }).click()
}
async function editPages(group) {
  const details = group.locator('.group-membership')
  if (!(await details.getAttribute('open')) && !(await details.evaluate((el) => el.open)))
    await details.locator('summary').click()
}

test('create, move, order, split, merge and delete groups preserve exclusive pages, OCR and images after reload', async ({
  page,
}) => {
  await seed(page)
  const original = await database(page)
  await create(page, 'Rēķins A', [0, 1])
  await create(page, 'Rēķins B', [0])
  await expect(groups(page)).toHaveCount(2)
  let first = groups(page).nth(0),
    second = groups(page).nth(1)
  await editPages(first)
  await first.getByRole('button', { name: 'Pārvietot dokumenta 2. lapu uz augšu' }).click()
  await first.getByRole('checkbox').nth(1).check()
  await first.getByLabel('Pārvietošanas mērķis').selectOption({ label: 'Rēķins B' })
  await first.getByRole('button', { name: 'Pārvietot atlasītās lapas' }).click()
  await editPages(second)
  await expect(second.getByRole('checkbox')).toHaveCount(2)
  await second.getByRole('checkbox').nth(1).check()
  await second.getByRole('button', { name: 'Atdalīt jaunā dokumentā' }).click()
  await expect(groups(page)).toHaveCount(3)
  const third = groups(page).nth(2)
  await third.locator('.group-other-actions summary').click()
  await third
    .getByLabel('Pievienot šī dokumenta lapas dokumentam')
    .selectOption({ label: 'Rēķins A' })
  page.once('dialog', (dialog) => dialog.accept())
  await third.getByRole('button', { name: 'Apvienot dokumentus', exact: true }).click()
  await expect(groups(page)).toHaveCount(2)
  await save(page)
  await page.reload()
  await expect(groups(page)).toHaveCount(2)
  const stored = await database(page)
  expect(stored.drafts[0].documents[0].pageIds).toEqual([
    original.drafts[0].pageIds[1],
    original.drafts[0].pageIds[0],
  ])
  expect(stored.drafts[0].documents[1].pageIds).toEqual([original.drafts[0].pageIds[2]])
  expect(new Set(stored.drafts[0].documents.flatMap((d) => d.pageIds)).size).toBe(3)
  expect(stored.images).toBe(3)
  first = groups(page).nth(0)
  await first.locator('.group-other-actions summary').click()
  await first.getByRole('button', { name: 'Dzēst grupu, saglabājot lapas' }).click()
  await groupingTools(page)
  await expect(page.getByTestId('unassigned-pages').getByRole('checkbox')).toHaveCount(2)
  await save(page)
  const deleted = await database(page)
  expect(deleted.pages).toHaveLength(3)
  expect(deleted.images).toBe(3)
  expect(deleted.pages[0].ocr).toEqual(original.pages[0].ocr)
})

test('AI suggestions, manual values, custom attributes and confirmation remain separate across documents and reload', async ({
  page,
}, testInfo) => {
  await seed(page, [invoice, 'Invoice No. SYN-002\nGrand total: 50.00 EUR'])
  await create(page, 'Pirmais rēķins', [0])
  await create(page, 'Otrais rēķins', [0])
  await analyzeDocument(page, 0)
  await expectField(page, 'Kopējā summa', '121.00')
  await editField(page, 'Nosūtītājs', 'Manuāli pārbaudīts nosūtītājs')
  await expectField(page, 'Nosūtītājs', 'Manuāli pārbaudīts nosūtītājs')
  await extraFields(page)
  await info(page).getByLabel('Atribūta nosaukums', { exact: true }).fill('Projekta kods')
  await info(page).getByLabel('Atribūta vērtība', { exact: true }).fill('SYNTH-42')
  await info(page).getByRole('button', { name: 'Pievienot atribūtu' }).click()
  await expectField(page, 'Projekta kods', 'SYNTH-42')
  await acceptSuggestions(page)
  await page.getByRole('button', { name: 'Apstiprināt dokumentu', exact: true }).click()
  await reviewDocument(page, 0)
  await analysisDetails(page)
  await extraFields(page)
  await expect(
    info(page).getByRole('status').filter({ hasText: 'Informācija apstiprināta' }),
  ).toBeVisible()
  await analyzeDocument(page, 0)
  await expectField(page, 'Nosūtītājs', 'Manuāli pārbaudīts nosūtītājs')
  await save(page)
  await page.reload()
  await reviewDocument(page, 0)
  await extraFields(page)
  await expectField(page, 'Kopējā summa', '121.00')
  await expectField(page, 'Projekta kods', 'SYNTH-42')
  await expect(
    info(page).getByRole('status').filter({ hasText: 'Informācija apstiprināta' }),
  ).toBeVisible()
  await analyzeDocument(page, 1)
  await expectField(page, 'Nosūtītājs', '')
  await expectField(page, 'Kopējā summa', '50.00')
  await expect(info(page).getByLabel('Projekta kods', { exact: true })).toHaveCount(0)
  await expectField(page, 'Kopējā summa', '50.00')
  for (const dark of [false, true]) {
    if (dark) await toggleTheme(page)
    await page.waitForFunction(() =>
      document.getAnimations().every((animation) => animation.playState !== 'running'),
    )
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze()
    expect(
      result.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
    ).toEqual([])
  }
  await page.screenshot({
    path: testInfo.outputPath('document-information-dark.png'),
    fullPage: true,
  })
})

test('OCR text changes and page replacement mark analysis stale while retaining confirmed manual values', async ({
  page,
}) => {
  await seed(page, [invoice, 'Continuation'])
  await create(page, 'Rēķins', [0, 1])
  await analyzeDocument(page)
  await editField(page, 'Nosūtītājs', 'Saglabāta manuālā vērtība')
  await acceptSuggestions(page)
  await page.getByRole('button', { name: 'Apstiprināt dokumentu', exact: true }).click()
  await reviewDocument(page, 0)
  await analysisDetails(page)
  await extraFields(page)
  await save(page)
  await page.evaluate(
    (text) =>
      new Promise((resolve) => {
        const req = indexedDB.open('gaso-document-ai')
        req.onsuccess = () => {
          const db = req.result
          const tx = db.transaction('pages', 'readwrite')
          tx.objectStore('pages').getAll().onsuccess = (e) => {
            const page = e.target.result[0]
            tx.objectStore('pages').put({
              ...page,
              ocr: { ...page.ocr, editedText: text, editedAt: Date.now() },
            })
          }
          tx.oncomplete = () => {
            db.close()
            resolve()
          }
        }
      }),
    invoice + '\nLabots OCR',
  )
  await page.reload()
  await reviewDocument(page)
  await analysisDetails(page)
  await expect(
    info(page).getByRole('status').filter({ hasText: 'Dokuments ir mainīts' }),
  ).toBeVisible()
  await expectField(page, 'Nosūtītājs', 'Saglabāta manuālā vērtība')
  await expect(
    info(page).getByRole('button', { name: 'Izmantot ieteikumu laukam “Kopējā summa”' }),
  ).toHaveCount(0)
  await analyzeDocument(page)
  await expect(
    info(page).getByRole('status').filter({ hasText: 'Dokuments ir mainīts' }),
  ).toHaveCount(0)
  await goStep(page, 2)
  await page
    .getByTestId('page-card')
    .nth(0)
    .getByRole('button', { name: /lapas darbības/ })
    .click()
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Aizstāt attēlu', exact: true }).click()
  await (await chooser).setFiles({ ...fixture, name: 'replacement.png' })
  await expect(groups(page).getByText('Analīze jāatjaunina', { exact: true })).toBeVisible()
  await reviewDocument(page)
  await expectField(page, 'Nosūtītājs', 'Saglabāta manuālā vērtība')
  await save(page)
  await page.reload()
  await groupingTools(page)
  await expect(groups(page).getByText('Analīze jāatjaunina', { exact: true })).toBeVisible()
  const stored = await database(page)
  expect(stored.drafts[0].documents[0].pageIds).toEqual(stored.drafts[0].pageIds)
  expect(stored.drafts[0].documents[0].confirmation.values.sender).toBe('Saglabāta manuālā vērtība')
  expect(stored.images).toBe(2)
})

test('legacy IndexedDB drafts reopen unassigned without losing original or edited OCR', async ({
  page,
}) => {
  await seed(page, [invoice, 'Otra lapa'], true)
  await expect(groups(page)).toHaveCount(0)
  await expect(page.getByTestId('unassigned-pages').getByRole('checkbox')).toHaveCount(2)
  await create(page, 'Migrēts dokuments', [0, 1])
  await save(page)
  await page.reload()
  await groupingTools(page)
  await expect(groups(page)).toHaveCount(1)
  const stored = await database(page)
  expect(stored.drafts[0].schemaVersion).toBe(2)
  expect(stored.pages.find((p) => p.id === stored.drafts[0].pageIds[0]).ocr.originalText).toBe(
    invoice,
  )
  expect(stored.pages.find((p) => p.id === stored.drafts[0].pageIds[0]).ocr.editedText).toBe(
    `${invoice}\nManuāls labojums`,
  )
  expect(stored.images).toBe(2)
})

test('legacy OCR never splits a document automatically; manual boundaries preserve page ownership', async ({
  page,
}) => {
  await seed(page, ['Invoice No. A1', 'Invoice No. A1', 'Invoice No. A2', 'Invoice No. A3'])
  await create(page, 'Jaukta grupa', [0, 1, 2, 3])
  await expect(
    groups(page).getByRole('button', { name: /Pārskatīt robežu ieteikumus/ }),
  ).toHaveCount(0)
  await editPages(groups(page).first())
  await groups(page).first().getByRole('checkbox').nth(3).check()
  await groups(page)
    .first()
    .getByRole('button', { name: 'Atdalīt jaunā dokumentā', exact: true })
    .click()
  await groups(page).first().getByRole('checkbox').nth(2).check()
  await groups(page)
    .first()
    .getByRole('button', { name: 'Atdalīt jaunā dokumentā', exact: true })
    .click()
  await expect(groups(page)).toHaveCount(3)
  await save(page)
  const stored = await database(page)
  const docs = stored.drafts[0].documents
  expect(docs[0].pageIds).toEqual(stored.drafts[0].pageIds.slice(0, 2))
  expect(
    docs
      .slice(1)
      .every((d) => d.pageIds.length === 1 && d.values.sender === null && d.confirmation === null),
  ).toBe(true)
})

test('group and attribute writes roll back together on failure and retry keeps the in-memory work', async ({
  page,
}) => {
  await seed(page, [invoice])
  await create(page, 'Atomārs dokuments', [0])
  await analyzeDocument(page)
  const before = await database(page)
  await editField(page, 'Nosūtītājs', 'Manuāls nosūtītājs')
  await page.evaluate(() => {
    window.originalPut = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'drafts')
        throw new DOMException('Synthetic quota failure', 'QuotaExceededError')
      return window.originalPut.apply(this, args)
    }
  })
  await acceptSuggestions(page)
  await page.getByRole('button', { name: 'Apstiprināt dokumentu', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('nepietiek vietas')
  expect((await database(page)).drafts[0].documents).toEqual(before.drafts[0].documents)
  await expectField(page, 'Nosūtītājs', 'Manuāls nosūtītājs')
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = window.originalPut
  })
  await save(page)
  const stored = await database(page)
  expect(stored.drafts[0].documents[0].confirmation.values.sender).toBe('Manuāls nosūtītājs')
  expect(stored.images).toBe(1)
})

async function expectField(page, label, value) {
  const row = page
    .locator('.compact-attribute')
    .filter({ has: page.getByText(label, { exact: true }) })
  if (value === '') await expect(row).toHaveCount(0)
  else await expect(row.locator('dd')).toHaveText(value)
}
