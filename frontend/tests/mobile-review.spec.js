import { test, expect } from '@playwright/test'
import {
  aiResult,
  review,
  mockAi,
  analyze,
  editField,
  records,
  confirm,
  addToSet,
} from '../test-support/uxFixtures.js'
import { goStep } from '../test-support/workflowUi.js'
import { readPdf } from '../test-support/readPdf.js'

test('one explicit confirmation reviews all fields atomically and opens completion without creating PDF', async ({
  page,
}) => {
  let calls = 0,
    pdfWorkers = 0
  page.on('worker', (worker) => {
    if (worker.url().includes('pdf.worker')) pdfWorkers++
  })
  await mockAi(page)
  await page.route('**/api/document-analysis', (route) => {
    calls++
    return route.fulfill({ json: { result: aiResult() } })
  })
  await review(page, 2)
  await analyze(page)
  await expect(page.getByRole('button', { name: 'Esmu pārbaudījis visus laukus' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Apstiprināt', exact: true })).toHaveCount(0)
  await expect(page.locator('.compact-attributes input')).toHaveCount(0)
  await editField(page, 'Nosūtītājs', 'Lietotāja labojums')
  await confirm(page)
  expect(pdfWorkers).toBe(0)
  const saved = (await records(page, 'drafts'))[0].documents[0]
  expect(saved.dynamicAttributes.every((field) => field.status === 'reviewed')).toBe(true)
  expect(saved.confirmation.values.sender).toBe('Lietotāja labojums')
  expect(calls).toBe(1)
  await page.getByRole('button', { name: 'Apskatīt dokumentu', exact: true }).click()
  await expect(page.getByTestId('document-detail')).toBeVisible()
  await expect(page.locator('.compact-attributes')).toContainText('Lietotāja labojums')
  await expect(page.locator('.compact-attributes input')).toHaveCount(0)
  await page.reload()
  await expect(page.locator('.compact-attributes')).toContainText('Pārbaudāms nosacījums')
  expect(calls).toBe(1)
  await page.getByRole('button', { name: 'Apskatīt oriģinālu', exact: true }).click()
  await page.getByRole('button', { name: '2. lapa', exact: true }).click()
  await expect(page.getByRole('dialog').locator('img')).toBeVisible()
  await page.getByRole('button', { name: 'Aizvērt priekšskatījumu', exact: true }).click()
  await page.getByRole('button', { name: 'Izveidot PDF', exact: true }).click()
  const link = page.getByRole('link', { name: 'Lejupielādēt PDF', exact: true })
  await expect(link).toBeVisible({ timeout: 30000 })
  const bytes = await link.evaluate(async (el) => [
    ...new Uint8Array(await (await fetch(el.href)).arrayBuffer()),
  ])
  const pdf = await readPdf(bytes)
  expect(pdf.pages[0].text).toContain('Lietotāja labojums')
  expect(pdf.pages.filter((page) => page.images.length)).toHaveLength(2)
  expect(calls).toBe(1)
})

test('invalid values remain editable and cannot be confirmed; editing later invalidates confirmation', async ({
  page,
}) => {
  await mockAi(page)
  await review(page)
  await analyze(page)
  await page.getByRole('button', { name: 'Rediģēt: Kopējā summa', exact: true }).click()
  await page.getByLabel('Kopējā summa', { exact: true }).fill('nepareizi')
  await page.getByRole('button', { name: 'Apstiprināt dokumentu', exact: true }).click()
  await expect(page.getByLabel('Kopējā summa', { exact: true })).toBeFocused()
  expect((await records(page, 'drafts'))[0].documents[0].confirmation).toBeNull()
  await expect(page.getByLabel('Kopējā summa', { exact: true })).toHaveValue('nepareizi')
  await page.getByLabel('Kopējā summa', { exact: true }).fill('125.50')
  await page.getByRole('button', { name: 'Gatavs', exact: true }).click()
  await confirm(page)
  await page.getByRole('button', { name: 'Apskatīt dokumentu', exact: true }).click()
  await page.getByRole('button', { name: 'Rediģēt', exact: true }).click()
  await editField(page, 'Nosūtītājs', 'Mainīts pēc apstiprināšanas')
  await page.getByRole('button', { name: 'Uz sākumu', exact: true }).first().click()
  await page.goto('/#/documents')
  await expect(page.getByTestId('document-card')).toContainText('Jāpārbauda dati')
  await page.getByRole('button', { name: /Apskatīt dokumentu:/ }).click()
  await expect(page.locator('.compact-attributes')).toContainText('Mainīts pēc apstiprināšanas')
})

test('home saves each scanning step and failed writes retain the current editor and images', async ({
  page,
}) => {
  await page.goto('/#/scan')
  await page.getByRole('button', { name: 'Uz sākumu', exact: true }).first().click()
  await expect(page).toHaveURL(/#\/$/)
  await mockAi(page)
  await review(page)
  await analyze(page)
  await editField(page, 'Nosūtītājs', 'Jāsaglabā')
  await page.evaluate(() => {
    window.originalPut = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'drafts') throw new DOMException('Synthetic quota', 'QuotaExceededError')
      return window.originalPut.apply(this, args)
    }
  })
  await page.getByRole('button', { name: 'Uz sākumu', exact: true }).first().click()
  await expect(page.getByRole('alert')).toContainText('nepietiek vietas')
  await expect(page).toHaveURL(/#\/scan/)
  await expect(page.locator('.compact-attributes')).toContainText('Jāsaglabā')
  await page.evaluate(() => (IDBObjectStore.prototype.put = window.originalPut))
  await page.getByRole('button', { name: 'Uz sākumu', exact: true }).first().click()
  await expect(page).toHaveURL(/#\/$/)
  expect((await records(page, 'drafts'))[0].documents[0].values.sender).toBe('Jāsaglabā')
  for (const step of [2, 1, 3]) {
    await page
      .getByTestId('draft-card')
      .getByRole('button', { name: 'Turpināt', exact: true })
      .click()
    await goStep(page, step)
    await page.getByRole('button', { name: 'Uz sākumu', exact: true }).first().click()
    await expect(page).toHaveURL(/#\/$/)
  }
})

test('collection snapshots open read-only, survive loss of the original and return to the right set', async ({
  page,
}) => {
  let calls = 0
  await page.route('**/api/document-analysis', (route) => {
    calls++
    return route.fulfill({ json: { result: aiResult() } })
  })
  await review(page)
  await analyze(page)
  await confirm(page)
  await addToSet(page)
  await page.getByRole('link', { name: 'Apskatīt komplektu', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'UX komplekts', exact: true })).toBeVisible()
  await page.getByRole('button', { name: /Apskatīt dokumentu: Sintētisks rēķins/ }).click()
  await expect(page.getByTestId('document-detail')).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Rediģēt sākotnējo dokumentu', exact: true }),
  ).toBeVisible()
  const draft = (await records(page, 'drafts'))[0]
  await page.evaluate(
    (id) =>
      new Promise((resolve) => {
        const req = indexedDB.open('gaso-document-ai')
        req.onsuccess = () => {
          const db = req.result
          const tx = db.transaction(['drafts', 'pages', 'images'], 'readwrite')
          tx.objectStore('drafts').get(id).onsuccess = (e) => {
            for (const key of e.target.result.pageIds) {
              tx.objectStore('pages').delete(key)
              tx.objectStore('images').delete(key)
            }
            tx.objectStore('drafts').delete(id)
          }
          tx.oncomplete = () => {
            db.close()
            resolve()
          }
        }
      }),
    draft.id,
  )
  await page.reload()
  await expect(page.getByRole('button', { name: /Rediģēt/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Apskatīt oriģinālu', exact: true }).click()
  await expect(page.getByRole('dialog').locator('img')).toBeVisible()
  await page.evaluate(() => window.dispatchEvent(new Event('gaso:back', { cancelable: true })))
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.evaluate(() => window.dispatchEvent(new Event('gaso:back', { cancelable: true })))
  await expect(page.getByRole('heading', { name: 'UX komplekts', exact: true })).toBeVisible()
  expect(calls).toBe(1)
  await page.goto('/#/documents')
  await expect(page.getByTestId('document-card')).toHaveCount(1)
  await expect(page.getByTestId('document-card')).toContainText('Komplektā')
})

test('compact review stays usable in both themes and does not hide the last field behind the footer', async ({
  page,
}) => {
  await mockAi(page)
  await review(page)
  await analyze(page)
  for (const mode of ['light', 'dark']) {
    if (mode === 'dark') {
      await page.locator('.session-menu > summary').click()
      await page.locator('.theme-toggle').click()
      await page.locator('.session-menu > summary').click()
    }
    await page.locator('.compact-attribute').last().scrollIntoViewIfNeeded()
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const last = await page.locator('.compact-attribute').last().boundingBox()
    const footer = await page.locator('.mobile-step-footer').boundingBox()
    expect(last.y + last.height).toBeLessThanOrEqual(footer.y)
    await expect(
      page.getByRole('button', { name: 'Apstiprināt dokumentu', exact: true }),
    ).toBeVisible()
  }
})

test('a session with two documents offers two distinct read-only cards after reload', async ({
  page,
}) => {
  await review(page, 2)
  const drafts = await records(page, 'drafts'),
    pages = await records(page, 'pages')
  const { createDocument, editValue, confirmDocument } =
    await import('../src/features/documents/model.js')
  let session = { ...drafts[0], pages, documents: [] }
  session = createDocument(session, [pages[0].id], 'Pirmais dokuments')
  session = createDocument(session, [pages[1].id], 'Otrais dokuments')
  session = editValue(session, session.documents[0].id, 'sender', 'Pirmā persona')
  session = confirmDocument(session, session.documents[0].id)
  session = editValue(session, session.documents[1].id, 'sender', 'Otrā persona')
  await page.evaluate(
    (data) =>
      new Promise((resolve) => {
        const req = indexedDB.open('gaso-document-ai')
        req.onsuccess = () => {
          const db = req.result
          const tx = db.transaction('drafts', 'readwrite')
          tx.objectStore('drafts').put(data)
          tx.oncomplete = () => {
            db.close()
            resolve()
          }
        }
      }),
    { ...drafts[0], documents: session.documents, revision: drafts[0].revision + 1 },
  )
  let calls = 0
  await page.route('**/api/document-analysis', (route) => {
    calls++
    return route.abort()
  })
  await page.goto('/#/documents')
  await page.reload()
  await expect(page.getByTestId('document-card')).toHaveCount(2)
  await page
    .getByRole('button', { name: 'Apskatīt dokumentu: Pirmais dokuments', exact: true })
    .click()
  await expect(page.locator('.compact-attributes')).toContainText('Pirmā persona')
  await expect(page.locator('.compact-attributes')).not.toContainText('Otrā persona')
  await page.getByRole('button', { name: 'Atpakaļ', exact: true }).click()
  await page
    .getByRole('button', { name: 'Apskatīt dokumentu: Otrais dokuments', exact: true })
    .click()
  await expect(page.locator('.compact-attributes')).toContainText('Otrā persona')
  expect(calls).toBe(0)
})
