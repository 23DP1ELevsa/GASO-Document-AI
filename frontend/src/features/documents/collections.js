import { transaction, loadDraft, collectUnusedImages } from '../scanning/draftRepository.js'
import { newId } from '../scanning/id.js'
import { isConfirmationCurrent, documentPages } from './model.js'
import { SYNC_STORE, queueChange } from '../storage/queue.js'

const stores = ['collections', 'savedDocuments', 'drafts', 'pages', 'images', SYNC_STORE]
// All mutations run in one IDB transaction. Images are immutable while referenced by a saved document.
export function listCollections() {
  return transaction(['collections'], 'readonly', (tx, result) => {
    tx.objectStore('collections').getAll().onsuccess = (event) =>
      result(event.target.result.sort((a, b) => b.updatedAt - a.updatedAt))
  })
}
export function createCollection(name) {
  name = name.trim()
  if (!name || name.length > 100)
    throw new Error('Ievadiet komplekta nosaukumu (līdz 100 rakstzīmēm).')
  const collection = {
    id: newId(),
    schemaVersion: 1,
    name,
    documentIds: [],
    revision: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  return transaction(['collections', SYNC_STORE], 'readwrite', (tx, result) => {
    tx.objectStore('collections').add(collection)
    queueChange(tx, 'collections', collection.id)
    result(collection)
  })
}
export function updateCollection(id, revision, transform) {
  return transaction(['collections', SYNC_STORE], 'readwrite', (tx, result, fail) => {
    tx.objectStore('collections').get(id).onsuccess = (event) => {
      try {
        const item = event.target.result
        if (!item || item.revision !== revision)
          throw new Error('Komplekts ir mainīts. Atveriet to atkārtoti.')
        const next = transform(item)
        if (
          !next.name.trim() ||
          next.name.length > 100 ||
          new Set(next.documentIds).size !== next.documentIds.length ||
          next.documentIds.some((key) => !item.documentIds.includes(key))
        )
          throw new Error('Nederīgi komplekta dati.')
        const saved = {
          ...item,
          name: next.name.trim(),
          documentIds: next.documentIds,
          revision: item.revision + 1,
          updatedAt: Date.now(),
        }
        tx.objectStore('collections').put(saved)
        queueChange(tx, 'collections', id)
        result(saved)
      } catch (error) {
        fail(error)
      }
    }
  })
}
export async function addDocumentToCollection(collectionId, sessionId, documentId) {
  // Load the saved session; recheck revision atomically before linking.
  const session = await loadDraft(sessionId)
  const document = session.documents.find((item) => item.id === documentId)
  if (!document?.pageIds.length) throw new Error('Dokumentam nav lapu.')
  const snapshot = {
    ...structuredClone(document),
    confirmed: isConfirmationCurrent(session, document),
    pages: documentPages(session, document).map((page) => ({ ...page, imageRecordId: page.id })),
  }
  return transaction(stores, 'readwrite', (tx, result, fail) => {
    tx.objectStore('drafts').get(sessionId).onsuccess = (event) => {
      if (event.target.result?.revision !== session.revision) {
        fail(new Error('Dokuments ir mainīts. Saglabājiet un mēģiniet vēlreiz.'))
        return
      }
      tx.objectStore('collections').get(collectionId).onsuccess = (event) => {
        const collection = event.target.result
        if (!collection) {
          fail(new Error('Komplekts nav atrasts.'))
          return
        }
        const savedId = collectionId + ':' + documentId
        if (collection.documentIds.includes(savedId)) {
          fail(new Error('Dokuments jau ir komplektā.'))
          return
        }
        let remaining = snapshot.pages.length
        for (const page of snapshot.pages) {
          tx.objectStore('images').get(page.id).onsuccess = (event) => {
            const image = event.target.result
            if (!image) {
              fail(new Error('Attēls nav atrasts.'))
              return
            }
            // Move the image to an immutable record and leave a tiny alias for the draft.
            const imageId = image.reference || page.id + ':saved:' + newId()
            if (!image.reference) {
              tx.objectStore('images').put({ ...image, id: imageId })
              tx.objectStore('images').put({ id: page.id, reference: imageId })
            }
            page.imageRecordId = imageId
            if (--remaining === 0) {
              tx.objectStore('savedDocuments').add({
                ...snapshot,
                id: savedId,
                originalDocumentId: documentId,
                savedAt: Date.now(),
              })
              const next = {
                ...collection,
                documentIds: [...collection.documentIds, savedId],
                revision: collection.revision + 1,
                updatedAt: Date.now(),
              }
              tx.objectStore('collections').put(next)
              queueChange(tx, 'collections', collectionId)
              result(next)
            }
          }
        }
      }
    }
  })
}
export function loadCollection(id) {
  return transaction(['collections', 'savedDocuments'], 'readonly', (tx, result, fail) => {
    tx.objectStore('collections').get(id).onsuccess = (event) => {
      const collection = event.target.result
      if (!collection) {
        fail(new Error('Komplekts nav atrasts.'))
        return
      }
      const documents = new Array(collection.documentIds.length)
      result({ ...collection, documents })
      collection.documentIds.forEach((key, index) => {
        tx.objectStore('savedDocuments').get(key).onsuccess = (event) => {
          if (!event.target.result) fail(new Error('Trūkst komplekta dokumenta.'))
          else documents[index] = event.target.result
        }
      })
    }
  })
}
// Collect only records with no remaining draft aliases or collection references.
export async function removeCollectionDocument(collection, id) {
  const next = await updateCollection(collection.id, collection.revision, (item) => ({
    ...item,
    documentIds: item.documentIds.filter((key) => key !== id),
  }))
  await collectUnusedImages()
  return next
}
export async function deleteCollection(id, revision) {
  await transaction(['collections', SYNC_STORE], 'readwrite', (tx, result, fail) => {
    tx.objectStore('collections').get(id).onsuccess = (event) => {
      if (event.target.result?.revision !== revision) {
        fail(new Error('Komplekts ir mainīts.'))
        return
      }
      tx.objectStore('collections').delete(id)
      queueChange(tx, 'collections', id, true)
    }
  })
  await collectUnusedImages()
}
