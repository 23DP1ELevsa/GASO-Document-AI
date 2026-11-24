import { accountHeaders, accountRequestSignal, checkAccountResponse } from '../auth/scope.js'

const prefix = '/api/storage/v1'

export class StorageError extends Error {
  constructor(code, status) {
    super(code)
    this.code = code
    this.status = status
  }
}

export async function storageRequest(path, { method = 'GET', body, signal } = {}) {
  const headers = { Accept: 'application/json', 'X-GASO-Storage': '1', ...accountHeaders() }
  if (body !== undefined && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(body)
  }
  const lifetime = accountRequestSignal()
  const signals = [lifetime, AbortSignal.timeout(60_000)]
  if (signal) signals.push(signal)
  let response
  try {
    response = await fetch(prefix + path, {
      method,
      headers,
      body,
      signal: AbortSignal.any(signals),
      cache: 'no-store',
      credentials: 'same-origin',
    })
  } catch (error) {
    if (signal?.aborted || lifetime.aborted) throw error
    throw new StorageError('storage_unavailable')
  }
  if (!response.ok) {
    checkAccountResponse(response)
    const payload = await response.json().catch(() => null)
    throw new StorageError(payload?.error?.code || 'storage_unavailable', response.status)
  }
  lifetime.throwIfAborted()
  return response
}

export async function storageJson(path, options) {
  const response = await storageRequest(path, options)
  try {
    return await response.json()
  } catch {
    options?.signal?.throwIfAborted()
    throw new StorageError('storage_unavailable', response.status)
  }
}

export async function sha256(blob) {
  const hash = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  return Array.from(new Uint8Array(hash), (value) => value.toString(16).padStart(2, '0')).join('')
}

export function checkImage(image, hash, blob) {
  if (
    image?.sha256 !== hash ||
    image.size !== blob.size ||
    image.mime !== (blob.type === 'image/jpg' ? 'image/jpeg' : blob.type)
  )
    throw new StorageError('image_integrity_error')
}

export function sameImage(first, second) {
  return (
    first?.sha256 === second?.sha256 && first?.size === second?.size && first?.mime === second?.mime
  )
}

export async function readRemoteImage(image, signal) {
  const response = await storageRequest('/images/' + image.sha256, { signal })
  const blob = await response.blob().catch(() => {
    signal?.throwIfAborted()
    throw new StorageError('storage_unavailable', response.status)
  })
  if (
    blob.size !== image.size ||
    blob.type !== image.mime ||
    response.headers.get('X-Content-SHA256') !== image.sha256 ||
    (await sha256(blob)) !== image.sha256
  )
    throw new StorageError('image_integrity_error')
  return blob
}

export async function lookupImages(hashes, signal) {
  const result = await storageJson('/assets/check', { method: 'POST', body: { hashes }, signal })
  if (!Array.isArray(result?.assets) || !Array.isArray(result.invalid))
    throw new StorageError('storage_integrity_error')
  const requested = new Set(hashes)
  const assets = new Map()
  const invalid = new Set()
  for (const asset of result.assets) {
    if (!requested.delete(asset?.sha256)) throw new StorageError('storage_integrity_error')
    assets.set(asset.sha256, asset)
  }
  for (const hash of result.invalid) {
    if (!requested.delete(hash)) throw new StorageError('storage_integrity_error')
    invalid.add(hash)
  }
  return { assets, invalid }
}

export async function uploadImage(hash, blob, requests, signal) {
  if (!requests.has(hash)) {
    const original = new FormData()
    original.append('image', blob, hash)
    const request = storageJson('/assets/' + hash, { method: 'POST', body: original, signal })
    requests.set(hash, request)
  }
  const result = await requests.get(hash)
  checkImage(result, hash, blob)
  return result
}
