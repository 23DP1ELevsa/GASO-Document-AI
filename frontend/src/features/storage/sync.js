import { computed, ref, shallowRef } from 'vue'
import { newId } from '../scanning/id.js'
import { storageJson, uploadImage, readRemoteImage, StorageError } from './client.js'
import {
  inspectLocal,
  listEntries,
  editEntry,
  captureLocal,
  putRestored,
  queueMigration,
} from './local.js'
import { storageEvents, syncEnabled, SYNC_PREFERENCE, syncKey } from './queue.js'

export const serverStorageEnabled = ref(syncEnabled())
export const storageConnection = ref('unchecked')
export const storageAction = ref('')
export const syncEntries = shallowRef([])
let controller
let retryTimer
let started = false
const endpoint = (kind, id) => '/' + kind + '/' + encodeURIComponent(id)

export const storageLabels = {
  local: 'Saglabāts ierīcē',
  pending: 'Gaida sinhronizāciju',
  syncing: 'Sinhronizē…',
  synced: 'Saglabāts serverī',
  error: 'Sinhronizācijas kļūda',
  conflict: 'Datu konflikts',
}

export function storageLabel(kind, id) {
  return storageLabels[
    syncEntries.value.find((entry) => entry.id === syncKey(kind, id))?.status || 'local'
  ]
}

async function refreshEntries() {
  syncEntries.value = await listEntries()
}

export async function checkStorage(signal) {
  try {
    await storageJson('/status', { signal })
    storageConnection.value = 'connected'
  } catch (error) {
    if (signal?.aborted) throw error
    storageConnection.value = error.code || 'storage_unavailable'
  }
  return storageConnection.value === 'connected'
}

async function head(kind, id, signal) {
  try {
    return await storageJson(endpoint(kind, id) + '?summary=1', { signal })
  } catch (error) {
    if (error.code !== 'not_found') throw error
    return null
  }
}

async function encodeLocal(kind, local, assets, signal) {
  const encodePage = async ({ metadata, imageRecordId, image }) => {
    const { thumbnail, original: _original, processed: _processed, ...fields } = metadata
    const result = { metadata: fields, imageRecordId }
    for (const [variant, blob] of [
      ['original', image.blob],
      ['processed', image.processed],
      ['thumbnail', thumbnail],
    ]) {
      signal.throwIfAborted()
      if (blob) result[variant] = await uploadImage(blob, assets, signal)
      else if (image.remote?.[variant]) result[variant] = image.remote[variant]
    }
    if (!result.original) throw new StorageError('local_data_missing')
    return result
  }
  const encodePages = async (pages) => {
    const result = []
    for (const page of pages) result.push(await encodePage(page))
    return result
  }
  if (kind === 'sessions') {
    const { cover, documents: _documents, ...metadata } = local.metadata
    return { metadata, documents: local.documents, pages: await encodePages(local.pages) }
  }
  const documents = []
  for (const { metadata, pages } of local.documents)
    documents.push({ metadata, pages: await encodePages(pages) })
  return { metadata: local.metadata, documents }
}

async function hydrate(kind, payload, signal, assets) {
  const read = async (image) => {
    if (!image) return undefined
    if (!assets.has(image.sha256)) assets.set(image.sha256, await readRemoteImage(image, signal))
    const blob = assets.get(image.sha256)
    if (blob.size !== image.size || blob.type !== image.mime)
      throw new StorageError('image_integrity_error')
    return blob
  }
  const pages = async (items, saved = false) => {
    const hydrated = []
    for (const { metadata, imageRecordId, original, processed, thumbnail } of items) {
      const thumb = await read(thumbnail)
      hydrated.push({
        imageRecordId,
        metadata: {
          ...metadata,
          ...(saved ? { imageRecordId } : {}),
          ...(thumb ? { thumbnail: thumb } : {}),
        },
        image: {
          id: imageRecordId,
          blob: await read(original),
          processed: await read(processed),
          remote: { original, processed },
        },
      })
    }
    return hydrated
  }
  if (kind === 'sessions') return { ...payload, pages: await pages(payload.pages) }
  const documents = []
  for (const document of payload.documents)
    documents.push({ ...document, pages: await pages(document.pages, true) })
  return { ...payload, documents }
}

function acknowledge(entry, mutationId, revision) {
  return editEntry(entry.id, (current) => {
    if (current?.inFlight !== mutationId) return null
    return {
      ...current,
      inFlight: null,
      base: revision,
      status: current.mutationId === mutationId ? 'synced' : current.status,
      error: null,
    }
  })
}

async function push(entry, assets, signal) {
  try {
    const remote = await head(entry.kind, entry.rootId, signal)
    if (remote && remote.mutationId === entry.inFlight) {
      entry = await acknowledge(entry, remote.mutationId, remote.revision)
      if (!entry || entry.status === 'synced' || entry.status === 'local') return
    }
    if ((remote?.revision || 0) !== entry.base) throw new StorageError('revision_conflict', 409)
    const local = await captureLocal(entry)
    if (!local) return
    const payload = local.deleted ? undefined : await encodeLocal(entry.kind, local, assets, signal)
    signal.throwIfAborted()
    const flight = await editEntry(entry.id, (current) =>
      current?.mutationId === entry.mutationId
        ? { ...current, status: 'syncing', inFlight: current.mutationId }
        : null,
    )
    if (!flight) return
    const result =
      local.deleted && !remote
        ? { mutationId: flight.mutationId, revision: 0 }
        : await storageJson(endpoint(entry.kind, entry.rootId), {
            method: local.deleted ? 'DELETE' : 'PUT',
            signal,
            body: { expectedRevision: flight.base, mutationId: flight.mutationId, payload },
          })
    if (
      result.mutationId !== flight.mutationId ||
      result.revision !== (remote?.revision || 0) + (local.deleted && !remote ? 0 : 1)
    )
      throw new StorageError('storage_integrity_error')
    await acknowledge(entry, result.mutationId, result.revision)
  } catch (error) {
    if (!entry) throw error
    const conflict = error.status === 409
    await editEntry(entry.id, (current) =>
      current?.mutationId === entry.mutationId
        ? {
            ...current,
            status: conflict
              ? 'conflict'
              : signal.aborted || !navigator.onLine
                ? 'pending'
                : 'error',
            error: signal.aborted ? null : error.code || 'local_data_missing',
          }
        : null,
    )
    if (signal.aborted || error.code === 'storage_unavailable') throw error
  }
}

async function flush(signal) {
  if (!serverStorageEnabled.value) return
  const entries = (await listEntries()).filter((entry) =>
    ['pending', 'error', 'syncing'].includes(entry.status),
  )
  if (!entries.length || !(await checkStorage(signal))) return
  const assets = new Map()
  for (const entry of entries) {
    if (signal.aborted || !serverStorageEnabled.value) break
    syncEntries.value = syncEntries.value.map((item) =>
      item.id === entry.id && item.mutationId === entry.mutationId
        ? { ...item, status: 'syncing' }
        : item,
    )
    try {
      await push(entry, assets, signal)
    } catch (error) {
      if (error.code === 'storage_unavailable') storageConnection.value = error.code
      throw error
    }
    await refreshEntries()
  }
}

async function perform(action, work) {
  if (controller) throw new StorageError('sync_busy')
  controller = new AbortController()
  storageAction.value = action
  const { signal } = controller
  try {
    if (navigator.locks)
      return await navigator.locks.request('gaso-document-storage', { signal }, () => work(signal))
    return await work(signal)
  } finally {
    controller = undefined
    storageAction.value = ''
    await refreshEntries().catch(() => {})
  }
}

export function cancelStorage() {
  controller?.abort()
}

export function syncNow() {
  return perform('sync', flush)
}

export function migrateLocal() {
  return perform('migration', async (signal) => {
    if (!serverStorageEnabled.value) return
    await queueMigration()
    await refreshEntries()
    await flush(signal)
  })
}

async function pull(kind, remote, previous, signal) {
  const data = remote.deleted ? remote : await storageJson(endpoint(kind, remote.id), { signal })
  if (data.revision !== remote.revision || data.deleted !== remote.deleted)
    throw new StorageError('revision_conflict', 409)
  const hydrated = data.deleted ? null : await hydrate(kind, data.payload, signal, new Map())
  signal.throwIfAborted()
  if (!(await putRestored(kind, data, hydrated, previous)))
    throw new StorageError('local_revision_conflict', 409)
}

export function restoreFromServer() {
  return perform('restore', async (signal) => {
    if (!(await checkStorage(signal))) throw new StorageError(storageConnection.value)
    let restored = 0
    for (const kind of ['sessions', 'collections']) {
      let after = null
      do {
        const response = await storageJson(
          '/' + kind + '?includeDeleted=1' + (after ? '&after=' + encodeURIComponent(after) : ''),
          { signal },
        )
        for (const remote of response.items) {
          signal.throwIfAborted()
          const previous = await inspectLocal(kind, remote.id)
          if (!previous.root && !previous.entry) {
            if (!remote.deleted) {
              await pull(kind, remote, previous, signal)
              restored++
            }
          } else if (
            previous.entry?.inFlight !== remote.mutationId &&
            (previous.entry?.base || 0) !== remote.revision &&
            (previous.root || previous.entry?.base)
          ) {
            const next = {
              id: syncKey(kind, remote.id),
              kind,
              rootId: remote.id,
              base: 0,
              mutationId: newId(),
              ...previous.entry,
              status: 'conflict',
              error: 'revision_conflict',
            }
            await editEntry(next.id, (current) =>
              current?.mutationId === previous.entry?.mutationId ? next : null,
            )
          }
        }
        after = response.next
      } while (after)
    }
    return restored
  })
}

export function resolveConflict(entry, choice, confirmChoice) {
  return perform(choice === 'server' ? 'restore' : 'sync', async (signal) => {
    const previous = await inspectLocal(entry.kind, entry.rootId)
    if (previous.entry?.mutationId !== entry.mutationId || previous.entry.status !== 'conflict')
      throw new StorageError('local_revision_conflict', 409)
    const remote = await head(entry.kind, entry.rootId, signal)
    const revision = remote?.revision || 0
    if (
      !confirmChoice({ revision, deleted: !remote || remote.deleted, updatedAt: remote?.updatedAt })
    )
      return
    signal.throwIfAborted()
    if (choice === 'server') {
      if (!remote) throw new StorageError('not_found', 404)
      await pull(entry.kind, remote, previous, signal)
    } else {
      if (!serverStorageEnabled.value) throw new StorageError('storage_disabled')
      const next = await editEntry(entry.id, (current) =>
        current?.mutationId === entry.mutationId
          ? { ...current, base: revision, inFlight: null, mutationId: newId(), status: 'pending' }
          : null,
      )
      if (!next) throw new StorageError('local_revision_conflict', 409)
      await flush(signal)
    }
  })
}

export const conflictingEntries = computed(() =>
  syncEntries.value.filter((item) => item.status === 'conflict'),
)

function schedule(delay = 400) {
  clearTimeout(retryTimer)
  if (!serverStorageEnabled.value || !navigator.onLine) return
  retryTimer = setTimeout(async () => {
    if (!controller) await syncNow().catch(() => {})
    schedule(30_000)
  }, delay)
}

export function startStorage() {
  if (started) return
  started = true
  const update = () => {
    refreshEntries().catch(() => {})
    schedule()
  }
  const mode = () => {
    serverStorageEnabled.value = syncEnabled()
    if (!serverStorageEnabled.value) cancelStorage()
    update()
  }
  storageEvents.addEventListener('queued', update)
  storageEvents.addEventListener('mode', mode)
  window.addEventListener('storage', (event) => {
    if (event.key === SYNC_PREFERENCE) mode()
  })
  window.addEventListener('online', update)
  update()
}
