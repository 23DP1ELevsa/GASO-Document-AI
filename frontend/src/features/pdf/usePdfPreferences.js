import { ref } from 'vue'
const key = 'gaso-document-ai:pdf-mode'
const mode = ref('info')
const error = ref(false)
try {
  if (localStorage.getItem(key) === 'scan') mode.value = 'scan'
} catch {
  /* Defaults remain usable without settings storage. */
}
export function usePdfPreferences() {
  function setMode(value) {
    if (!['info', 'scan'].includes(value)) return
    mode.value = value
    try {
      localStorage.setItem(key, value)
      error.value = false
    } catch {
      error.value = true
    }
  }
  return { mode, setMode, error }
}
