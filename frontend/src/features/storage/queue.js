import { newId } from '../scanning/id.js'
import { accountKey } from '../auth/scope.js'

export const SYNC_STORE = 'storageSync'
export const SYNC_PREFERENCE = 'gaso-document-ai:server-storage'
export const SYNC_PAUSE_PREFERENCE = 'gaso-document-ai:storage-paused'
export const storageEvents = new EventTarget()
export const syncKey = (kind, id) => kind + '/' + id

export function syncEnabled() {
  try {
    return localStorage.getItem(accountKey(SYNC_PREFERENCE)) === 'enabled'
  } catch {
    return false
  }
}

export function setSyncEnabled(enabled) {
  const key = accountKey(SYNC_PREFERENCE)
  if (!key) return
  localStorage.setItem(key, enabled ? 'enabled' : 'disabled')
  storageEvents.dispatchEvent(new Event('mode'))
}

export function isSyncPaused() {
  try {
    return localStorage.getItem(accountKey(SYNC_PAUSE_PREFERENCE)) === 'yes'
  } catch {
    return false
  }
}

export function setSyncPaused(paused) {
  const key = accountKey(SYNC_PAUSE_PREFERENCE)
  if (!key) return
  if (paused) localStorage.setItem(key, 'yes')
  else localStorage.removeItem(key)
  storageEvents.dispatchEvent(new Event('pause'))
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
