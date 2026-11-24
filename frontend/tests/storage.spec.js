import { expect, test } from '@playwright/test'
import { createHash } from 'node:crypto'
import { emptyValues } from '../src/features/documents/catalog.js'
import { confirmDocument } from '../src/features/documents/model.js'
import { readPdf } from '../test-support/readPdf.js'
import { editField, image, records } from '../test-support/uxFixtures.js'

test.use({ serviceWorkers: 'block' })

const settings = '/#/settings'
const sessionPath = '/sessions/storage-session'
const collectionPath = '/collections/storage-set'

async function fixture(page) {
  const files = await Promise.all([image(0), image(1)])
  const now = Date.now()
  const pages = files.map((file, i) => ({
    id: 'storage-page-' + i,
    name: file.name,
    mime: file.mimeType,
    size: file.buffer.length,
    width: 600 + i * 100,
    height: 800,
  }))
  const draft = {
    id: 'storage-session',
    status: 'draft',
    schemaVersion: 2,
    createdAt: now,
    updatedAt: now,
    revision: 4,
    pageIds: pages.map((page) => page.id),
    workflow: {},
  }
  draft.documents = confirmDocument(
    {
      ...draft,
      pages,
      documents: [
        {
          id: 'storage-doc',
          sessionId: draft.id,
          pageIds: draft.pageIds,
          values: { ...emptyValues(), document_title: 'Sintētisks arhīva dokuments' },
          createdAt: now,
          updatedAt: now,
          confirmation: null,
          customFields: [],
        },
      ],
    },
    'storage-doc',
  ).documents
  const collection = {
    id: 'storage-set',
    name: 'Sintētisks arhīva komplekts',
    schemaVersion: 1,
    revision: 2,
    createdAt: now,
    updatedAt: now,
    documentIds: ['storage-set:storage-doc'],
  }
  await page.goto('/icon.svg')
  await page.evaluate(
    ({ draft, pages, collection, files }) =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open('gaso-document-ai', 2)
        request.onupgradeneeded = () => {
          const db = request.result
          for (const name of ['drafts', 'pages', 'images', 'collections', 'savedDocuments'])
            db.createObjectStore(name, { keyPath: 'id' })
        }
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const db = request.result
          const tx = db.transaction([...db.objectStoreNames], 'readwrite')
          const withThumb = pages.map((page, i) => {
            const blob = new Blob([Uint8Array.from(atob(files[i]), (c) => c.charCodeAt(0))], {
              type: page.mime,
            })
            const imageRecordId = page.id + ':saved:original'
            tx.objectStore('images').add({ id: imageRecordId, blob })
            tx.objectStore('images').add({ id: page.id, reference: imageRecordId })
            const result = { ...page, thumbnail: blob }
            tx.objectStore('pages').add(result)
            return { ...result, imageRecordId }
          })
          tx.objectStore('drafts').add({ ...draft, cover: withThumb[0].thumbnail })
          tx.objectStore('collections').add(collection)
          tx.objectStore('savedDocuments').add({
            ...draft.documents[0],
            id: collection.documentIds[0],
            originalDocumentId: draft.documents[0].id,
            savedAt: draft.updatedAt,
            confirmed: true,
            pages: withThumb,
          })
          tx.oncomplete = () => {
            db.close()
            resolve()
          }
          tx.onabort = () => reject(tx.error)
        }
      }),
    { draft, pages, collection, files: files.map((file) => file.buffer.toString('base64')) },
  )
  return files
}

async function mockStorage(
  context,
  files,
  { dropFirstCommit = false, beforeUpload, beforeCommit } = {},
) {
  const originals = new Map(
    files.map((file, i) => {
      const sha256 = createHash('sha256').update(file.buffer).digest('hex')
      return [
        sha256,
        {
          file,
          descriptor: {
            sha256,
            size: file.buffer.length,
            mime: file.mimeType,
            width: 600 + i * 100,
            height: 800,
          },
        },
      ]
    }),
  )
  const roots = new Map()
  const assets = new Map()
  const calls = { uploads: 0, commits: 0, downloads: 0, checks: 0, offline: false }
  await context.route('**/api/storage/v1/**', async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname.slice('/api/storage/v1'.length)
    const method = route.request().method()
    const ok = (json) => route.fulfill({ json })
    const err = (status, code) => route.fulfill({ status, json: { error: { code } } })
    if (calls.offline) return err(503, 'storage_unavailable')
    if (path === '/status') return ok({ status: 'connected', driver: 'mongodb' })
    if (path === '/assets/check') {
      calls.checks++
      const { hashes } = route.request().postDataJSON()
      return ok({ assets: hashes.map((hash) => assets.get(hash)).filter(Boolean), invalid: [] })
    }
    const hash = path.split('/').at(-1)
    if (path.startsWith('/assets/')) {
      if (method === 'POST') {
        const { file, descriptor } = originals.get(hash)
        expect(route.request().headers()['content-type']).toMatch(/^multipart\/form-data/)
        expect(route.request().postDataBuffer().includes(file.buffer)).toBe(true)
        calls.uploads++
        await beforeUpload?.(hash)
        assets.set(hash, descriptor)
      }
      return assets.has(hash) ? ok(assets.get(hash)) : err(404, 'image_missing')
    }
    if (path.startsWith('/images/')) {
      const { file } = originals.get(hash)
      calls.downloads++
      return route.fulfill({
        body: file.buffer,
        contentType: file.mimeType,
        headers: { 'X-Content-SHA256': hash },
      })
    }
    if (['/sessions', '/collections'].includes(path))
      return ok({
        items: [...roots]
          .filter(([key]) => key.startsWith(path + '/'))
          .map(([, { payload, ...head }]) => head),
        next: null,
      })
    const previous = roots.get(path)
    if (method === 'GET') return previous ? ok(previous) : err(404, 'not_found')
    const { expectedRevision, mutationId, payload } = route.request().postDataJSON()
    await beforeCommit?.(path)
    if (expectedRevision !== (previous?.revision || 0)) return err(409, 'revision_conflict')
    const hydrate = (pages) => {
      for (const page of pages)
        for (const key of ['original', 'processed', 'thumbnail']) {
          if (!page[key]) continue
          expect(assets.get(page[key].sha256)?.size).toBe(page[key].size)
          page[key] = assets.get(page[key].sha256)
        }
    }
    if (payload?.pages) hydrate(payload.pages)
    if (path === collectionPath && payload) payload.documents.forEach((doc) => hydrate(doc.pages))
    const value = {
      id: path.split('/').at(-1),
      revision: expectedRevision + 1,
      deleted: method === 'DELETE',
      mutationId,
      updatedAt: Date.now(),
      payload,
    }
    roots.set(path, value)
    calls.commits++
    if (dropFirstCommit && path === sessionPath) {
      dropFirstCommit = false
      return route.abort('connectionreset')
    }
    return ok(value)
  })
  return { roots, calls }
}

async function ensureSynced(page, count) {
  await expect
    .poll(
      async () =>
        (await records(page, 'storageSync')).filter((row) => row.status === 'synced').length,
    )
    .toBe(count)
}

test('v2 migration retries a lost commit, preserves originals and restores PDF images', async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  const files = await fixture(page)
  const storage = await mockStorage(context, files, { dropFirstCommit: true })
  page.on('dialog', (dialog) => dialog.accept())
  await page.goto(settings)
  await expect(page.getByText('Savienots ar MongoDB')).toBeVisible()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Lejupielādēt lokālo rezerves kopiju' }).click()
  expect((await download).suggestedFilename()).toMatch(/\.gaso-backup$/)
  expect(storage.calls.commits).toBe(0)
  await page.getByRole('checkbox', { name: 'Sinhronizēt turpmākās izmaiņas ar MongoDB' }).check()
  await page.getByRole('button', { name: 'Migrēt lokālos dokumentus' }).click()
  await expect(
    page
      .getByText('Sinhronizācija pārtrūka. Mēģiniet vēlreiz.')
      .or(page.getByText('MongoDB savienojums nav pieejams.'))
      .first(),
  ).toBeVisible()
  await page.reload()
  await ensureSynced(page, 2)
  expect(storage.calls.uploads).toBe(2)
  expect(storage.calls.commits).toBe(2)
  expect((await records(page, 'drafts'))[0].revision).toBe(4)
  expect(storage.roots.get(sessionPath).payload.documents[0].confirmation).toBeTruthy()

  // Share the same fixture transport with a clean browser profile.
  const fresh = await browser.newContext({
    baseURL,
    serviceWorkers: 'block',
  })
  await fresh.route('**/api/storage/v1/**', (route) =>
    route.fulfill({
      json: { status: 'connected', driver: 'mongodb' },
    }),
  )
  await fresh.route('**/api/storage/v1/{sessions,collections}*', (route) => {
    const kind = new URL(route.request().url()).pathname.split('/').at(-1)
    const item = storage.roots.get(kind === 'sessions' ? sessionPath : collectionPath)
    return route.fulfill({ json: { items: [item], next: null } })
  })
  for (const [path, data] of storage.roots)
    await fresh.route('**/api/storage/v1' + path, (route) => route.fulfill({ json: data }))
  await fresh.route('**/api/storage/v1/images/*', (route) => {
    const hash = route.request().url().split('/').at(-1)
    const file = files.find(
      (file) => createHash('sha256').update(file.buffer).digest('hex') === hash,
    )
    storage.calls.downloads++
    return route.fulfill({
      body: file.buffer,
      contentType: file.mimeType,
      headers: { 'X-Content-SHA256': hash },
    })
  })
  try {
    const restored = await fresh.newPage()
    await restored.goto(settings)
    await restored.getByRole('button', { name: 'Atjaunot no MongoDB' }).click()
    await expect(restored.getByText('Atjaunoti 2 ieraksti.')).toBeVisible()
    expect(storage.calls.downloads).toBe(2)
    await restored.evaluate(
      () =>
        new Promise((resolve, reject) => {
          const request = indexedDB.open('gaso-document-ai')
          request.onerror = () => reject(request.error)
          request.onsuccess = () => {
            const db = request.result
            const tx = db.transaction('images', 'readwrite')
            const images = tx.objectStore('images')
            images.get('storage-page-0').onsuccess = ({ target }) => {
              const { blob, ...record } = target.result
              images.put(record)
            }
            tx.oncomplete = () => {
              db.close()
              resolve()
            }
            tx.onabort = () => reject(tx.error)
          }
        }),
    )
    const beforeFallback = storage.calls.downloads
    await restored.goto('/#/document/storage-doc?draft=storage-session')
    await restored.getByRole('button', { name: 'Izveidot PDF', exact: true }).click()
    await expect(restored.getByRole('link', { name: 'Lejupielādēt PDF' })).toBeVisible()
    expect(storage.calls.downloads).toBe(beforeFallback + 1)

    await restored.getByRole('button', { name: 'Aizvērt PDF' }).click()
    await restored.getByRole('link', { name: 'Sintētisks arhīva komplekts' }).click()
    await expect(
      restored.getByRole('heading', { name: 'Sintētisks arhīva komplekts' }),
    ).toBeVisible()
    const requests = storage.calls.downloads
    // The HTTP mock can now fail while the restored images remain available in IndexedDB.
    await fresh.route('**/api/storage/v1/**', (route) => route.abort())
    await restored.getByRole('button', { name: 'Izveidot komplekta PDF' }).click()
    const link = restored.getByRole('link', { name: 'Lejupielādēt PDF' })
    const bytes = await link.evaluate(async (el) =>
      Array.from(new Uint8Array(await (await fetch(el.href)).arrayBuffer())),
    )
    const pdf = await readPdf(bytes)
    expect(pdf.pageCount).toBe(3)
    expect(pdf.pages[0].text).toContain('Sintētisks arhīva dokuments')
    expect(pdf.pages.slice(1).map((item) => item.images[0].width)).toEqual([600, 700])
    expect(storage.calls.downloads).toBe(requests)
  } finally {
    await fresh.close()
  }
})

test('storage outage leaves the local data intact and remote revisions require a choice', async ({
  page,
  context,
}) => {
  const files = await fixture(page)
  const storage = await mockStorage(context, files)
  page.on('dialog', (dialog) => dialog.accept())
  storage.calls.offline = true
  await page.goto(settings)
  await context.setOffline(true)
  await page.getByRole('checkbox', { name: 'Sinhronizēt turpmākās izmaiņas ar MongoDB' }).check()
  await page.getByRole('button', { name: 'Migrēt lokālos dokumentus' }).click()
  await expect(page.getByText('Rindā 2 ieraksti.')).toBeVisible()
  expect((await records(page, 'images')).length).toBe(4)
  storage.calls.offline = false
  await context.setOffline(false)
  await ensureSynced(page, 2)

  const current = storage.roots.get(collectionPath)
  current.revision++
  current.mutationId = 'remote-collection-edit'
  current.payload.metadata.name = 'Serverī pārdēvēts komplekts'
  await page.getByRole('button', { name: 'Atjaunot no MongoDB' }).click()
  await expect(page.getByRole('heading', { name: 'Datu konflikti' })).toBeVisible()
  expect((await records(page, 'collections'))[0].name).toBe('Sintētisks arhīva komplekts')
  await page.getByRole('button', { name: 'Ielādēt servera versiju' }).click()
  await expect(page.getByRole('heading', { name: 'Datu konflikti' })).toHaveCount(0)
  expect((await records(page, 'collections'))[0].name).toBe('Serverī pārdēvēts komplekts')
  expect(storage.calls.commits).toBe(2)
  expect(storage.calls.downloads).toBe(0)
})

test('pause persists through reload and resume only sends missing images', async ({
  page,
  context,
}) => {
  const files = await fixture(page)
  let releaseUpload
  const gate = new Promise((resolve) => {
    releaseUpload = resolve
  })
  const hash = createHash('sha256').update(files[0].buffer).digest('hex')
  const storage = await mockStorage(context, files, {
    beforeUpload: (candidate) => (candidate === hash ? gate : undefined),
  })
  page.on('dialog', (dialog) => dialog.accept())
  await page.goto(settings)
  await page.getByRole('checkbox', { name: 'Sinhronizēt turpmākās izmaiņas ar MongoDB' }).check()
  await page.getByRole('button', { name: 'Migrēt lokālos dokumentus' }).click()
  try {
    await expect(page.getByText('Augšupielādēti attēli: 1.')).toBeVisible()
    await expect(page.getByText('Atlikuši attēli: 1.')).toBeVisible()
    await expect(
      page.getByRole('progressbar', { name: 'Sinhronizācijas progress' }),
    ).toHaveAttribute('aria-valuenow', '25')
    await page.getByRole('button', { name: 'Apturēt sinhronizāciju' }).click()
    await expect(page.getByRole('button', { name: 'Turpināt sinhronizāciju' })).toBeEnabled()
    await page.reload()
    await expect(page.getByRole('button', { name: 'Turpināt sinhronizāciju' })).toBeEnabled()
    expect((await records(page, 'storageSync')).every((row) => row.status === 'pending')).toBe(true)
    expect(storage.calls.commits).toBe(0)
  } finally {
    releaseUpload()
  }
  // The first request may finish on the server after the browser aborted it.
  await page.getByRole('button', { name: 'Turpināt sinhronizāciju' }).click()
  await ensureSynced(page, 2)
  expect(storage.calls.uploads).toBe(2)
  await expect(page.getByRole('progressbar', { name: 'Sinhronizācijas progress' })).toHaveAttribute(
    'aria-valuenow',
    '100',
  )
  await expect(page.getByText('Sinhronizēti dokumenti un komplektu kopijas: 2.')).toBeVisible()
})

test('an edit during a commit remains queued and uses the acknowledged revision', async ({
  page,
  context,
}) => {
  const files = await fixture(page)
  let releaseCommit
  let signalCommit
  const gate = new Promise((resolve) => {
    releaseCommit = resolve
  })
  const started = new Promise((resolve) => {
    signalCommit = resolve
  })
  const storage = await mockStorage(context, files, {
    beforeCommit(path) {
      if (path !== sessionPath) return
      signalCommit()
      return gate
    },
  })
  page.on('dialog', (dialog) => dialog.accept())
  await page.goto(settings)
  await page.getByRole('checkbox', { name: 'Sinhronizēt turpmākās izmaiņas ar MongoDB' }).check()
  await page.getByRole('button', { name: 'Migrēt lokālos dokumentus' }).click()
  try {
    await started
    await page.goto('/#/document/storage-doc?draft=storage-session')
    await page.getByRole('button', { name: 'Rediģēt', exact: true }).click()
    await editField(page, 'Dokumenta nosaukums', 'Labots sinhronizācijas laikā')
    await page.getByRole('button', { name: 'Saglabāt melnrakstu' }).click()
    await expect
      .poll(async () => (await records(page, 'drafts'))[0].documents[0].values.document_title)
      .toBe('Labots sinhronizācijas laikā')
  } finally {
    releaseCommit()
  }
  await page.goto(settings)
  await ensureSynced(page, 2)
  expect(storage.roots.get(sessionPath).revision).toBe(2)
  expect(storage.roots.get(sessionPath).payload.documents[0].values.document_title).toBe(
    'Labots sinhronizācijas laikā',
  )
  expect(
    storage.roots.get(collectionPath).payload.documents[0].metadata.values.document_title,
  ).toBe('Sintētisks arhīva dokuments')
  expect(storage.calls.uploads).toBe(2)
})
