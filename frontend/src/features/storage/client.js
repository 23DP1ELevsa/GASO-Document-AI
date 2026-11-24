const prefix = '/api/storage/v1'

export class StorageError extends Error {
  constructor(code, status) {
    super(code)
    this.code = code
    this.status = status
  }
}

export async function storageRequest(path, { method = 'GET', body, signal } = {}) {
  const headers = { Accept: 'application/json', 'X-GASO-Storage': '1' }
  if (body !== undefined && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(body)
  }
  const timeout = AbortSignal.timeout(60_000)
  let response
  try {
    response = await fetch(prefix + path, {
      method,
      headers,
      body,
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      cache: 'no-store',
      credentials: 'omit',
    })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new StorageError('storage_unavailable')
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new StorageError(payload?.error?.code || 'storage_unavailable', response.status)
  }
  return response
}

export async function storageJson(path, options) {
  const response = await storageRequest(path, options)
  try {
    return await response.json()
  } catch {
    throw new StorageError('storage_unavailable', response.status)
  }
}

export async function sha256(blob) {
  const hash = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  return Array.from(new Uint8Array(hash), (value) => value.toString(16).padStart(2, '0')).join('')
}

export async function readRemoteImage(image, signal) {
  const response = await storageRequest('/images/' + image.sha256, { signal })
  const blob = await response.blob()
  if (
    blob.size !== image.size ||
    blob.type !== image.mime ||
    response.headers.get('X-Content-SHA256') !== image.sha256 ||
    (await sha256(blob)) !== image.sha256
  )
    throw new StorageError('image_integrity_error')
  return blob
}

export async function uploadImage(blob, assets, signal) {
  const hash = await sha256(blob)
  let result = assets.get(hash)
  if (!result) {
    try {
      result = await storageJson('/assets/' + hash, { signal })
    } catch (error) {
      if (error.code !== 'image_missing') throw error
      const original = new FormData()
      original.append('image', blob, hash)
      result = await storageJson('/assets/' + hash, { method: 'POST', body: original, signal })
    }
    if (result.sha256 !== hash || result.size !== blob.size)
      throw new StorageError('image_integrity_error')
    assets.set(hash, result)
  }
  return { sha256: hash, size: blob.size }
}
