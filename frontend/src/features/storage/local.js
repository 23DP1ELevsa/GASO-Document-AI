import { newId } from '../scanning/id.js'
import { migrateGrouping } from '../documents/model.js'
import {
  DATA_STORES,
  transaction,
  resolveImageRecord,
  collectUnusedImages,
} from '../scanning/draftRepository.js'
import { SYNC_STORE, storageEvents, syncKey } from './queue.js'
import { sameImage, StorageError } from './client.js'

const stores = [...DATA_STORES, SYNC_STORE]
const rootStore = (kind) => (kind === 'sessions' ? 'drafts' : 'collections')

export function listEntries() {
  return transaction([SYNC_STORE], 'readonly', (tx, result) => {
    tx.objectStore(SYNC_STORE).getAll().onsuccess = ({ target }) => result(target.result)
  })
}

export function editEntry(id, edit) {
  return transaction([SYNC_STORE], 'readwrite', (tx, result) => {
    const store = tx.objectStore(SYNC_STORE)
    store.get(id).onsuccess = ({ target }) => {
      const next = edit(target.result)
      if (next) store.put(next)
      result(next)
    }
  })
}

export function queueMigration() {
  return transaction(['drafts', 'collections', SYNC_STORE], 'readwrite', (tx) => {
    const queue = tx.objectStore(SYNC_STORE)
    for (const kind of ['sessions', 'collections']) {
      tx.objectStore(rootStore(kind)).getAllKeys().onsuccess = ({ target }) => {
        for (const rootId of target.result) {
          const id = syncKey(kind, rootId)
          queue.get(id).onsuccess = ({ target }) => {
            if (target.result?.status === 'local')
              queue.put({ ...target.result, status: 'pending' })
            else if (!target.result)
              queue.put({ id, kind, rootId, status: 'pending', mutationId: newId(), base: 0 })
          }
        }
      }
    }
  })
}

export function captureLocal(entry) {
  const { kind, rootId, id, mutationId } = entry
  return transaction(stores, 'readonly', (tx, result, fail) => {
    const get = (name, key, read) => {
      tx.objectStore(name).get(key).onsuccess = ({ target }) => {
        try {
          read(target.result)
        } catch (error) {
          fail(error)
        }
      }
    }
    const page = (metadata, imageRecordId) => {
      if (!metadata) throw new StorageError('local_data_missing')
      const record = { metadata, imageRecordId }
      resolveImageRecord(
        tx.objectStore('images'),
        imageRecordId,
        (image) => {
          record.image = image
        },
        fail,
      )
      return record
    }
    get(SYNC_STORE, id, (state) => {
      if (state?.mutationId !== mutationId) return result(null)
      if (state.deleted) return result({ deleted: true })
      get(rootStore(kind), rootId, (metadata) => {
        if (!metadata) throw new StorageError('local_data_missing')
        if (kind === 'sessions') {
          const pages = new Array(metadata.pageIds.length)
          result({
            metadata: { ...metadata, schemaVersion: 2 },
            pages,
            documents: metadata.documents || [],
          })
          metadata.pageIds.forEach((id, index) =>
            get('pages', id, (item) => {
              pages[index] = page(item, id)
            }),
          )
        } else {
          const documents = new Array(metadata.documentIds.length)
          result({ metadata, documents })
          metadata.documentIds.forEach((id, index) =>
            get('savedDocuments', id, (item) => {
              if (!item) throw new StorageError('local_data_missing')
              const { pages, ...document } = item
              documents[index] = {
                metadata: document,
                pages: pages.map((item) => page(item, item.imageRecordId)),
              }
            }),
          )
        }
      })
    })
  })
}

export function inspectLocal(kind, id) {
  return transaction([rootStore(kind), SYNC_STORE], 'readonly', (tx, result) => {
    const value = {}
    result(value)
    tx.objectStore(rootStore(kind)).get(id).onsuccess = ({ target }) => {
      value.root = target.result
    }
    tx.objectStore(SYNC_STORE).get(syncKey(kind, id)).onsuccess = ({ target }) => {
      value.entry = target.result
    }
  })
}

export function findLocalImages(pages, snapshots) {
  return transaction(['images', 'pages', 'savedDocuments'], 'readonly', (tx, result) => {
    const candidates = new Map()
    const records = new Map()
    result({ candidates, records })
    const add = (image, blob) => {
      if (!image || !blob || blob.size !== image.size || blob.type !== image.mime) return
      if (!candidates.has(image.sha256)) candidates.set(image.sha256, new Set())
      candidates.get(image.sha256).add(blob)
    }
    const images = tx.objectStore('images')
    for (const { metadata, imageRecordId, original, processed, thumbnail } of pages) {
      const read = () =>
        resolveImageRecord(
          images,
          imageRecordId,
          (record) => {
            if (snapshots) records.set(imageRecordId, record)
            add(original, record.blob)
            add(processed, record.processed)
          },
          () => {},
        )
      if (snapshots) {
        images.getKey(imageRecordId).onsuccess = ({ target }) => {
          if (!target.result) return
          records.set(imageRecordId, null)
          read()
        }
      } else read()
      if (thumbnail) {
        tx.objectStore('pages').get(metadata.id).onsuccess = ({ target }) => {
          add(thumbnail, target.result?.thumbnail)
        }
      }
    }
    for (const snapshot of snapshots || []) {
      tx.objectStore('savedDocuments').get(snapshot.metadata.id).onsuccess = ({ target }) => {
        const local = new Map(
          target.result?.pages?.map((page) => [page.imageRecordId, page.thumbnail]),
        )
        for (const page of snapshot.pages) add(page.thumbnail, local.get(page.imageRecordId))
      }
    }
  })
}

export function rememberLocalAsset(index, image, location) {
  if (!image) return
  index.delete(image.sha256)
  if (index.size >= 4096) index.delete(index.keys().next().value)
  index.set(image.sha256, location)
}

export function indexLocalAssets() {
  return transaction(['images'], 'readonly', (tx, result) => {
    const index = new Map()
    result(index)
    tx.objectStore('images').openCursor().onsuccess = ({ target }) => {
      const cursor = target.result
      if (!cursor) return
      const { id, blob, processed, remote } = cursor.value
      for (const [image, value, variant] of [
        [remote?.original, blob, 'blob'],
        [remote?.processed, processed, 'processed'],
      ]) {
        if (!image || !value || image.size !== value.size || image.mime !== value.type) continue
        rememberLocalAsset(index, image, { id, variant })
      }
      cursor.continue()
    }
  })
}

export function readLocalThumbnail({ store, id, imageRecordId }) {
  return transaction([store], 'readonly', (tx, result) => {
    tx.objectStore(store).get(id).onsuccess = ({ target }) => {
      const record = target.result
      result(
        store === 'pages'
          ? record?.thumbnail
          : record?.pages?.find((page) => page.imageRecordId === imageRecordId)?.thumbnail,
      )
    }
  })
}

export async function putRestored(kind, remote, hydrated, previous) {
  const { id, revision, deleted, mutationId } = remote
  if (kind === 'sessions' && !deleted)
    migrateGrouping({
      ...hydrated.metadata,
      documents: hydrated.documents,
      pages: hydrated.pages.map((page) => page.metadata),
    })
  const changed = await transaction(stores, 'readwrite', (tx, result, fail) => {
    const roots = tx.objectStore(rootStore(kind))
    const sync = tx.objectStore(SYNC_STORE)
    roots.get(id).onsuccess = ({ target }) => {
      const current = target.result
      sync.get(syncKey(kind, id)).onsuccess = ({ target }) => {
        try {
          if (
            target.result?.mutationId !== previous.entry?.mutationId ||
            current?.revision !== previous.root?.revision
          )
            return result(false)
          const savedImageIds = new Set()
          const savePages = (pages, snapshots) =>
            pages.map(({ image, metadata, imageRecordId, hadImage, repair }) => {
              const images = tx.objectStore('images')
              if (snapshots && !savedImageIds.has(imageRecordId)) {
                savedImageIds.add(imageRecordId)
                // A snapshot image ID is immutable and can be shared across collections.
                images.get(imageRecordId).onsuccess = ({ target }) => {
                  const current = target.result
                  if (!current) images.add(image)
                  else if (repair) images.put(image)
                  else if (
                    !hadImage &&
                    ['original', 'processed'].some(
                      (variant) => !sameImage(image.remote[variant], current.remote?.[variant]),
                    )
                  )
                    fail(new StorageError('local_revision_conflict', 409))
                }
              } else if (!snapshots) {
                images.put(image)
                tx.objectStore('pages').put(metadata)
              }
              return metadata
            })
          if (kind === 'sessions') {
            for (const pageId of current?.pageIds || []) {
              if (hydrated?.metadata.pageIds.includes(pageId)) continue
              tx.objectStore('pages').delete(pageId)
              tx.objectStore('images').delete(pageId)
            }
          }
          if (deleted) roots.delete(id)
          else {
            const metadata = {
              ...hydrated.metadata,
              revision: Math.max(hydrated.metadata.revision, (current?.revision || 0) + 1),
            }
            if (kind === 'sessions') {
              savePages(hydrated.pages, false)
              roots.put({
                ...metadata,
                documents: hydrated.documents,
                cover: hydrated.pages[0]?.metadata.thumbnail || null,
              })
            } else {
              for (const snapshot of hydrated.documents)
                tx.objectStore('savedDocuments').put({
                  ...snapshot.metadata,
                  pages: savePages(snapshot.pages, true),
                })
              roots.put(metadata)
            }
          }
          sync.put({
            id: syncKey(kind, id),
            rootId: id,
            kind,
            base: revision,
            deleted,
            status: 'synced',
            mutationId,
          })
          result(true)
        } catch (error) {
          fail(error)
        }
      }
    }
  })
  if (changed) {
    if (previous.root) await collectUnusedImages().catch(() => {})
    storageEvents.dispatchEvent(new CustomEvent('restored', { detail: { kind, id, deleted } }))
  }
  return changed
}
