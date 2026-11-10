import { ref, shallowRef, watch, onScopeDispose } from 'vue'
import { listDrafts } from './draftRepository'
import { draftsChanged } from './useScanSession'
import { errorCode } from './errors'

export function useDraftList() {
  const drafts = shallowRef([]),
    loading = ref(false),
    error = ref('')
  let generation = 0
  async function refresh() {
    const current = ++generation
    loading.value = true
    error.value = ''
    try {
      const result = await listDrafts()
      if (current === generation) drafts.value = result
    } catch (reason) {
      if (current === generation) error.value = errorCode(reason)
    } finally {
      if (current === generation) loading.value = false
    }
  }
  watch(draftsChanged, refresh, { immediate: true })
  let channel = null
  try {
    if (typeof BroadcastChannel === 'function') channel = new BroadcastChannel('gaso-drafts')
  } catch {
    /* Local refresh and navigation still work if cross-tab messaging is blocked. */
  }
  if (channel) channel.onmessage = refresh
  onScopeDispose(() => {
    generation++
    channel?.close()
  })
  return { drafts, loading, error, refresh }
}
