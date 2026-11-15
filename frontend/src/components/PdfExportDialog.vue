<script setup>
import { computed, onMounted, onScopeDispose, ref, shallowRef, watch, nextTick } from 'vue'
import AppIcon from './AppIcon.vue'
import { VDialog } from 'vuetify/components'
import MobileStepFooter from './MobileStepFooter.vue'
import ExportComplete from './ExportComplete.vue'
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

const props = defineProps({
  controller: Object,
  documentId: String,
  initialOptions: Object,
  autoPreview: Boolean,
  inline: Boolean,
  workflowState: Object,
})
const emit = defineEmits(['close', 'review', 'select', 'next', 'busy', 'complete'])
const document = computed(() =>
  props.controller.active.value?.documents.find((item) => item.id === props.documentId),
)
const title = computed(() => document.value?.values.document_title || t('pdf.title'))
const confirmed = computed(
  () => document.value && isConfirmationCurrent(props.controller.active.value, document.value),
)
const options = ref({ ...DEFAULT_PDF_OPTIONS, ...props.initialOptions }),
  working = ref(false),
  downloading = ref(false),
  error = ref('')
const completed = ref(false),
  downloadedName = ref(''),
  historyError = ref('')
const advancedOpen = ref(false)
watch(completed, (value) => emit('complete', value), { flush: 'sync' })
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
  error.value = ''
  result.value = blob.value = snapshot.value = null
}
watch(options, clearResult, { deep: true })
watch([working, downloading], () => emit('busy', working.value || downloading.value), {
  flush: 'sync',
})
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
  if (!result.value && canGenerate.value) await generate()
  if (!result.value || downloading.value) return
  downloading.value = true
  error.value = ''
  historyError.value = ''
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
    downloadedName.value = prepared.metadata.filename
    completed.value = true
    try {
      const exports = (props.controller.active.value.workflow?.exports || []).filter(
        (item) => item.documentId !== props.documentId,
      )
      props.controller.setWorkflow({
        exports: [
          ...exports,
          {
            documentId: props.documentId,
            signature: prepared.signature,
            filename: prepared.metadata.filename,
            downloadedAt: Date.now(),
          },
        ],
      })
      await props.controller.save()
      snapshot.value = { ...prepared, revision: props.controller.active.value.revision }
      await verifyExport(props.controller, snapshot.value)
    } catch (reason) {
      historyError.value =
        'PDF lejupielāde sākta, bet dokumenta statusu neizdevās saglabāt. ' + message(reason)
      clearResult()
    }
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
async function scansOnly() {
  options.value = { ...options.value, includeInformation: false }
  await nextTick()
  await generate()
}
onMounted(() => {
  if (props.autoPreview && canGenerate.value) generate()
})
onScopeDispose(() => {
  disposed = true
  generation++
  service.dispose()
  emit('busy', false)
  emit('complete', false)
})
</script>
<template>
  <component
    :is="inline ? 'section' : VDialog"
    :model-value="true"
    :max-width="430"
    :persistent="!inline"
    :role="inline ? 'dialog' : undefined"
    :aria-label="t('pdf.title')"
    :class="{ 'inline-pdf': inline, 'mobile-pdf-overlay': !inline }"
    @keydown.esc.prevent.stop="close"
  >
    <v-card class="pdf-dialog" :class="{ 'pdf-is-complete': completed }">
      <ExportComplete
        v-if="completed"
        :filename="downloadedName"
        :warning="historyError"
        :disabled="downloading"
        @next="emit('next')"
        @back="completed = false"
      />
      <template v-else>
        <header v-if="!inline" class="pdf-heading">
          <h2>{{ t('pdf.title') }}</h2>
          <button class="icon-button" aria-label="Atcelt" @click="close">
            <AppIcon name="close" />
          </button>
        </header>
        <div class="pdf-content">
          <h2>Izvēlieties PDF saturu</h2>
          <div class="pdf-mode-choices" role="radiogroup" aria-label="PDF saturs">
            <label class="pdf-mode-choice" :class="{ selected: options.includeInformation }">
              <input
                v-model="options.includeInformation"
                type="radio"
                :value="true"
                :disabled="working || downloading"
              />
              <AppIcon name="file" :size="24" /><span
                ><strong>PDF ar informāciju</strong
                ><small>Skenējums un pārbaudītie dokumenta dati</small></span
              >
            </label>
            <label class="pdf-mode-choice" :class="{ selected: !options.includeInformation }">
              <input
                v-model="options.includeInformation"
                type="radio"
                :value="false"
                :disabled="working || downloading"
              />
              <AppIcon name="layers" :size="24" /><span
                ><strong>Tikai skenējums</strong><small>Tikai jūsu pievienotās lapas</small></span
              >
            </label>
          </div>
          <p v-if="options.includeInformation && !confirmed" class="ocr-warning" role="status">
            Lai iekļautu informāciju, vispirms pārbaudiet un apstipriniet datus.
          </p>
          <v-btn
            v-if="!confirmed"
            variant="text"
            color="primary"
            :disabled="working || downloading"
            @click="emit('review')"
            >{{ t('workflow.review') }}</v-btn
          >
          <details
            class="pdf-advanced"
            :open="advancedOpen"
            @toggle="advancedOpen = $event.target.open"
          >
            <summary>Papildu iestatījumi</summary>
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
                  <option value="a4">A4</option>
                  <option value="letter">Letter</option>
                  <option value="image">Pēc foto</option>
                </select></label
              >
              <label
                >{{ t('pdf.quality')
                }}<select v-model="options.quality" :disabled="working || downloading">
                  <option value="optimized">Standarta</option>
                  <option value="high">Augsta</option>
                </select></label
              >
            </div>
            <p class="small-muted">
              {{ t(options.quality === 'optimized' ? 'pdf.optimizedHint' : 'pdf.qualityHint') }}
            </p>
          </details>
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
              <p>{{ snapshot.metadata.filename }}</p>
              <p>{{ t(result.informationPageCount ? 'pdf.verified' : 'pdf.scansOnly') }}</p>
            </div>
            <p v-if="result.resized" class="ocr-warning">{{ t('pdf.resized') }}</p>
            <iframe
              v-if="embeddedViewer && url"
              :src="url"
              :title="t('pdf.previewTitle')"
              @error="embeddedViewer = false"
            />
            <p v-else class="small-muted">{{ t('pdf.noViewer') }}</p>
            <a
              :href="url"
              target="_blank"
              rel="noopener noreferrer"
              :aria-disabled="downloading"
              @click.prevent="openInTab"
              >{{ t('pdf.open') }}</a
            >
          </section>
          <p class="pdf-privacy">
            <AppIcon name="shield" :size="15" />PDF tiek izveidots tikai šajā ierīcē
          </p>
          <button class="text-link pdf-cancel" :disabled="downloading" @click="close">
            Atcelt
          </button>
        </div>
        <MobileStepFooter
          :state="
            workflowState || { step: 4, maximum: 4, complete: [true, true, confirmed, false] }
          "
          :disabled="working || downloading"
          :saving="controller.saving.value"
          :dirty="controller.dirty.value"
          :saved="Boolean(controller.active.value?.revision)"
          :can-save="false"
          @select="emit('select', $event)"
        >
          <v-btn
            v-if="!result"
            variant="text"
            color="primary"
            block
            :disabled="!canGenerate"
            @click="generate"
            ><AppIcon name="expand" :size="18" />{{
              t(controller.dirty.value ? 'pdf.savePreview' : 'pdf.preview')
            }}</v-btn
          >
          <v-btn
            v-if="!error || result"
            color="primary"
            block
            size="x-large"
            :disabled="working || downloading || (!result && !canGenerate)"
            :loading="working || downloading"
            @click="download"
            ><AppIcon name="download" :size="20" />Lejupielādēt PDF</v-btn
          >
        </MobileStepFooter>
      </template>
    </v-card>
  </component>
</template>
