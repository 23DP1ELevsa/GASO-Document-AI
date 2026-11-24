import { DATA_STORES, transaction } from '../scanning/draftRepository.js'
import { SYNC_STORE, storageEvents } from './queue.js'
import { StorageError } from './client.js'

const signature = 'GASOBK1\n'

export async function createBackup() {
  const data = await transaction(DATA_STORES, 'readonly', (tx, result) => {
    const records = {}
    result(records)
    for (const store of DATA_STORES)
      tx.objectStore(store).getAll().onsuccess = ({ target }) => {
        records[store] = target.result
      }
  })
  const images = []
  const metadata = new TextEncoder().encode(
    JSON.stringify(data, (_key, value) => {
      if (!(value instanceof Blob)) return value
      return { $blob: images.push(value) - 1, size: value.size, mime: value.type }
    }),
  )
  const header = new Uint8Array(12)
  header.set(new TextEncoder().encode(signature))
  new DataView(header.buffer).setUint32(8, metadata.length)
  return new Blob([header, metadata, ...images], { type: 'application/octet-stream' })
}

export async function restoreBackup(file) {
  const header = await file.slice(0, 12).arrayBuffer()
  const invalid = () => new StorageError('invalid_backup')
  if (header.byteLength !== 12 || new TextDecoder().decode(header.slice(0, 8)) !== signature)
    throw invalid()
  const length = new DataView(header).getUint32(8)
  if (!length || length > file.size - 12 || length > 64 * 1024 * 1024) throw invalid()
  let offset = 12 + length
  let index = 0
  let data
  try {
    data = JSON.parse(await file.slice(12, offset).text(), (_key, value) => {
      if (!value || typeof value !== 'object' || !('$blob' in value)) return value
      const { size, mime } = value
      if (
        Object.keys(value).length !== 3 ||
        value.$blob !== index++ ||
        !Number.isInteger(size) ||
        size <= 0 ||
        size > file.size - offset ||
        !['image/jpeg', 'image/png', 'image/webp'].includes(mime)
      )
        throw invalid()
      const blob = file.slice(offset, offset + size, mime)
      offset += size
      return blob
    })
  } catch {
    throw invalid()
  }
  if (
    offset !== file.size ||
    !DATA_STORES.every(
      (store) =>
        Array.isArray(data?.[store]) && data[store].every((row) => typeof row?.id === 'string'),
    )
  )
    throw invalid()

  await transaction([...DATA_STORES, SYNC_STORE], 'readwrite', (tx, _result, fail) => {
    let remaining = DATA_STORES.length + 1
    for (const store of [...DATA_STORES, SYNC_STORE]) {
      tx.objectStore(store).count().onsuccess = ({ target }) => {
        if (target.result) return fail(new StorageError('backup_requires_empty'))
        if (--remaining) return
        for (const name of DATA_STORES) for (const row of data[name]) tx.objectStore(name).add(row)
      }
    }
  })
  storageEvents.dispatchEvent(new Event('restored'))
}
