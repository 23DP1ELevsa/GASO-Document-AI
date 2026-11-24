import { ScanError } from './errors.js'
import { validateOcr } from '../ocr/model.js'
import { migrateGrouping, validateDocuments } from '../documents/model.js'
import { navigationState, currentExports } from '../documents/workflow.js'
import { SYNC_STORE, queueChange } from '../storage/queue.js'
import { readRemoteImage } from '../storage/client.js'
import { accountScope } from '../auth/scope.js'

export const DATABASE_NAME = 'gaso-document-ai'
export const DATA_STORES = ['drafts', 'pages', 'images', 'collections', 'savedDocuments']
const STORES = [...DATA_STORES, SYNC_STORE]

function openDatabase(name) {
  return new Promise((resolve, reject) => {
    let request,
      finished = false
    const fail = (error) => {
      if (!finished) {
        finished = true
        clearTimeout(timer)
        reject(error)
      }
    }
    const timer = setTimeout(() => fail(new ScanError('storageBlocked')), 7000)
    try {
      request = indexedDB.open(name, 4)
      request.onupgradeneeded = () => {
        const db = request.result
        for (const name of STORES)
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' })
        if (!db.objectStoreNames.contains('accountMeta')) db.createObjectStore('accountMeta')
      }
      request.onerror = () => fail(request.error)
      request.onblocked = () => fail(new ScanError('storageBlocked'))
      request.onsuccess = () => {
        if (finished) {
          request.result.close()
          return
        }
        finished = true
        clearTimeout(timer)
        request.result.onversionchange = () => request.result.close()
        resolve(request.result)
      }
    } catch {
      fail(new ScanError('storage'))
    }
  })
}

export async function transaction(stores, mode, work) {
  const { id, signal } = accountScope()
  if (!id) throw new ScanError('storage')
  const db = await openDatabase(DATABASE_NAME + ':account:' + id)
  if (signal.aborted) {
    db.close()
    signal.throwIfAborted()
  }
  return new Promise((resolve, reject) => {
    let result, failure, tx
    const fail = (error) => {
      if (failure) return
      failure = error
      try {
        tx.abort()
      } catch {
        db.close()
        reject(error)
      }
    }
    try {
      tx = db.transaction(stores, mode)
      const abort = () => fail(signal.reason)
      signal.addEventListener('abort', abort, { once: true })
      tx.oncomplete = () => {
        signal.removeEventListener('abort', abort)
        db.close()
        resolve(result)
      }
      tx.onabort = () => {
        signal.removeEventListener('abort', abort)
        db.close()
        reject(failure || tx.error || new ScanError('storage'))
      }
      tx.onerror = () => {
        /* Default IndexedDB behavior aborts the entire transaction. */
      }
      work(
        tx,
        (value) => {
          result = value
        },
        fail,
      )
    } catch (error) {
      if (tx) {
        failure = error
        try {
          tx.abort()
        } catch {
          db.close()
          reject(error)
        }
      } else {
        db.close()
        reject(error)
      }
    }
  })
}

function guarded(fail, callback) {
  return (event) => {
    try {
      callback(event)
    } catch (error) {
      fail(error)
    }
  }
}

export function listDrafts() {
  return transaction(['drafts'], 'readonly', (tx, result) => {
    tx.objectStore('drafts').getAll().onsuccess = (event) =>
      result(event.target.result.sort((a, b) => b.updatedAt - a.updatedAt))
  })
}

export function loadDraft(id) {
  return transaction(['drafts', 'pages'], 'readonly', (tx, result, fail) => {
    tx.objectStore('drafts').get(id).onsuccess = (event) => {
      const draft = event.target.result
      if (!draft) {
        fail(new ScanError('missingDraft'))
        return
      }
      const pages = new Array(draft.pageIds.length)
      result({ ...draft, pages })
      draft.pageIds.forEach((pageId, index) => {
        tx.objectStore('pages').get(pageId).onsuccess = (pageEvent) => {
          if (!pageEvent.target.result) {
            fail(new ScanError('missingImage'))
            return
          }
          pages[index] = pageEvent.target.result
        }
      })
    }
  }).then(migrateGrouping)
}

export async function readImageRecord(id) {
  const record = await readLocalImageRecord(id)
  if (!record.remote || (record.blob && (!record.remote.processed || record.processed)))
    return record
  return {
    ...record,
    blob: record.blob || (await readRemoteImage(record.remote.original)),
    processed:
      record.processed ||
      (record.remote.processed && (await readRemoteImage(record.remote.processed))),
  }
}

export function readLocalImageRecord(id) {
  return transaction(['images'], 'readonly', (tx, result, fail) => {
    resolveImageRecord(tx.objectStore('images'), id, result, fail)
  })
}

export function resolveImageRecord(store, id, result, fail) {
  const read = (key, seen, complete) => {
    if (seen.has(key)) {
      fail(new ScanError('missingImage'))
      return
    }
    const visited = new Set([...seen, key])
    store.get(key).onsuccess = (event) => {
      const record = event.target.result
      if (!record) fail(new ScanError('missingImage'))
      else if (record.reference) read(record.reference, visited, complete)
      else if (record.originalReference)
        read(record.originalReference, visited, (original) =>
          complete({
            ...record,
            blob: original.blob,
            remote: original.remote?.original
              ? { ...record.remote, original: original.remote.original }
              : record.remote,
          }),
        )
      else complete(record)
    }
  }
  read(id, new Set(), result)
}

export async function readOriginal(id) {
  const record = await readLocalImageRecord(id)
  if (record.blob) return record.blob
  if (!record.remote?.original) throw new ScanError('missingImage')
  return readRemoteImage(record.remote.original)
}
export async function readDisplay(id) {
  const record = await readImageRecord(id)
  return record.processed || record.blob
}

export function saveDraft(session) {
  validateDocuments(session)
  return transaction(STORES, 'readwrite', (tx, result, fail) => {
    const drafts = tx.objectStore('drafts'),
      pages = tx.objectStore('pages'),
      images = tx.objectStore('images')
    drafts.get(session.id).onsuccess = guarded(fail, (event) => {
      const previous = event.target.result
      if ((previous?.revision || 0) !== session.revision) {
        fail(new ScanError('conflict'))
        return
      }
      const pageIds = session.pages.map((page) => page.id)
      const draft = {
        schemaVersion: 2,
        documents: session.documents || [],
        workflow: navigationState({
          ...session.workflow,
          ...(session.workflow?.exports ? { exports: currentExports(session) } : {}),
        }),
        id: session.id,
        createdAt: session.createdAt,
        updatedAt: Date.now(),
        status: 'draft',
        revision: session.revision + 1,
        pageIds,
        cover: session.pages[0]?.thumbnail || null,
      }
      for (const id of previous?.pageIds || [])
        if (!pageIds.includes(id)) {
          pages.delete(id)
          images.delete(id)
        }
      for (const page of session.pages) {
        validateOcr(page.ocr)
        const { original, processed, ...metadata } = page
        pages.put(metadata)
        if (original) {
          images.get(page.id).onsuccess = guarded(fail, (event) => {
            const prior = event.target.result
            const reference = prior?.originalReference || prior?.reference
            images.put({
              id: page.id,
              ...(reference ? { originalReference: reference } : { blob: original }),
              ...(processed ? { processed } : {}),
            })
          })
        } else if (!previous?.pageIds.includes(page.id)) {
          fail(new ScanError('missingImage'))
          return
        }
      }
      drafts.put(draft)
      queueChange(tx, 'sessions', session.id)
      result(draft)
    })
  }).then(async (draft) => {
    // Garbage collection can retry later; it must not turn a committed save into a failure.
    try {
      await collectUnusedImages()
    } catch {
      /* Retaining unused images is safe. */
    }
    return draft
  })
}

export function deleteDraft(id) {
  return transaction(STORES, 'readwrite', (tx, result, fail) => {
    tx.objectStore('drafts').get(id).onsuccess = guarded(fail, (event) => {
      const draft = event.target.result
      for (const pageId of draft?.pageIds || []) {
        tx.objectStore('pages').delete(pageId)
        tx.objectStore('images').delete(pageId)
      }
      tx.objectStore('drafts').delete(id)
      if (draft) queueChange(tx, 'sessions', id, true)
    })
  }).then(async () => {
    try {
      await collectUnusedImages()
    } catch {
      /* Retry on the next successful write. */
    }
  })
}

export function collectUnusedImages() {
  return transaction(STORES, 'readwrite', (tx) => {
    const data = {}
    let remaining = 4
    for (const store of ['collections', 'savedDocuments', 'drafts', 'images']) {
      tx.objectStore(store).getAll().onsuccess = (event) => {
        data[store] = event.target.result
        if (--remaining) return
        const documentIds = new Set(data.collections.flatMap((item) => item.documentIds))
        const retained = data.savedDocuments.filter((item) => documentIds.has(item.id))
        for (const item of data.savedDocuments)
          if (!documentIds.has(item.id)) tx.objectStore('savedDocuments').delete(item.id)
        const pageIds = new Set(data.drafts.flatMap((item) => item.pageIds))
        const used = new Set(
          retained.flatMap((item) => item.pages.map((page) => page.imageRecordId)),
        )
        for (const id of pageIds) used.add(id)
        const byId = new Map(data.images.map((image) => [image.id, image]))
        const pending = [...used]
        while (pending.length) {
          const image = byId.get(pending.pop())
          for (const target of [image?.reference, image?.originalReference])
            if (target && !used.has(target)) {
              used.add(target)
              pending.push(target)
            }
        }
        for (const image of data.images)
          if (!used.has(image.id)) tx.objectStore('images').delete(image.id)
      }
    }
  })
}
