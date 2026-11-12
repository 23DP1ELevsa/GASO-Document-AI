<script setup>
import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import AppIcon from './AppIcon.vue'
import { useBlobUrl } from '../composables/useBlobUrl.js'
import { isConfirmationCurrent } from '../features/documents/model.js'
import { createPdfService } from '../features/pdf/pdfService.js'
import { DEFAULT_PDF_OPTIONS, pdfErrorCode } from '../features/pdf/model.js'
import { prepareExport, verifyExport } from '../features/pdf/snapshot.js'
import { resolveOcrInput } from '../features/ocr/input.js'
import { readImageRecord } from '../features/scanning/draftRepository.js'
import { processingJob } from '../features/processing/processor.js'
import { ScanError, errorCode } from '../features/scanning/errors.js'
import { t } from '../locales'

const props = defineProps({ controller: Object, documentId: String })
const emit = defineEmits(['close', 'review'])
const document = computed(() =>
  props.controller.active.value?.documents.find((item) => item.id === props.documentId),
)
const title = computed(() => document.value?.values.document_title || t('pdf.title'))
const confirmed = computed(
  () => document.value && isConfirmationCurrent(props.controller.active.value, document.value),
)
const options = ref({ ...DEFAULT_PDF_OPTIONS }),
  working = ref(false),
  downloading = ref(false),
  error = ref('')
const progress = ref({ phase: 'information', completed: 0, total: 0 })
const result = shallowRef(null),
  blob = shallowRef(null),
  snapshot = shallowRef(null)
const url = useBlobUrl(() => blob.value)
const embeddedViewer = ref(navigator.pdfViewerEnabled === true)
const service = createPdfService({
  readImage: (page, { signal }) =>
    resolveOcrInput(page, { readImageRecord, processingJob, signal }),
})
let disposed = false,
  generation = 0
const canGenerate = computed(
  () =>
    !working.value &&
    !downloading.value &&
    document.value?.pageIds.length &&
    (!options.value.includeInformation || confirmed.value),
)
const percentage = computed(() =>
  progress.value.phase === 'saving'
    ? 95
    : progress.value.total
      ? Math.round(10 + (80 * progress.value.completed) / progress.value.total)
      : 0,
)
function clearResult() {
  result.value = blob.value = snapshot.value = null
}
watch(options, clearResult, { deep: true })
function message(reason) {
  return reason instanceof ScanError || reason?.name === 'QuotaExceededError'
    ? t(`scan.errors.${errorCode(reason)}`)
    : t(`pdf.errors.${pdfErrorCode(reason)}`)
}
async function generate() {
  if (!canGenerate.value) return
  const token = ++generation
  working.value = true
  error.value = ''
  clearResult()
  try {
    const prepared = await prepareExport(props.controller, props.documentId, { ...options.value })
    if (disposed || token !== generation) return
    snapshot.value = prepared
    const generated = await service.generate(prepared, (value) => {
      progress.value = value
    })
    await verifyExport(props.controller, prepared)
    if (disposed || token !== generation) return
    result.value = generated
    blob.value = generated.blob
  } catch (reason) {
    if (!disposed && token === generation) {
      clearResult()
      error.value = message(reason)
    }
  } finally {
    if (!disposed && token === generation) working.value = false
  }
}
async function download() {
  if (!result.value || downloading.value) return
  downloading.value = true
  error.value = ''
  try {
    const prepared = snapshot.value
    await verifyExport(props.controller, prepared)
    if (disposed || snapshot.value !== prepared || !url.value) return
    const link = window.document.createElement('a')
    link.href = url.value
    link.download = prepared.metadata.filename
    link.hidden = true
    window.document.body.append(link)
    link.click()
    link.remove()
  } catch (reason) {
    clearResult()
    error.value = message(reason)
  } finally {
    downloading.value = false
  }
}
async function openInTab() {
  if (!snapshot.value || downloading.value) return
  const tab = window.open('about:blank', '_blank')
  if (!tab) {
    error.value = t('pdf.errors.popup')
    return
  }
  tab.opener = null
  downloading.value = true
  try {
    const prepared = snapshot.value
    await verifyExport(props.controller, prepared)
    if (disposed || snapshot.value !== prepared || !url.value) {
      tab.close()
      return
    }
    tab.location.replace(url.value)
  } catch (reason) {
    tab.close()
    clearResult()
    error.value = message(reason)
  } finally {
    downloading.value = false
  }
}
function close() {
  generation++
  service.cancel()
  clearResult()
  emit('close')
}
onScopeDispose(() => {
  disposed = true
  generation++
  service.dispose()
})
</script>
<template>
  <v-dialog
    :model-value="true"
    max-width="1100"
    persistent
    :aria-label="t('pdf.title')"
    @keydown.esc.prevent.stop="close"
  >
    <v-card class="pdf-dialog">
      <header class="pdf-heading">
        <div>
          <p class="eyebrow">{{ t('pdf.title') }}</p>
          <h2>{{ title }}</h2>
        </div>
        <v-btn variant="text" :aria-label="t('pdf.close')" @click="close"
          ><AppIcon name="close"
        /></v-btn>
      </header>
      <p v-if="!confirmed" class="ocr-warning" role="status">{{ t('pdf.unconfirmed') }}</p>
      <v-btn
        v-if="!confirmed"
        variant="text"
        color="primary"
        :disabled="working"
        @click="emit('review')"
        >{{ t('pdf.review') }}</v-btn
      >
      <div class="pdf-options">
        <label class="pdf-checkbox"
          ><input
            v-model="options.includeInformation"
            type="checkbox"
            :disabled="working || downloading"
          />{{ t('pdf.includeInformation') }}</label
        >
        <label
          >{{ t('pdf.pageSize')
          }}<select v-model="options.pageSize" :disabled="working || downloading">
            <option value="a4">{{ t('pdf.a4') }}</option>
            <option value="image">{{ t('pdf.image') }}</option>
          </select></label
        >
        <label
          >{{ t('pdf.quality')
          }}<select v-model="options.quality" :disabled="working || downloading">
            <option value="high">{{ t('pdf.high') }}</option>
            <option value="optimized">{{ t('pdf.optimized') }}</option>
          </select></label
        >
      </div>
      <p :class="options.quality === 'optimized' ? 'ocr-warning' : 'small-muted'">
        {{ t(options.quality === 'optimized' ? 'pdf.optimizedHint' : 'pdf.qualityHint') }}
      </p>
      <p v-if="controller.dirty.value" class="small-muted">{{ t('pdf.unsaved') }}</p>
      <div class="pdf-actions">
        <v-btn color="primary" :disabled="!canGenerate" @click="generate">{{
          t(controller.dirty.value ? 'pdf.savePreview' : 'pdf.preview')
        }}</v-btn>
      </div>
      <div v-if="working" class="pdf-progress" role="status">
        <p>{{ t(`pdf.${progress.phase}`, progress) }}</p>
        <v-progress-linear
          :model-value="percentage"
          color="primary"
          :aria-label="t('pdf.working')"
        />
      </div>
      <p v-if="error" class="scan-error" role="alert">{{ error }}</p>
      <section
        v-if="result"
        class="pdf-preview"
        data-testid="pdf-preview"
        :aria-label="t('pdf.previewTitle')"
      >
        <div class="pdf-summary" role="status">
          <p>{{ t('pdf.pages', { count: result.pageCount }) }}</p>
          <p>{{ t('pdf.size', { size: (blob.size / 1024 ** 2).toFixed(2) }) }}</p>
          <p>{{ t(result.informationPageCount ? 'pdf.verified' : 'pdf.scansOnly') }}</p>
          <p v-if="result.informationPageCount">
            {{ t('pdf.informationPages', { count: result.informationPageCount }) }}
          </p>
          <p>{{ snapshot.metadata.filename }}</p>
        </div>
        <p v-if="result.resized" class="ocr-warning">{{ t('pdf.resized') }}</p>
        <iframe
          v-if="embeddedViewer && url"
          :src="url"
          :title="t('pdf.previewTitle')"
          @error="embeddedViewer = false"
        />
        <p v-else class="ocr-warning">{{ t('pdf.noViewer') }}</p>
        <p class="small-muted">{{ t('pdf.fallback') }}</p>
        <div class="pdf-actions">
          <v-btn color="primary" :disabled="downloading" @click="download">{{
            t('pdf.download')
          }}</v-btn
          ><a
            :href="url"
            target="_blank"
            rel="noopener noreferrer"
            :aria-disabled="downloading"
            @click.prevent="openInTab"
            >{{ t('pdf.open') }}</a
          >
        </div>
      </section>
      <p class="small-muted pdf-privacy">{{ t('pdf.privacy') }}</p>
      <div class="pdf-actions">
        <v-btn variant="text" @click="close">{{ t('pdf.close') }}</v-btn>
      </div>
    </v-card>
  </v-dialog>
</template>
