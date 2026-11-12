<script setup>
import { computed, ref, shallowRef, watch, nextTick, defineAsyncComponent } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import ScanPageCard from '../components/ScanPageCard.vue'
import ImagePreviewDialog from '../components/ImagePreviewDialog.vue'
import ScanEditorDialog from '../components/ScanEditorDialog.vue'
import OcrResultDialog from '../components/OcrResultDialog.vue'
import OcrLanguagePicker from '../components/OcrLanguagePicker.vue'
import OcrProgress from '../components/OcrProgress.vue'
import DocumentGroups from '../components/DocumentGroups.vue'
import WorkflowSteps from '../components/WorkflowSteps.vue'
import DocumentBoundaryPicker from '../components/DocumentBoundaryPicker.vue'
import DocumentInformation from '../components/DocumentInformation.vue'
import BlobImage from '../components/BlobImage.vue'
import { workflowState, recognizeDocument } from '../features/documents/workflow.js'
import {
  documentPages,
  unassignedPages,
  isConfirmationCurrent,
  validationErrors,
} from '../features/documents/model.js'
import { useOcrSession } from '../features/ocr/useOcrSession.js'
import { useOcrSettings } from '../features/ocr/useOcrSettings.js'
import { useScanSession } from '../features/scanning/useScanSession'
import { errorCode } from '../features/scanning/errors'
import { t } from '../locales'

const route = useRoute(),
  router = useRouter()
const session = useScanSession()
const PdfExportDialog = defineAsyncComponent(() => import('../components/PdfExportDialog.vue'))
const pdfDocumentId = ref(null),
  pdfTrigger = shallowRef(null),
  documentGroups = ref(null)
const pdfInitial = ref(null)
function openPdf(id, trigger, scansOnly = false) {
  if (locked.value) return
  pdfTrigger.value = trigger
  pdfInitial.value = { includeInformation: !scansOnly }
  pdfDocumentId.value = id
}
async function closePdf() {
  pdfDocumentId.value = null
  await nextTick()
  if (pdfTrigger.value?.isConnected) pdfTrigger.value.focus({ preventScroll: true })
}
async function reviewPdf() {
  const id = pdfDocumentId.value
  await closePdf()
  selectedDocumentId.value = id
  await go(3)
  await nextTick()
  document.querySelector('[data-testid="document-information"]')?.focus()
}
const { active, dirty, busy, saving } = session
const ocr = useOcrSession(session)
const { languages, storageError, setLanguages } = useOcrSettings()
const transitioning = ref(false),
  recognizing = ref(false),
  saveFailed = ref(false)
const locked = computed(
  () =>
    busy.value ||
    ocr.running.value ||
    recognizing.value ||
    transitioning.value ||
    Boolean(pdfDocumentId.value),
)
const step = ref(1),
  multiple = ref(false),
  selectedDocumentId = ref(null),
  stepHeading = ref(null)
const state = computed(() => workflowState(active.value))
const currentStep = computed(() => Math.min(step.value, state.value.maximum))
const currentDocument = computed(
  () =>
    state.value.documents.find((item) => item.id === selectedDocumentId.value) ||
    state.value.documents[0],
)
const currentPages = computed(() =>
  currentDocument.value ? documentPages(active.value, currentDocument.value) : [],
)
const unassigned = computed(() => (active.value ? unassignedPages(active.value) : []))
const hasSuggestions = computed(() => Boolean(currentDocument.value?.analysis))
watch(
  () => active.value?.id,
  () => {
    step.value = state.value.step
    selectedDocumentId.value = state.value.documentId
    multiple.value =
      state.value.documents.length > 1 || (state.value.documents.length > 0 && !state.value.grouped)
    saveFailed.value = false
  },
  { immediate: true },
)
function documentTitle(item, index = 0) {
  return item.values.document_title || t('workflow.documentNumber', { number: index + 1 })
}
function selectDocument(id) {
  if (locked.value) return
  selectedDocumentId.value = id
  session.setWorkflow({ step: currentStep.value, documentId: id })
}
async function go(target) {
  if (locked.value || target > state.value.maximum) return
  clearMessages()
  transitioning.value = true
  try {
    session.setWorkflow({ step: target, documentId: currentDocument.value?.id || null })
    if (dirty.value && (pages.value.length || active.value?.revision)) {
      const id = await session.save()
      await router.replace({ name: 'scan', query: { draft: id } })
    }
    step.value = target
    saveFailed.value = false
    await nextTick()
    stepHeading.value?.focus({ preventScroll: true })
  } catch (reason) {
    saveFailed.value = true
    error.value = t(`scan.errors.${errorCode(reason)}`)
  } finally {
    transitioning.value = false
  }
}
async function oneDocument() {
  if (locked.value) return
  if (active.value.documents.length > 1 && !window.confirm(t('workflow.confirmAllOne'))) return
  session.groupSession()
  selectedDocumentId.value = active.value.documents[0].id
  await go(3)
}
function createGroups(starts) {
  if (locked.value) return
  try {
    session.groupSession(starts)
    clearMessages()
  } catch {
    error.value = t('grouping.actionError')
  }
}
async function recognizeCurrent() {
  if (locked.value || !currentDocument.value) return
  recognizing.value = true
  clearMessages()
  try {
    const result = await recognizeDocument(
      session,
      ocr,
      currentDocument.value.id,
      languages.value,
      () => window.confirm(t('ocr.confirmRerun')),
    )
    if (!result.cancelled) {
      saveFailed.value = false
      success.value = t(result.incomplete ? 'workflow.incomplete' : 'workflow.recognized')
    }
  } catch (reason) {
    error.value = reason?.code
      ? t(`scan.errors.${errorCode(reason)}`)
      : t('workflow.processingError')
    saveFailed.value = Boolean(ocr.saveError.value || reason?.code)
  } finally {
    recognizing.value = false
  }
}
async function confirmCurrent() {
  if (locked.value || !currentDocument.value || validationErrors(currentDocument.value).length)
    return
  session.changeDocuments('confirmDocument', currentDocument.value.id)
  const next = state.value.documents.find((item) => !isConfirmationCurrent(active.value, item))
  if (next) selectedDocumentId.value = next.id
  await go(next ? 3 : 4)
}
async function reviewDocument(id) {
  selectedDocumentId.value = id
  await go(3)
}
const ocrPageId = ref(null),
  ocrTrigger = shallowRef(null)
function openText(page, trigger) {
  ocrTrigger.value = trigger
  ocrPageId.value = page.id
}
async function closeText() {
  ocrPageId.value = null
  await nextTick()
  if (ocrTrigger.value?.isConnected) ocrTrigger.value.focus({ preventScroll: true })
}
function runOcr(pagesToRecognize) {
  return ocr.run(pagesToRecognize, languages.value, () => window.confirm(t('ocr.confirmRerun')))
}
async function recognizePage(page, trigger) {
  if (locked.value) return
  openText(page, trigger)
  await runOcr([page])
}
const camera = ref(null),
  gallery = ref(null),
  replacement = ref(null)
const selectedPage = shallowRef(null),
  error = ref(''),
  success = ref('')
let replacementId = null
const previewTrigger = shallowRef(null)
const editingPage = shallowRef(null),
  editorTrigger = shallowRef(null)
const simpleEditor = ref(false)
function openEditor(page, trigger, simple = false) {
  editorTrigger.value = trigger
  editingPage.value = page
  simpleEditor.value = simple
}
async function closeEditor() {
  editingPage.value = null
  await nextTick()
  if (editorTrigger.value?.isConnected) editorTrigger.value.focus({ preventScroll: true })
}
function applyEditing(changes) {
  try {
    session.applyEdit(editingPage.value.id, changes)
    clearMessages()
    success.value = t('editor.applied')
    closeEditor()
  } catch (reason) {
    error.value = t(`scan.errors.${errorCode(reason)}`)
  }
}
function openPreview(page, trigger) {
  previewTrigger.value = trigger
  selectedPage.value = page
}
const pages = computed(() => active.value?.pages || [])
watch(
  () => route.query.draft,
  async (id) => {
    if (
      id &&
      active.value &&
      active.value.id !== id &&
      dirty.value &&
      !window.confirm(t('scan.confirmDiscard'))
    ) {
      await router.replace({
        name: 'scan',
        query: active.value.revision ? { draft: active.value.id } : {},
      })
      return
    }
    try {
      await session.initialize(typeof id === 'string' ? id : null)
    } catch (reason) {
      error.value = t(`scan.errors.${errorCode(reason)}`)
    }
  },
  { immediate: true },
)
function clearMessages() {
  error.value = ''
  success.value = ''
}
function changeDocuments(action, ...args) {
  if (locked.value) return
  clearMessages()
  try {
    session.changeDocuments(action, ...args)
    if (action === 'confirmDocument') success.value = t('grouping.confirmedHint')
  } catch {
    error.value = t('grouping.actionError')
  }
}
function analyzeDocument(id) {
  if (locked.value) return
  clearMessages()
  try {
    session.analyzeDocument(id)
  } catch {
    error.value = t('grouping.actionError')
  }
}
async function selected(event, replacing = false) {
  if (locked.value) return
  const files = Array.from(event.target.files || [])
  event.target.value = ''
  if (!files.length) {
    replacementId = null
    return
  }
  clearMessages()
  const result = await session.addFiles(files, replacing ? replacementId : null)
  replacementId = null
  if (result.errors.length)
    error.value = [...new Set(result.errors)].map((code) => t(`scan.errors.${code}`)).join(' ')
  if (result.added)
    success.value = t(replacing ? 'scan.replaced' : 'scan.added', { count: result.added })
  if (result.added) {
    step.value = 2
    session.setWorkflow({ step: 2 })
    if (active.value.documents.length) multiple.value = true
  }
}
function replace(id) {
  replacementId = id
  replacement.value.click()
}
function move(id, direction) {
  clearMessages()
  session.move(id, direction)
}
function remove(id) {
  clearMessages()
  session.remove(id)
}
async function save() {
  clearMessages()
  try {
    const id = await session.save()
    await router.replace({ name: 'scan', query: { draft: id } })
    success.value = t('scan.saved')
    saveFailed.value = false
  } catch (reason) {
    saveFailed.value = true
    error.value = t(`scan.errors.${errorCode(reason)}`)
  }
}
async function startNew() {
  if (locked.value) return
  if (dirty.value && !window.confirm(t('scan.confirmDiscard'))) return
  clearMessages()
  session.newSession()
  await router.replace({ name: 'scan', query: {} })
}
async function deleteSession() {
  if (locked.value) return
  if (!active.value || !window.confirm(t('scan.confirmDelete'))) return
  clearMessages()
  try {
    await session.discard(active.value.id)
    session.newSession()
    await router.replace({ name: 'scan', query: {} })
    success.value = t('scan.deleted')
  } catch (reason) {
    error.value = t(`scan.errors.${errorCode(reason)}`)
  }
}
</script>
<template>
  <div class="view scan-workspace guided-workspace">
    <header class="workspace-heading">
      <div>
        <h1 tabindex="-1">{{ t('workflow.title') }}</h1>
        <p>{{ t('workflow.description') }}</p>
      </div>
      <details class="session-menu">
        <summary>{{ t('workflow.sessionActions') }}</summary>
        <div>
          <v-btn variant="text" :disabled="locked" @click="startNew">{{
            t('scan.newSession')
          }}</v-btn
          ><v-btn
            v-if="pages.length || active?.revision"
            variant="text"
            color="error"
            :disabled="locked"
            @click="deleteSession"
            >{{ t('scan.deleteSession') }}</v-btn
          >
        </div>
      </details>
    </header>
    <WorkflowSteps :state="{ ...state, step: currentStep }" :disabled="locked" @select="go" />
    <div v-if="error" class="scan-error" role="alert">{{ error }}</div>
    <div v-if="ocr.saveError.value && !error" class="scan-error" role="alert">
      {{ t('scan.errors.' + errorCode(ocr.saveError.value)) }}
    </div>
    <div v-if="success" class="scan-success" role="status">{{ success }}</div>
    <div v-if="busy" class="scan-working" role="status">
      <v-progress-circular indeterminate :size="20" :width="2" :aria-label="t('scan.working')" />{{
        t('scan.working')
      }}
    </div>
    <header class="workflow-stage-heading">
      <p class="eyebrow">{{ t('workflow.step', { number: currentStep }) }}</p>
      <h2 ref="stepHeading" tabindex="-1">
        {{ t('workflow.titles.' + currentStep)
        }}<span
          v-show="currentStep === 2"
          class="count-badge"
          data-testid="page-count"
          aria-hidden="true"
          >{{ pages.length }}</span
        >
      </h2>
      <p>{{ t('workflow.hints.' + currentStep) }}</p>
    </header>
    <input
      ref="camera"
      class="file-input"
      data-testid="camera-input"
      type="file"
      accept="image/*"
      capture="environment"
      :aria-label="t('scan.camera')"
      @change="selected"
      @cancel="replacementId = null"
    />
    <input
      ref="gallery"
      class="file-input"
      data-testid="gallery-input"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      multiple
      :aria-label="t('scan.gallery')"
      @change="selected"
    />
    <input
      ref="replacement"
      class="file-input"
      data-testid="replacement-input"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      :aria-label="t('scan.replace')"
      @change="selected($event, true)"
      @cancel="replacementId = null"
    />

    <section v-show="currentStep === 1" class="workflow-import bordered-card">
      <span class="import-illustration"><AppIcon name="camera" :size="40" /></span>
      <h3>{{ t('workflow.titles.1') }}</h3>
      <p>{{ t('scan.noPagesText') }}</p>
      <div class="scan-import-actions">
        <v-btn color="primary" size="large" :disabled="locked" @click="camera.click()"
          ><AppIcon name="camera" :size="20" />{{ t('scan.camera') }}</v-btn
        ><v-btn variant="tonal" size="large" :disabled="locked" @click="gallery.click()"
          ><AppIcon name="gallery" :size="20" />{{ t('scan.gallery') }}</v-btn
        >
      </div>
      <p class="small-muted">{{ t('scan.limits') }}</p>
      <details class="capture-help">
        <summary>{{ t('workflow.advanced') }}</summary>
        <p>{{ t('scan.cameraHint') }}</p>
      </details>
      <v-btn v-if="pages.length" variant="text" :disabled="locked" @click="go(2)">{{
        t('workflow.next')
      }}</v-btn>
    </section>

    <section v-show="currentStep === 2" class="session-section" :aria-busy="busy">
      <div class="stage-secondary-actions">
        <v-btn variant="tonal" :disabled="locked" @click="gallery.click()"
          ><AppIcon name="plus" :size="18" />{{ t('workflow.importMore') }}</v-btn
        ><v-btn variant="text" :disabled="locked" @click="camera.click()">{{
          t('scan.camera')
        }}</v-btn>
      </div>
      <v-card v-if="!pages.length" class="scan-empty bordered-card"
        ><AppIcon name="layers" :size="40" />
        <h3>{{ t('scan.noPages') }}</h3>
        <p>{{ t('scan.noPagesText') }}</p></v-card
      >
      <div v-else class="scan-pages-grid">
        <ScanPageCard
          v-for="(page, index) in pages"
          :key="page.id"
          :page="page"
          :index="index"
          :count="pages.length"
          :busy="locked"
          @preview="openPreview"
          @edit="openEditor"
          @move="move"
          @replace="replace"
          @remove="remove"
          @ocr="recognizePage"
          @text="openText"
        />
      </div>
      <div
        v-if="pages.length && !multiple && !state.grouped"
        class="single-document-choice bordered-card"
      >
        <h3>{{ t('workflow.groupingQuestion') }}</h3>
        <p>{{ t('workflow.groupingHint') }}</p>
        <v-btn color="primary" size="large" :disabled="locked" @click="oneDocument">{{
          t('workflow.one')
        }}</v-btn
        ><v-btn variant="text" :disabled="locked" @click="multiple = true">{{
          t('workflow.multiple')
        }}</v-btn>
      </div>
      <div v-else-if="pages.length && !multiple" class="grouping-choice-actions">
        <v-btn variant="text" :disabled="locked" @click="multiple = true">{{
          t('workflow.multiple')
        }}</v-btn>
      </div>
      <div v-else-if="pages.length" class="grouping-choice-actions">
        <v-btn variant="text" :disabled="locked" @click="oneDocument">{{
          t('workflow.one')
        }}</v-btn>
      </div>
      <DocumentBoundaryPicker
        v-if="multiple"
        :pages="unassigned"
        :disabled="locked"
        @create="createGroups"
      />
      <DocumentGroups
        ref="documentGroups"
        v-if="multiple && active && (pages.length || active.documents.length)"
        :key="active.id"
        :session="active"
        :disabled="locked"
        in-flow
        @change="changeDocuments"
        @analyze="analyzeDocument"
        @review="reviewDocument"
        @pdf="openPdf"
      />
      <details v-if="pages.length" class="ocr-session bordered-card legacy-text-tools">
        <summary>{{ t('workflow.text') }}</summary>
        <OcrLanguagePicker
          :model-value="languages"
          :disabled="locked"
          @update:model-value="setLanguages"
        />
        <p v-if="storageError" class="scan-error" role="alert">{{ t('ocr.settingsError') }}</p>
        <v-btn variant="tonal" :disabled="locked" @click="runOcr(pages)">{{
          t('ocr.recognizeAll')
        }}</v-btn>
        <OcrProgress :ocr="ocr" />
        <details v-if="pages.some((page) => page.ocr)">
          <summary>{{ t('ocr.combined') }}</summary>
          <textarea readonly :value="ocr.combinedText.value" :aria-label="t('ocr.combined')" />
        </details>
      </details>
      <footer class="workflow-navigation">
        <v-btn variant="text" :disabled="locked" @click="go(1)">{{ t('workflow.back') }}</v-btn
        ><v-btn v-if="state.grouped" color="primary" size="large" :disabled="locked" @click="go(3)"
          >{{ t('workflow.next') }}<AppIcon name="arrow" :size="18"
        /></v-btn>
      </footer>
    </section>

    <section v-if="currentStep === 3 && currentDocument" class="workflow-review">
      <label v-if="state.documents.length > 1" class="workflow-document-select"
        >{{ t('workflow.selectDocument')
        }}<select
          :value="currentDocument.id"
          :disabled="locked"
          @change="selectDocument($event.target.value)"
        >
          <option v-for="(item, index) in state.documents" :key="item.id" :value="item.id">
            {{ documentTitle(item, index)
            }}{{ isConfirmationCurrent(active, item) ? ' · ' + t('workflow.confirmed') : '' }}
          </option>
        </select></label
      >
      <div class="recognition-panel bordered-card">
        <div>
          <h3>{{ t('workflow.recognize') }}</h3>
          <p>{{ t('workflow.recognizeHint') }}</p>
        </div>
        <v-btn
          :color="hasSuggestions ? undefined : 'primary'"
          :variant="hasSuggestions ? 'tonal' : 'flat'"
          size="large"
          :disabled="locked"
          @click="recognizeCurrent"
          ><AppIcon name="ocr" :size="20" />{{
            t(recognizing ? 'workflow.recognizing' : 'workflow.recognize')
          }}</v-btn
        >
      </div>
      <OcrProgress :ocr="ocr" />
      <div class="review-layout">
        <aside v-if="currentPages[0]" class="review-scan">
          <button
            :disabled="locked"
            :aria-label="t('scan.openPreview', { number: pages.indexOf(currentPages[0]) + 1 })"
            @click="openPreview(currentPages[0], $event.currentTarget)"
          >
            <BlobImage
              :blob="currentPages[0].thumbnail"
              :alt="documentTitle(currentDocument)"
            /><span>{{ t('scan.pageCount', { count: currentPages.length }) }}</span
            ><AppIcon name="expand" :size="18" />
          </button>
        </aside>
        <DocumentInformation
          :key="currentDocument.id"
          :document="currentDocument"
          :session="active"
          :disabled="locked"
          managed
          @value="(key, value) => changeDocuments('editValue', currentDocument.id, key, value)"
          @analyze="analyzeDocument(currentDocument.id)"
          @custom="
            (label, value) => changeDocuments('addCustomField', currentDocument.id, label, value)
          "
        />
      </div>
      <details class="review-text-tools bordered-card">
        <summary>{{ t('workflow.text') }}</summary>
        <OcrLanguagePicker
          :model-value="languages"
          :disabled="locked"
          @update:model-value="setLanguages"
        />
        <p v-if="storageError" class="scan-error" role="alert">{{ t('ocr.settingsError') }}</p>
        <div v-for="(page, index) in currentPages" :key="page.id" class="review-text-row">
          <BlobImage
            :blob="page.thumbnail"
            :alt="t('scan.pageNumber', { number: index + 1 })"
          /><span>{{ t('scan.pageNumber', { number: index + 1 }) }}</span
          ><v-btn
            variant="text"
            :disabled="locked"
            @click="recognizePage(page, $event.currentTarget)"
            >{{ t('workflow.recognizePage') }}</v-btn
          ><v-btn
            v-if="page.ocr"
            variant="text"
            :disabled="locked"
            @click="openText(page, $event.currentTarget)"
            >{{ t('workflow.fullText') }}</v-btn
          >
        </div>
      </details>
      <p v-if="state.documents.length > 1" class="small-muted">
        {{
          t('workflow.reviewCount', {
            done: state.documents.filter((item) => isConfirmationCurrent(active, item)).length,
            total: state.documents.length,
          })
        }}
      </p>
      <footer class="workflow-navigation">
        <v-btn variant="text" :disabled="locked" @click="go(2)">{{ t('workflow.back') }}</v-btn>
        <div>
          <v-btn variant="text" :disabled="locked" @click="go(4)">{{ t('workflow.skip') }}</v-btn
          ><v-btn
            :color="hasSuggestions ? 'primary' : undefined"
            :variant="hasSuggestions ? 'flat' : 'tonal'"
            size="large"
            :disabled="locked || validationErrors(currentDocument).length > 0"
            @click="confirmCurrent"
            >{{ t('workflow.confirmNext') }}</v-btn
          >
        </div>
      </footer>
    </section>

    <section v-if="currentStep === 4" class="workflow-result">
      <div class="result-document-grid">
        <button
          v-for="(item, index) in state.documents"
          :key="item.id"
          class="result-document bordered-card"
          data-testid="workflow-document"
          :class="{ selected: item.id === currentDocument?.id }"
          :aria-pressed="item.id === currentDocument?.id"
          :disabled="locked"
          @click="selectDocument(item.id)"
        >
          <BlobImage
            v-if="documentPages(active, item)[0]"
            :blob="documentPages(active, item)[0].thumbnail"
            :alt="documentTitle(item, index)"
          /><span
            ><strong>{{ documentTitle(item, index) }}</strong
            ><small
              >{{ t('grouping.types.' + (item.values.document_type || 'unknown')) }} ·
              {{ t('scan.pageCount', { count: item.pageIds.length }) }}</small
            ><small class="field-status">{{
              t(isConfirmationCurrent(active, item) ? 'workflow.confirmed' : 'workflow.check')
            }}</small></span
          >
        </button>
      </div>
      <div v-if="currentDocument" class="result-action bordered-card">
        <AppIcon name="file" :size="36" />
        <h3>{{ documentTitle(currentDocument, state.documents.indexOf(currentDocument)) }}</h3>
        <p>
          {{
            t(
              isConfirmationCurrent(active, currentDocument)
                ? 'workflow.pdfVerified'
                : 'workflow.pdfUnverified',
            )
          }}
        </p>
        <div v-if="isConfirmationCurrent(active, currentDocument)" class="pdf-actions">
          <v-btn
            color="primary"
            size="large"
            :disabled="locked"
            @click="openPdf(currentDocument.id, $event.currentTarget)"
            >{{ t('pdf.create') }}</v-btn
          >
        </div>
        <div v-else class="pdf-actions">
          <v-btn color="primary" size="large" :disabled="locked" @click="go(3)">{{
            t('workflow.review')
          }}</v-btn
          ><v-btn
            variant="tonal"
            size="large"
            :disabled="locked"
            @click="openPdf(currentDocument.id, $event.currentTarget, true)"
            >{{ t('workflow.scansOnly') }}</v-btn
          >
        </div>
        <p class="small-muted">{{ t('workflow.pdfStored') }}</p>
      </div>
      <footer class="workflow-navigation">
        <v-btn variant="text" :disabled="locked" @click="go(3)">{{ t('workflow.back') }}</v-btn>
      </footer>
    </section>

    <footer class="workspace-savebar bordered-card">
      <div role="status">
        <span
          class="save-dot"
          :class="{ saved: !dirty && active?.revision, failed: saveFailed }"
        /><strong>{{
          t(
            saving
              ? 'workflow.saving'
              : saveFailed
                ? 'workflow.saveFailed'
                : dirty
                  ? 'workflow.unsaved'
                  : active?.revision
                    ? 'workflow.saved'
                    : 'scan.newState',
          )
        }}</strong
        ><small>{{ t('workflow.saveHint') }}</small>
      </div>
      <v-btn
        variant="text"
        :disabled="locked || (!pages.length && !active?.revision) || !dirty"
        @click="save"
        ><AppIcon name="save" :size="18" />{{
          t(saveFailed ? 'workflow.retrySave' : 'scan.save')
        }}</v-btn
      >
    </footer>
    <p class="workflow-local-note">
      <AppIcon name="shield" :size="17" />{{ t('scan.localTitle') }}
    </p>
    <ImagePreviewDialog
      :page="selectedPage"
      :return-focus="previewTrigger"
      @close="selectedPage = null"
    />
    <PdfExportDialog
      v-if="pdfDocumentId"
      :controller="session"
      :document-id="pdfDocumentId"
      :initial-options="pdfInitial"
      auto-preview
      @close="closePdf"
      @review="reviewPdf"
    />
    <ScanEditorDialog
      v-if="editingPage"
      :page="editingPage"
      :simple="simpleEditor"
      @close="closeEditor"
      @apply="applyEditing"
    />
    <OcrResultDialog
      v-if="ocrPageId"
      :pages="pages"
      :selected-id="ocrPageId"
      :ocr="ocr"
      @close="closeText"
      @recognize="runOcr([$event])"
    />
  </div>
</template>
