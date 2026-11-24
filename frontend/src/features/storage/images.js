import { readLocalImageRecord } from '../scanning/draftRepository.js'
import { readRemoteImage, sha256, StorageError } from './client.js'
import { indexLocalAssets, readLocalThumbnail, rememberLocalAsset } from './local.js'

const configuredConcurrency = Number(import.meta.env?.VITE_STORAGE_IMAGE_CONCURRENCY)
const IMAGE_CONCURRENCY = [2, 3, 4].includes(configuredConcurrency) ? configuredConcurrency : 4
export const IMAGE_BATCH_SIZE = 200
const CACHE_BYTES = 64 * 1024 * 1024
const CACHE_ENTRIES = 256

export async function mapConcurrent(items, signal, work) {
  const results = new Array(items.length)
  let next = 0
  let failed = false
  const workers = Array.from({ length: Math.min(IMAGE_CONCURRENCY, items.length) }, async () => {
    try {
      while (!failed && next < items.length) {
        signal.throwIfAborted()
        const index = next++
        results[index] = await work(items[index], index)
      }
    } catch (error) {
      failed = true
      throw error
    }
  })
  const settled = await Promise.allSettled(workers)
  signal.throwIfAborted()
  const rejected = settled.find((item) => item.status === 'rejected')
  if (rejected) throw rejected.reason
  return results
}

export function restoreImages(signal) {
  const cached = new Map()
  const pending = new Map()
  const restored = new Map()
  const digests = new WeakMap()
  let bytes = 0
  let index
  let active = 0
  const waiting = []

  const matches = (blob, image) => blob && blob.size === image.size && blob.type === image.mime

  async function verified(blob, image) {
    signal.throwIfAborted()
    if (!matches(blob, image)) return false
    if (!digests.has(blob)) digests.set(blob, sha256(blob))
    return (await digests.get(blob)) === image.sha256
  }

  async function load(image, candidates) {
    for (const blob of candidates) if (await verified(blob, image)) return blob
    index ??= indexLocalAssets()
    const location = restored.get(image.sha256) || (await index).get(image.sha256)
    if (location) {
      const { id, variant } = location
      const blob = location.store
        ? await readLocalThumbnail(location)
        : (await readLocalImageRecord(id).catch(() => null))?.[variant]
      if (await verified(blob, image)) return blob
    }
    return readRemoteImage(image, signal)
  }

  function remember(hash, blob) {
    if (blob.size > CACHE_BYTES) return
    cached.set(hash, blob)
    bytes += blob.size
    while (bytes > CACHE_BYTES || cached.size > CACHE_ENTRIES) {
      const [oldest, oldBlob] = cached.entries().next().value
      cached.delete(oldest)
      bytes -= oldBlob.size
    }
  }

  async function limitedLoad(image, candidates) {
    if (active === IMAGE_CONCURRENCY) await new Promise((resolve) => waiting.push(resolve))
    else active++
    try {
      signal.throwIfAborted()
      return await load(image, candidates)
    } finally {
      if (waiting.length) waiting.shift()()
      else active--
    }
  }

  async function read(image, candidates) {
    const hash = image.sha256
    let blob = cached.get(hash)
    if (blob) {
      cached.delete(hash)
      cached.set(hash, blob)
    } else {
      if (!pending.has(hash)) {
        pending.set(
          hash,
          limitedLoad(image, candidates)
            .then((loaded) => {
              remember(hash, loaded)
              return loaded
            })
            .finally(() => pending.delete(hash)),
        )
      }
      blob = await pending.get(hash)
    }
    if (!matches(blob, image)) throw new StorageError('image_integrity_error')
    return blob
  }

  function register({ metadata, imageRecordId, image, thumbnail }, snapshotId) {
    rememberLocalAsset(restored, image.remote.original, { id: imageRecordId, variant: 'blob' })
    rememberLocalAsset(restored, image.remote.processed, {
      id: imageRecordId,
      variant: 'processed',
    })
    rememberLocalAsset(
      restored,
      thumbnail,
      snapshotId
        ? { store: 'savedDocuments', id: snapshotId, imageRecordId }
        : { store: 'pages', id: metadata.id },
    )
  }

  return { read, verified, register }
}
