<script setup>
import { computed, ref, shallowRef, watch, onScopeDispose } from 'vue'
import AppIcon from './AppIcon.vue'
import BlobImage from './BlobImage.vue'
import OcrLanguagePicker from './OcrLanguagePicker.vue'
import { useOcrSettings } from '../features/ocr/useOcrSettings.js'
import { resolveOcrInput } from '../features/ocr/input.js'
import { readImageRecord } from '../features/scanning/draftRepository.js'
import { processingJob } from '../features/processing/processor.js'
import {
  textForPage,
  isOcrStale,
  MAX_TEXT_LENGTH,
  OcrError,
  ocrErrorCode,
} from '../features/ocr/model.js'
import { errorCode } from '../features/scanning/errors.js'
import { t, dateTime } from '../locales'

const props = defineProps({ pages: Array, selectedId: String, ocr: Object })
const emit = defineEmits(['close', 'recognize'])
const { languages, storageError, setLanguages } = useOcrSettings()
const pageId = ref(props.selectedId)
const page = computed(() => props.pages.find((item) => item.id === pageId.value))
const image = shallowRef(null),
  text = ref(''),
  saving = ref(false),
  error = ref(''),
  notice = ref('')
const changed = computed(() => text.value !== textForPage(page.value || {}))
const running = computed(() => props.ocr.running.value)
const languageMismatch = computed(
  () => page.value?.ocr && page.value.ocr.languages.join('+') !== languages.value.join('+'),
)
let imageController
watch(
  () => page.value?.id,
  async () => {
    text.value = textForPage(page.value || {})
    image.value = null
    error.value = notice.value = ''
    imageController?.abort()
    if (!page.value) return
    const controller = new AbortController()
    imageController = controller
    try {
      const result = await resolveOcrInput(page.value, {
        readImageRecord,
        processingJob,
        signal: controller.signal,
      })
      if (!controller.signal.aborted) image.value = result
    } catch {
      if (!controller.signal.aborted) error.value = t('ocr.errors.imageUnavailable')
    }
  },
  { immediate: true },
)
watch(
  () => page.value?.ocr,
  () => {
    text.value = textForPage(page.value || {})
  },
)
function discardChanges() {
  return !changed.value || window.confirm(t('ocr.confirmUnsaved'))
}
function close() {
  if (saving.value || !discardChanges()) return
  if (running.value) props.ocr.cancel()
  emit('close')
}
function selectPage(event) {
  if (discardChanges()) pageId.value = event.target.value
  event.target.value = pageId.value
}
function recognize() {
  if (discardChanges()) emit('recognize', page.value)
}
async function save() {
  if (saving.value || !page.value?.ocr) return
  saving.value = true
  error.value = notice.value = ''
  try {
    await props.ocr.saveText(page.value.id, text.value)
    notice.value = t('ocr.saved')
  } catch (reason) {
    error.value =
      reason instanceof OcrError
        ? t(`ocr.errors.${ocrErrorCode(reason)}`)
        : t(`scan.errors.${errorCode(reason)}`)
  } finally {
    saving.value = false
  }
}
async function copy() {
  try {
    await navigator.clipboard.writeText(text.value)
    notice.value = t('ocr.copied')
  } catch {
    error.value = t('ocr.errors.clipboard')
  }
}
function protectText(event) {
  if (changed.value) {
    event.preventDefault()
    event.returnValue = ''
  }
}
window.addEventListener('beforeunload', protectText)
onScopeDispose(() => {
  imageController?.abort()
  window.removeEventListener('beforeunload', protectText)
})
</script>
<template>
  <v-dialog
    :model-value="true"
    max-width="1200"
    persistent
    :aria-label="t('ocr.title')"
    @keydown.esc.prevent.stop="close"
  >
    <v-card class="ocr-dialog">
      <header class="ocr-heading">
        <div>
          <p class="eyebrow">{{ t('ocr.eyebrow') }}</p>
          <h2>{{ t('ocr.title') }}</h2>
        </div>
        <v-btn variant="text" :disabled="saving" :aria-label="t('ocr.close')" @click="close"
          ><AppIcon name="close"
        /></v-btn>
      </header>
      <label class="ocr-page-selector"
        >{{ t('ocr.selectPage') }}
        <select :value="pageId" :disabled="running || saving" @change="selectPage">
          <option v-for="(item, index) in pages" :key="item.id" :value="item.id">
            {{ t('scan.pageNumber', { number: index + 1 }) }} · {{ item.name }}
          </option>
        </select>
      </label>
      <div v-if="page" class="ocr-layout">
        <section class="ocr-image">
          <h3>{{ t('ocr.image') }}</h3>
          <BlobImage v-if="image" :blob="image" :alt="t('ocr.image')" />
          <p v-else>{{ t('scan.loading') }}</p>
        </section>
        <section class="ocr-content">
          <OcrLanguagePicker
            :model-value="languages"
            :disabled="running || saving"
            @update:model-value="setLanguages"
          />
          <p v-if="storageError" role="alert" class="scan-error">{{ t('ocr.settingsError') }}</p>
          <p v-if="isOcrStale(page)" class="ocr-warning" role="status">{{ t('ocr.stale') }}</p>
          <p v-if="languageMismatch" class="ocr-warning">{{ t('ocr.languageChanged') }}</p>
          <div v-if="running" class="ocr-progress" role="status">
            <p>{{ t(`ocr.phase.${ocr.phase.value}`) }} {{ ocr.progress.value }}%</p>
            <v-progress-linear
              :model-value="ocr.progress.value"
              :aria-label="t('ocr.progress')"
              color="primary"
            />
            <v-btn variant="text" @click="ocr.cancel">{{ t('ocr.cancel') }}</v-btn>
          </div>
          <p v-if="page.ocrAttempt" class="ocr-warning" role="status">
            {{ t(`ocr.errors.${page.ocrAttempt.errorCode}`) }}
          </p>
          <div v-if="page.ocr" class="ocr-metadata">
            <p>{{ t('ocr.status') }}: {{ t(`ocr.statuses.${page.ocr.status}`) }}</p>
            <p>
              {{ t('ocr.usedLanguages') }}:
              {{ page.ocr.languages.map((lang) => t(`ocr.language.${lang}`)).join(', ') }}
            </p>
            <p v-if="page.ocr.confidence !== null">
              {{ t('ocr.confidence') }}: {{ Math.round(page.ocr.confidence) }}%
            </p>
            <p>
              {{ dateTime(page.ocr.recognizedAt) }} ·
              {{ (page.ocr.durationMs / 1000).toFixed(1) }} s · Tesseract.js
              {{ page.ocr.engineVersion }}
            </p>
          </div>
          <p v-if="page.ocr?.status === 'empty'" class="ocr-warning" role="status">
            {{ t('ocr.empty') }}
          </p>
          <p v-if="!page.ocr && !running" class="small-muted">{{ t('ocr.noResult') }}</p>
          <label class="ocr-text-label" for="ocr-page-text">{{ t('ocr.text') }}</label>
          <textarea
            id="ocr-page-text"
            v-model="text"
            data-testid="ocr-text"
            :maxlength="MAX_TEXT_LENGTH"
            :disabled="!page.ocr || running || saving"
            spellcheck="false"
          />
          <p class="small-muted">{{ t('ocr.textLimit', { count: MAX_TEXT_LENGTH }) }}</p>
          <div class="ocr-actions">
            <v-btn color="primary" :disabled="running || saving" @click="recognize"
              ><AppIcon name="ocr" :size="18" />{{
                t(page.ocr ? 'ocr.rerun' : 'ocr.recognize')
              }}</v-btn
            >
            <v-btn
              color="primary"
              variant="tonal"
              :disabled="!page.ocr || running || saving"
              @click="save"
              >{{ t('ocr.save') }}</v-btn
            >
            <v-btn variant="text" :disabled="!text || running" @click="copy">{{
              t('ocr.copy')
            }}</v-btn>
          </div>
          <p v-if="error" class="scan-error" role="alert">{{ error }}</p>
          <p v-if="ocr.saveError.value" class="scan-error" role="alert">
            {{ t(`scan.errors.${errorCode(ocr.saveError.value)}`) }}
          </p>
          <p v-if="notice" class="scan-success" role="status">{{ notice }}</p>
          <details v-if="page.ocr">
            <summary>{{ t('ocr.originalText') }}</summary>
            <pre class="ocr-original">{{ page.ocr.originalText }}</pre>
          </details>
          <p class="small-muted">{{ t('ocr.privacy') }}</p>
        </section>
      </div>
    </v-card>
  </v-dialog>
</template>
