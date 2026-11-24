import { newId } from '../scanning/id.js'

export const SYNC_STORE = 'storageSync'
export const SYNC_PREFERENCE = 'gaso-document-ai:server-storage'
export const storageEvents = new EventTarget()
export const syncKey = (kind, id) => kind + '/' + id

export function syncEnabled() {
  try {
    return localStorage.getItem(SYNC_PREFERENCE) === 'enabled'
  } catch {
    return false
  }
}

export function setSyncEnabled(enabled) {
  localStorage.setItem(SYNC_PREFERENCE, enabled ? 'enabled' : 'disabled')
  storageEvents.dispatchEvent(new Event('mode'))
}

export function queueChange(tx, kind, id, deleted = false) {
  const enabled = syncEnabled()
  const store = tx.objectStore(SYNC_STORE)
  const key = syncKey(kind, id)
  store.get(key).onsuccess = ({ target }) => {
    const previous = target.result
    if (!enabled && !previous) return
    store.put({
      ...previous,
      id: key,
      kind,
      rootId: id,
      deleted,
      mutationId: newId(),
      base: previous?.base || 0,
      status: previous?.status === 'conflict' ? 'conflict' : enabled ? 'pending' : 'local',
    })
    tx.addEventListener('complete', () => storageEvents.dispatchEvent(new Event('queued')))
  }
}
