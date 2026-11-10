import { shallowRef, watch, onScopeDispose } from 'vue'

export function useBlobUrl(source) {
  const url = shallowRef('')
  function release() {
    if (url.value) URL.revokeObjectURL(url.value)
    url.value = ''
  }
  watch(
    source,
    (blob) => {
      release()
      if (blob) url.value = URL.createObjectURL(blob)
    },
    { immediate: true },
  )
  onScopeDispose(release)
  return url
}
