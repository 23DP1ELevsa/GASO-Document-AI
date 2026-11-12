import { ScanError } from './errors'
import { validateOcr } from '../ocr/model.js'
import { migrateGrouping, validateDocuments } from '../documents/model.js'

export const DATABASE_NAME = 'gaso-document-ai'
const STORES = ['drafts', 'pages', 'images']

function openDatabase() {
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
      request = indexedDB.open(DATABASE_NAME, 1)
      request.onupgradeneeded = () => {
        const db = request.result
        for (const name of STORES)
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' })
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

async function transaction(stores, mode, work) {
  const db = await openDatabase()
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
      tx.oncomplete = () => {
        db.close()
        resolve(result)
      }
      tx.onabort = () => {
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

function readImage(id, display) {
  return transaction(['images'], 'readonly', (tx, result, fail) => {
    tx.objectStore('images').get(id).onsuccess = (event) => {
      if (!event.target.result) fail(new ScanError('missingImage'))
      else
        result(
          display
            ? event.target.result.processed || event.target.result.blob
            : event.target.result.blob,
        )
    }
  })
}

export function readImageRecord(id) {
  return transaction(['images'], 'readonly', (tx, result, fail) => {
    tx.objectStore('images').get(id).onsuccess = (event) => {
      if (!event.target.result) fail(new ScanError('missingImage'))
      else result(event.target.result)
    }
  })
}

export function readOriginal(id) {
  return readImage(id, false)
}
export function readDisplay(id) {
  return readImage(id, true)
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
        if (original)
          images.put({ id: page.id, blob: original, ...(processed ? { processed } : {}) })
        else if (!previous?.pageIds.includes(page.id)) {
          fail(new ScanError('missingImage'))
          return
        }
      }
      drafts.put(draft)
      result(draft)
    })
  })
}

export function deleteDraft(id) {
  return transaction(STORES, 'readwrite', (tx, result, fail) => {
    tx.objectStore('drafts').get(id).onsuccess = guarded(fail, (event) => {
      for (const pageId of event.target.result?.pageIds || []) {
        tx.objectStore('pages').delete(pageId)
        tx.objectStore('images').delete(pageId)
      }
      tx.objectStore('drafts').delete(id)
    })
  })
}
