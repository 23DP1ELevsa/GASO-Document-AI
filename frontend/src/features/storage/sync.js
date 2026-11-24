import { computed, ref, shallowRef } from 'vue'
import { newId } from '../scanning/id.js'
import {
  checkImage,
  lookupImages,
  sameImage,
  sha256,
  storageJson,
  uploadImage,
  StorageError,
} from './client.js'
import { IMAGE_BATCH_SIZE, mapConcurrent, restoreImages } from './images.js'
import {
  inspectLocal,
  listEntries,
  editEntry,
  captureLocal,
  findLocalImages,
  putRestored,
  queueMigration,
} from './local.js'
import {
  isSyncPaused,
  setSyncPaused,
  storageEvents,
  syncEnabled,
  SYNC_PAUSE_PREFERENCE,
  SYNC_PREFERENCE,
  syncKey,
} from './queue.js'

export const serverStorageEnabled = ref(syncEnabled())
export const storageConnection = ref('unchecked')
export const storageAction = ref('')
export const syncEntries = shallowRef([])
export const syncPaused = ref(isSyncPaused())
export const syncProgress = shallowRef(null)
let controller
let retryTimer
let started = false
let queuedDuringAction = false
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

const variants = ['original', 'processed', 'thumbnail']
const pagesOf = (kind, payload) =>
  kind === 'sessions' ? payload.pages : payload.documents.flatMap((document) => document.pages)

async function encodeLocal(kind, local, digests, signal) {
  const tasks = []
  const files = new Map()
  const encodePage = ({ metadata, imageRecordId, image }) => {
    const { thumbnail, original: _original, processed: _processed, ...fields } = metadata
    const result = { metadata: fields, imageRecordId }
    for (const [variant, blob] of [
      ['original', image.blob],
      ['processed', image.processed],
      ['thumbnail', thumbnail],
    ]) {
      if (blob) {
        result[variant] = null
        tasks.push({ result, variant, blob })
      } else if (image.remote?.[variant]) result[variant] = image.remote[variant]
    }
    if (!image.blob && !result.original) throw new StorageError('local_data_missing')
    return result
  }
  let payload
  if (kind === 'sessions') {
    const { cover, documents: _documents, ...metadata } = local.metadata
    payload = { metadata, documents: local.documents, pages: local.pages.map(encodePage) }
  } else {
    payload = {
      metadata: local.metadata,
      documents: local.documents.map(({ metadata, pages }) => ({
        metadata,
        pages: pages.map(encodePage),
      })),
    }
  }
  await mapConcurrent(tasks, signal, async ({ result, variant, blob }) => {
    if (!digests.has(blob)) digests.set(blob, sha256(blob))
    const hash = await digests.get(blob)
    result[variant] = { sha256: hash, size: blob.size }
    if (!files.has(hash)) files.set(hash, blob)
  })
  return { payload, files }
}

async function hydrate(kind, payload, signal, images) {
  const pages = pagesOf(kind, payload)
  const snapshots = kind === 'collections' ? payload.documents : null
  const { candidates, records } = await findLocalImages(pages, snapshots)
  const seen = new Map()
  const hydrated = pages.map(({ metadata, imageRecordId, original, processed, thumbnail }) => {
    if (!original) throw new StorageError('storage_integrity_error')
    const previous = seen.get(imageRecordId)
    if (
      previous &&
      (!sameImage(previous.original, original) || !sameImage(previous.processed, processed))
    )
      throw new StorageError('image_integrity_error')
    seen.set(imageRecordId, { original, processed })
    const record = records.get(imageRecordId)
    if (record === null || (record && !processed && (record.processed || record.remote?.processed)))
      throw new StorageError('local_revision_conflict', 409)
    return {
      imageRecordId,
      metadata: { ...metadata, ...(snapshots ? { imageRecordId } : {}) },
      image: { id: imageRecordId, remote: { original, processed } },
      thumbnail,
      hadImage: records.has(imageRecordId),
      repair: record && (!record.blob || (processed && !record.processed)),
    }
  })
  const tasks = pages.flatMap((page, index) =>
    variants
      .filter((variant) => page[variant])
      .map((variant) => ({ variant, asset: page[variant], index })),
  )
  await mapConcurrent(tasks, signal, async ({ variant, asset, index }) => {
    const page = hydrated[index]
    const field = variant === 'original' ? 'blob' : 'processed'
    const record = records.get(page.imageRecordId)
    if (record && variant !== 'thumbnail') {
      const compatible = record[field]
        ? await images.verified(record[field], asset)
        : sameImage(record.remote?.[variant], asset)
      if (!compatible) throw new StorageError('local_revision_conflict', 409)
    }
    const blob = await images.read(asset, candidates.get(asset.sha256) || [])
    if (variant === 'thumbnail') page.metadata.thumbnail = blob
    else page.image[field] = blob
  })
  if (kind === 'sessions') return { ...payload, pages: hydrated }
  let index = 0
  return {
    ...payload,
    documents: payload.documents.map((document) => {
      const pages = hydrated.slice(index, index + document.pages.length)
      index += pages.length
      return { ...document, pages }
    }),
  }
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

function updateProgress(fields) {
  syncProgress.value = { ...syncProgress.value, ...fields }
}

function published(documents) {
  updateProgress({
    roots: syncProgress.value.roots + 1,
    documents: syncProgress.value.documents + documents,
  })
}

async function recordError(entry, error, signal) {
  if (entry) {
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
  }
  if (signal.aborted || error.code === 'storage_unavailable') throw error
}

async function recover(entry, signal) {
  if (entry.inFlight) {
    const remote = await head(entry.kind, entry.rootId, signal)
    if (remote && remote.mutationId === entry.inFlight) {
      const current = await acknowledge(entry, remote.mutationId, remote.revision)
      if (current?.status === 'synced') {
        const local = await captureLocal(current).catch(() => null)
        published(local?.documents?.length || 0)
      }
      return current?.status === 'synced' || current?.status === 'local' ? null : current
    }
    if ((remote?.revision || 0) !== entry.base) throw new StorageError('revision_conflict', 409)
  }
  return entry
}

async function publish({ entry, payload, documents }, signal) {
  signal.throwIfAborted()
  const flight = await editEntry(entry.id, (current) =>
    current?.mutationId === entry.mutationId && current.status !== 'local'
      ? { ...current, status: 'syncing', inFlight: current.mutationId }
      : null,
  )
  if (!flight) return
  let result
  let revision = flight.base + 1
  try {
    result = await storageJson(endpoint(entry.kind, entry.rootId), {
      method: payload ? 'PUT' : 'DELETE',
      signal,
      body: { expectedRevision: flight.base, mutationId: flight.mutationId, payload },
    })
  } catch (error) {
    if (payload || flight.base !== 0 || error.code !== 'not_found') throw error
    revision = 0
    result = { mutationId: flight.mutationId, revision }
  }
  if (result.mutationId !== flight.mutationId || result.revision !== revision)
    throw new StorageError('storage_integrity_error')
  await acknowledge(entry, result.mutationId, result.revision)
  published(documents)
}

async function transferImages(files, signal) {
  const errors = new Map()
  const uploads = []
  const requests = new Map()
  const hashes = [...files.keys()]
  for (let index = 0; index < hashes.length; index += IMAGE_BATCH_SIZE) {
    const batch = hashes.slice(index, index + IMAGE_BATCH_SIZE)
    const { assets, invalid } = await lookupImages(batch, signal)
    for (const hash of batch) {
      const blob = files.get(hash)
      try {
        if (invalid.has(hash)) throw new StorageError('image_integrity_error')
        if (!assets.has(hash)) {
          uploads.push([hash, blob])
          continue
        }
        checkImage(assets.get(hash), hash, blob)
        updateProgress({ reused: syncProgress.value.reused + 1 })
      } catch (error) {
        errors.set(hash, error)
      }
    }
  }
  updateProgress({ phase: 'images' })
  await mapConcurrent(uploads, signal, async ([hash, blob]) => {
    try {
      await uploadImage(hash, blob, requests, signal)
      updateProgress({
        uploaded: syncProgress.value.uploaded + 1,
        bytes: syncProgress.value.bytes + blob.size,
      })
    } catch (error) {
      if (signal.aborted || error.code === 'storage_unavailable') throw error
      errors.set(hash, error)
    }
  })
  return errors
}

async function flush(signal) {
  if (!serverStorageEnabled.value || syncPaused.value) return
  const entries = (await listEntries()).filter((entry) =>
    ['pending', 'error', 'syncing'].includes(entry.status),
  )
  if (!entries.length) return
  syncProgress.value = {
    phase: 'prepare',
    totalRoots: entries.length,
    totalImages: null,
    roots: 0,
    documents: 0,
    reused: 0,
    uploaded: 0,
    bytes: 0,
  }
  try {
    if (!(await checkStorage(signal))) {
      updateProgress({ phase: 'interrupted' })
      return
    }
    const digests = new WeakMap()
    const files = new Map()
    const planned = []
    for (let entry of entries) {
      signal.throwIfAborted()
      try {
        entry = await recover(entry, signal)
        if (!entry) continue
        const local = await captureLocal(entry)
        if (!local) continue
        const plan = local.deleted ? null : await encodeLocal(entry.kind, local, digests, signal)
        for (const [hash, blob] of plan?.files || []) if (!files.has(hash)) files.set(hash, blob)
        planned.push({
          entry,
          payload: plan?.payload,
          documents: local.documents?.length || 0,
          hashes: [...(plan?.files.keys() || [])],
        })
      } catch (error) {
        await recordError(entry, error, signal)
      }
    }
    updateProgress({ phase: 'check', totalImages: files.size })
    const errors = await transferImages(files, signal)
    files.clear()
    updateProgress({ phase: 'publish' })
    await mapConcurrent(planned, signal, async (plan) => {
      try {
        for (const hash of plan.hashes) if (errors.has(hash)) throw errors.get(hash)
        await publish(plan, signal)
      } catch (error) {
        await recordError(plan.entry, error, signal)
      }
    })
    updateProgress({ phase: syncProgress.value.roots === entries.length ? 'done' : 'partial' })
  } catch (error) {
    if (error.code === 'storage_unavailable') storageConnection.value = error.code
    updateProgress({ phase: syncPaused.value ? 'paused' : 'interrupted' })
    throw error
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
    await refreshEntries().catch(() => {})
    controller = undefined
    storageAction.value = ''
    if (queuedDuringAction) {
      queuedDuringAction = false
      schedule()
    }
  }
}

export function cancelStorage() {
  controller?.abort()
}

export function pauseSync() {
  setSyncPaused(true)
}

export function resumeSync() {
  setSyncPaused(false)
  return syncNow()
}

export function syncNow() {
  return perform('sync', flush)
}

export function migrateLocal() {
  return perform('migration', async (signal) => {
    if (!serverStorageEnabled.value || syncPaused.value) return
    await queueMigration()
    await refreshEntries()
    await flush(signal)
  })
}

async function pull(kind, remote, previous, signal, images) {
  const data = remote.deleted ? remote : await storageJson(endpoint(kind, remote.id), { signal })
  if (data.revision !== remote.revision || data.deleted !== remote.deleted)
    throw new StorageError('revision_conflict', 409)
  const hydrated = data.deleted ? null : await hydrate(kind, data.payload, signal, images)
  signal.throwIfAborted()
  if (!(await putRestored(kind, data, hydrated, previous)))
    throw new StorageError('local_revision_conflict', 409)
  if (!hydrated) return
  if (kind === 'sessions') {
    for (const page of hydrated.pages) images.register(page)
  } else {
    for (const document of hydrated.documents)
      for (const page of document.pages) images.register(page, document.metadata.id)
  }
}

export function restoreFromServer() {
  return perform('restore', async (signal) => {
    if (!(await checkStorage(signal))) throw new StorageError(storageConnection.value)
    const images = restoreImages(signal)
    let restored = 0
    for (const kind of ['sessions', 'collections']) {
      let after = null
      do {
        const response = await storageJson(
          '/' + kind + '?includeDeleted=1' + (after ? '&after=' + encodeURIComponent(after) : ''),
          { signal },
        )
        await mapConcurrent(response.items, signal, async (remote) => {
          signal.throwIfAborted()
          const previous = await inspectLocal(kind, remote.id)
          if (!previous.root && !previous.entry) {
            if (!remote.deleted) {
              await pull(kind, remote, previous, signal, images)
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
        })
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
      await pull(entry.kind, remote, previous, signal, restoreImages(signal))
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
  retryTimer = undefined
  if (!serverStorageEnabled.value || syncPaused.value || !navigator.onLine) return
  retryTimer = setTimeout(async () => {
    retryTimer = undefined
    if (!controller) await syncNow().catch(() => {})
    if (retryTimer === undefined) schedule(30_000)
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
  const pause = () => {
    syncPaused.value = isSyncPaused()
    if (syncPaused.value && ['sync', 'migration'].includes(storageAction.value)) cancelStorage()
    update()
  }
  storageEvents.addEventListener('queued', () => {
    if (controller) queuedDuringAction = true
    update()
  })
  storageEvents.addEventListener('mode', mode)
  storageEvents.addEventListener('pause', pause)
  window.addEventListener('storage', (event) => {
    if (event.key === SYNC_PREFERENCE) mode()
    if (event.key === SYNC_PAUSE_PREFERENCE) pause()
  })
  window.addEventListener('online', update)
  update()
}
