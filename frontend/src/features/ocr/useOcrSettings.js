import { readonly, ref } from 'vue'
import { normalizeLanguages, OCR_CACHE, OCR_RESOURCE_PATH, OcrError } from './model.js'

const KEY = 'gaso-document-ai:ocr-languages'
const languages = ref(['lav'])
const storageError = ref(false)
try {
  const stored = localStorage.getItem(KEY)
  if (stored) languages.value = normalizeLanguages(JSON.parse(stored))
} catch {
  // Invalid/blocked settings never prevent scanning; Latvian remains the default.
}
export function useOcrSettings() {
  function setLanguages(value) {
    languages.value = normalizeLanguages(value)
    try {
      localStorage.setItem(KEY, JSON.stringify(languages.value))
      storageError.value = false
    } catch {
      storageError.value = true
    }
  }
  return { languages: readonly(languages), storageError, setLanguages }
}

export async function prepareOfflineResources(selected, onProgress = () => {}, signal) {
  const langs = normalizeLanguages(selected)
  if (!globalThis.caches || !globalThis.crypto?.subtle) throw new OcrError('offlineUnavailable')
  const base = new URL(`${import.meta.env.BASE_URL}${OCR_RESOURCE_PATH}/`, document.baseURI)
  const response = await fetch(new URL('manifest.json', base), { signal, cache: 'no-store' })
  if (!response.ok) throw new OcrError('modelUnavailable')
  const manifest = await response.json()
  const files = [
    'worker.min.js',
    ...['', '-simd', '-relaxedsimd'].map((variant) => `core/tesseract-core${variant}-lstm.wasm.js`),
    ...langs.map((lang) => `lang/${lang}.traineddata`),
  ]
  const cache = await caches.open(OCR_CACHE)
  let completed = 0
  for (const name of files) {
    const url = new URL(name, base).href
    const resource = await fetch(url, { signal })
    if (!resource.ok) throw new OcrError('modelUnavailable')
    const bytes = await resource.clone().arrayBuffer()
    const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
    if (digest !== manifest.files[name]?.sha256) throw new OcrError('integrity')
    await cache.put(url, resource)
    onProgress(Math.round((++completed / files.length) * 100))
  }
}
