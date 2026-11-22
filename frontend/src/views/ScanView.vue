<script setup>
import {
  computed,
  ref,
  shallowRef,
  watch,
  nextTick,
  defineAsyncComponent,
  onMounted,
  onUnmounted,
} from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import ScanPageCard from '../components/ScanPageCard.vue'
import ImagePreviewDialog from '../components/ImagePreviewDialog.vue'
import ScanEditorDialog from '../components/ScanEditorDialog.vue'
import AiAnalysisOverlay from '../components/AiAnalysisOverlay.vue'
import AddToCollection from '../components/AddToCollection.vue'
import DocumentGroups from '../components/DocumentGroups.vue'
import PageHeading from '../components/PageHeading.vue'
import MobileStepFooter from '../components/MobileStepFooter.vue'
import CapturePanel from '../components/CapturePanel.vue'
import { useAppearance } from '../composables/useAppearance'
import { usePdfPreferences } from '../features/pdf/usePdfPreferences'
import DocumentBoundaryPicker from '../components/DocumentBoundaryPicker.vue'
import DocumentReview from '../components/DocumentReview.vue'
import BlobImage from '../components/BlobImage.vue'
import { workflowState, recognizeDocument } from '../features/documents/workflow.js'
import { AiError } from '../features/documents/openai.js'
import {
  documentPages,
  unassignedPages,
  isConfirmationCurrent,
  validationErrors,
} from '../features/documents/model.js'
import { useScanSession } from '../features/scanning/useScanSession'
import { errorCode } from '../features/scanning/errors'
import { t } from '../locales'

const route = useRoute(),
  router = useRouter()
const session = useScanSession()
const { isDark, setTheme } = useAppearance()
const { mode: pdfMode } = usePdfPreferences()
const confirmWarning = ref(false)
const documentReview = ref(null)
const analysisProvider = ref('openai')
const analysisProgress = ref({ phase: 'preparing' })
let analysisController = null
const aiConsent = ref(false)
const aiFailed = ref(false)
const sessionMenu = ref(null)
const pdfBusy = ref(false)
const exportCompleted = ref(false)
const PdfExportDialog = defineAsyncComponent(() => import('../components/PdfExportDialog.vue'))
const pdfDocumentId = ref(null),
  pdfTrigger = shallowRef(null),
  documentGroups = ref(null)
const pdfInitial = ref(null)
function openPdf(id, trigger, scansOnly = false) {
  if (locked.value) return
  pdfTrigger.value = trigger
  pdfInitial.value = { includeInformation: !scansOnly && pdfMode.value !== 'scan' }
  pdfDocumentId.value = id
}
async function closePdf() {
  pdfDocumentId.value = null
  await nextTick()
  if (pdfTrigger.value?.isConnected) pdfTrigger.value.focus({ preventScroll: true })
}
async function nextScan() {
  await closePdf()
  await startNew()
}
function openGrouping() {
  multiple.value = true
  closeSessionMenu()
  go(2)
}
function skipUnchecked() {
  confirmWarning.value = false
  go(4)
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
const ocr = { running: ref(false), saveError: ref(null) }
const languages = ref([])
const transitioning = ref(false),
  recognizing = ref(false),
  saveFailed = ref(false)
const locked = computed(
  () =>
    busy.value || ocr.running.value || recognizing.value || transitioning.value || pdfBusy.value,
)
const step = ref(1),
  multiple = ref(false),
  selectedDocumentId = ref(null),
  stepHeading = ref(null)
const state = computed(() => workflowState(active.value))
const currentStep = computed(() => Math.min(step.value, state.value.maximum))
const stepTitles = ['Foto', 'Pārbaudiet lapas', 'Dokumenta dati', 'Dokuments gatavs']
const stepDescription = computed(() => {
  if (currentStep.value === 1) return undefined
  const pageCount = t('scan.pageCount', { count: pages.value.length })
  const count = state.value.documents.length
  return count > 1 ? `${pageCount} · ${count} dokumenti` : pageCount
})
const currentDocument = computed(
  () =>
    state.value.documents.find((item) => item.id === selectedDocumentId.value) ||
    state.value.documents[0],
)
const unassigned = computed(() => (active.value ? unassignedPages(active.value) : []))
watch([analysisProvider, () => currentDocument.value?.id, () => active.value?.id], () => {
  aiConsent.value = false
  aiFailed.value = false
})
const hasSuggestions = computed(() => Boolean(currentDocument.value?.analysis))
const hasManualData = computed(() =>
  Object.entries(currentDocument.value?.values || {}).some(([key, value]) =>
    key !== 'document_type' ? Boolean(value) : value !== 'unknown',
  ),
)
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
  pdfDocumentId.value = null
}
function focusStage() {
  document.getElementById('main-content')?.scrollTo(0, 0)
  stepHeading.value?.focusHeading()
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
    if (target !== 4) pdfDocumentId.value = null
    step.value = target
    saveFailed.value = false
    await nextTick()
    focusStage()
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
  multiple.value = false
  selectedDocumentId.value = active.value.documents[0].id
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
  if (!aiConsent.value) {
    error.value = new AiError('consent_required').message
    return
  }
  recognizing.value = true
  analysisController = new AbortController()
  analysisProgress.value = { phase: 'preparing' }
  clearMessages()
  aiFailed.value = false
  try {
    const result = await recognizeDocument(
      session,
      ocr,
      currentDocument.value.id,
      languages.value,
      () => window.confirm(t('ocr.confirmRerun')),
      {
        provider: 'openai',
        consent: aiConsent.value,
        signal: analysisController.signal,
        onProgress: (progress) => {
          analysisProgress.value = progress
        },
      },
    )
    if (!result.cancelled) {
      saveFailed.value = false
      success.value = t(result.incomplete ? 'workflow.incomplete' : 'workflow.recognized')
    }
  } catch (reason) {
    if (reason instanceof AiError) {
      error.value = reason.message
      aiFailed.value = true
      return
    }
    error.value = reason?.code
      ? t(`scan.errors.${errorCode(reason)}`)
      : t('workflow.processingError')
    saveFailed.value = Boolean(ocr.saveError.value || reason?.code)
  } finally {
    recognizing.value = false
    if (!error.value && currentDocument.value?.analysis) {
      await nextTick()
      const information = document.querySelector('[data-testid="document-information"]')
      information?.focus({ preventScroll: true })
      information?.scrollIntoView({ block: 'start' })
    }
  }
}

async function nextPages() {
  if (locked.value) return
  if (pages.value.length === 1 && !state.value.grouped) await oneDocument()
  if (state.value.grouped) await go(3)
}
async function confirmCurrent() {
  if (locked.value || !currentDocument.value) return
  const info = document.querySelector('[data-testid="document-information"]')
  const invalid = validationErrors(currentDocument.value)
  if (invalid.length) {
    error.value = 'Izlabojiet atzīmētos laukus pirms apstiprināšanas.'
    documentReview.value?.focusInvalid()
    return
  }
  try {
    session.changeDocuments('confirmDocument', currentDocument.value.id)
    await go(4)
  } catch {
    error.value = 'Dokumentu neizdevās apstiprināt. Pārbaudiet datus.'
    info?.focus()
  }
}
async function leaveScan(navigate) {
  if (locked.value) return
  clearMessages()
  try {
    if (dirty.value && (pages.value.length || active.value?.revision)) await session.save()
    await navigate()
  } catch (reason) {
    saveFailed.value = true
    error.value = t('scan.errors.' + errorCode(reason))
  }
}
function home() {
  return leaveScan(() => router.push({ name: 'home' }))
}
async function viewCurrent() {
  if (locked.value || !currentDocument.value) return
  try {
    if (dirty.value) await session.save()
    await router.push({
      name: 'document',
      params: { id: currentDocument.value.id },
      query: { draft: active.value.id, from: 'scan' },
    })
  } catch (reason) {
    error.value = t('scan.errors.' + errorCode(reason))
  }
}
async function skipInformation(event) {
  await go(4)
  if (currentStep.value === 4) openPdf(currentDocument.value.id, event?.currentTarget, true)
}
async function reviewDocument(id) {
  selectedDocumentId.value = id
  await go(3)
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
      if (route.query.source === 'gallery') {
        await nextTick()
        gallery.value?.click()
        await router.replace({
          name: 'scan',
          query: active.value?.revision ? { draft: active.value.id } : {},
        })
      }
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
async function analyzeDocument(id) {
  selectedDocumentId.value = id
  await go(3)
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
    const changedStep = currentStep.value !== 2
    step.value = 2
    session.setWorkflow({ step: 2 })
    if (active.value.documents.length) multiple.value = true
    if (changedStep) {
      await nextTick()
      focusStage()
    }
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
  if (!window.confirm('Dzēst šo lapu?')) return
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
  closeSessionMenu()
  await router.replace({ name: 'scan', query: {} })
}
async function deleteSession() {
  if (locked.value) return
  if (!active.value || !window.confirm(t('scan.confirmDelete'))) return
  clearMessages()
  try {
    await session.discard(active.value.id)
    session.newSession()
    closeSessionMenu()
    await router.replace({ name: 'scan', query: {} })
    success.value = t('scan.deleted')
  } catch (reason) {
    error.value = t(`scan.errors.${errorCode(reason)}`)
  }
}
function goBack() {
  if (locked.value) return
  if (currentStep.value > 1) return go(currentStep.value - 1)
  if (router.options.history.state.back) return leaveScan(() => router.back())
  return home()
}
defineExpose({ goBack, backDisabled: locked })
function closeSessionMenu(restoreFocus = false) {
  if (!sessionMenu.value?.open) return
  sessionMenu.value.open = false
  if (restoreFocus) sessionMenu.value.querySelector('summary')?.focus()
}
function dismissSessionMenu(event) {
  if (!sessionMenu.value?.contains(event.target)) closeSessionMenu()
}
function deviceBack(event) {
  event.preventDefault()
  if (editingPage.value) closeEditor()
  else if (selectedPage.value) selectedPage.value = null
  else if (confirmWarning.value) confirmWarning.value = false
  else if (sessionMenu.value?.open) closeSessionMenu(true)
  else goBack()
}
onMounted(() => {
  window.addEventListener('gaso:back', deviceBack)
  window.addEventListener('pointerdown', dismissSessionMenu)
})
onUnmounted(() => {
  analysisController?.abort()
  window.removeEventListener('gaso:back', deviceBack)
  window.removeEventListener('pointerdown', dismissSessionMenu)
})
</script>
<template>
  <div class="view scan-workspace guided-workspace">
    <Teleport defer to="#app-header-actions">
      <button
        type="button"
        class="icon-button"
        aria-label="Uz sākumu"
        :disabled="locked"
        @click="home"
      >
        <AppIcon name="home" size="var(--icon-size)" />
      </button>
      <details
        ref="sessionMenu"
        class="session-menu"
        @keydown.esc.stop.prevent="closeSessionMenu(true)"
      >
        <summary class="icon-button" aria-label="Dokumenta darbības">
          <AppIcon name="more" size="var(--icon-size)" />
        </summary>
        <div class="header-menu">
          <v-btn variant="text" :disabled="locked" @click="startNew">{{
            t('scan.newSession')
          }}</v-btn>
          <v-btn variant="text" to="/settings">Iestatījumi</v-btn
          ><v-btn variant="text" to="/documents">Dokumenti</v-btn>
          <v-btn v-if="pages.length" variant="text" :disabled="locked" @click="openGrouping"
            >Pārvaldīt dokumentus</v-btn
          >
          <v-btn
            class="theme-toggle"
            variant="text"
            :aria-label="t(isDark ? 'settings.light' : 'settings.dark')"
            @click="setTheme(isDark ? 'light' : 'dark')"
            ><AppIcon :name="isDark ? 'sun' : 'moon'" />{{
              t(isDark ? 'settings.light' : 'settings.dark')
            }}</v-btn
          >
          <v-btn
            v-if="pages.length || active?.revision"
            variant="text"
            color="error"
            :disabled="locked"
            @click="deleteSession"
            >{{ t('scan.deleteSession') }}</v-btn
          >
        </div>
      </details>
    </Teleport>
    <PageHeading
      ref="stepHeading"
      :title="stepTitles[currentStep - 1]"
      :description="stepDescription"
    />
    <div class="scan-stage-content" :class="{ 'capture-stage': currentStep === 1 }">
      <div v-if="error" class="scan-error" role="alert">{{ error }}</div>
      <div v-if="ocr.saveError.value && !error" class="scan-error" role="alert">
        {{ t('scan.errors.' + errorCode(ocr.saveError.value)) }}
      </div>
      <div v-if="success" class="scan-success" role="status">{{ success }}</div>
      <div v-if="busy" class="scan-working" role="status">
        <v-progress-circular
          indeterminate
          :size="20"
          :width="2"
          :aria-label="t('scan.working')"
        />{{ t('scan.working') }}
      </div>
      <span v-show="currentStep === 2" class="sr-only" data-testid="page-count">{{
        pages.length
      }}</span>
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

      <CapturePanel v-if="currentStep === 1" :pages="pages" :disabled="locked" @edit="openEditor" />

      <section v-show="currentStep === 2" class="session-section" :aria-busy="busy">
        <div
          v-if="pages.length > 1 && !multiple && !state.grouped"
          class="single-document-choice bordered-card"
        >
          <h3>{{ t('workflow.groupingQuestion') }}</h3>
          <p>{{ t('workflow.groupingHint') }}</p>
          <v-btn
            color="primary"
            size="large"
            :disabled="locked"
            @click="oneDocument"
            aria-label="Visas lapas ir viens dokuments"
            >Jā, viens</v-btn
          ><v-btn
            variant="text"
            :disabled="locked"
            @click="multiple = true"
            aria-label="Sadalīt vairākos dokumentos"
            >Nē, sadalīt</v-btn
          >
        </div>
        <div v-else-if="pages.length > 1 && !multiple" class="grouping-choice-actions">
          <v-btn variant="text" :disabled="locked" @click="multiple = true">{{
            t('workflow.multiple')
          }}</v-btn>
        </div>
        <div v-else-if="pages.length > 1" class="grouping-choice-actions">
          <v-btn variant="text" :disabled="locked" @click="oneDocument">{{
            t('workflow.one')
          }}</v-btn>
        </div>
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
          />
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
      </section>

      <DocumentReview
        ref="documentReview"
        v-if="currentStep === 3 && currentDocument"
        :session="active"
        :document="currentDocument"
        :disabled="locked"
        :analysis-provider="analysisProvider"
        :ai-consent="aiConsent"
        :ai-failed="aiFailed"
        @provider="analysisProvider = $event"
        @consent="aiConsent = $event"
        @select="selectDocument"
        @preview="openPreview"
        @recognize="recognizeCurrent"
        @skip="go(4)"
        @change="changeDocuments"
        @analyze="analyzeDocument"
      />

      <section v-if="currentStep === 4" class="workflow-result">
        <div v-if="currentDocument && !pdfDocumentId" class="completion-card bordered-card">
          <span class="completion-mark"><AppIcon name="check" :size="28" /></span>
          <h2>
            {{
              isConfirmationCurrent(active, currentDocument)
                ? 'Dokuments apstiprināts'
                : 'Skenējums saglabāts'
            }}
          </h2>
          <BlobImage
            v-if="documentPages(active, currentDocument)[0]"
            :blob="documentPages(active, currentDocument)[0].thumbnail"
            alt="Dokumenta priekšskatījums"
          />
          <h3>{{ documentTitle(currentDocument) }}</h3>
          <p class="small-muted">
            Fotogrāfijas un dati saglabāti šajā ierīcē. PDF varat izveidot arī vēlāk.
          </p>
          <v-btn color="primary" block size="large" :disabled="locked" @click="viewCurrent"
            >Apskatīt dokumentu</v-btn
          >
          <v-btn variant="text" :disabled="locked" @click="startNew">Skenēt nākamo</v-btn>
        </div>
        <AddToCollection
          v-if="currentDocument"
          :controller="session"
          :document-id="currentDocument.id"
        />
        <div v-if="!exportCompleted" class="result-document-grid">
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
        <v-btn
          v-if="currentDocument && !pdfDocumentId"
          color="primary"
          block
          size="x-large"
          @click="
            openPdf(
              currentDocument.id,
              $event.currentTarget,
              !isConfirmationCurrent(active, currentDocument),
            )
          "
          >{{ t('pdf.create') }}</v-btn
        >
        <PdfExportDialog
          v-if="pdfDocumentId && currentStep === 4"
          :controller="session"
          :document-id="pdfDocumentId"
          :initial-options="pdfInitial"
          :inline="currentStep === 4"
          :key="pdfDocumentId"
          :workflow-state="{ ...state, step: currentStep }"
          @busy="pdfBusy = $event"
          @complete="exportCompleted = $event"
          @next="nextScan"
          @select="go"
          @close="closePdf"
          @review="reviewPdf"
        />
      </section>
    </div>
    <Teleport defer to="#app-footer">
      <MobileStepFooter
        v-if="currentStep !== 4"
        :state="{ ...state, step: currentStep }"
        :disabled="locked"
        :dirty="dirty"
        :saving="saving"
        :saved="Boolean(active?.revision)"
        :failed="saveFailed"
        :can-save="Boolean(pages.length || active?.revision)"
        :hint="
          currentStep === 2 && pages.length > 1 && !state.grouped
            ? multiple
              ? 'Atzīmējiet, kur sākas nākamais dokuments'
              : 'Vispirms atbildiet uz jautājumu augšā'
            : undefined
        "
        @select="go"
        @save="save"
      >
        <div v-if="currentStep === 1" class="capture-controls">
          <button
            class="icon-button"
            :disabled="locked"
            aria-label="Pievienot no galerijas"
            @click="gallery.click()"
          >
            <AppIcon name="gallery" :size="23" />
          </button>
          <button
            class="camera-shutter"
            :disabled="locked"
            aria-label="Fotografēt"
            @click="camera.click()"
          >
            <span />
          </button>
          <button class="capture-continue" :disabled="locked || !pages.length" @click="go(2)">
            Turpināt <span>{{ pages.length }}</span>
          </button>
        </div>
        <v-btn
          v-else-if="currentStep === 2"
          color="primary"
          block
          size="x-large"
          :disabled="locked || !pages.length || (pages.length > 1 && !state.grouped)"
          @click="nextPages"
          >Turpināt uz datiem<AppIcon name="arrow" :size="20"
        /></v-btn>
        <template v-else-if="currentStep === 3">
          <v-btn
            v-if="hasSuggestions || hasManualData"
            color="primary"
            block
            size="x-large"
            :disabled="locked"
            @click="confirmCurrent"
            >{{ 'Apstiprināt dokumentu' }}</v-btn
          >
          <button class="text-link skip-data" :disabled="locked" @click="skipInformation">
            Izlaist — saglabāt tikai skenējumu
          </button>
        </template>
      </MobileStepFooter>
    </Teleport>
    <v-dialog
      v-model="confirmWarning"
      max-width="430"
      class="mobile-sheet"
      aria-label="Daži lauki nav pārbaudīti"
    >
      <v-card class="confirmation-sheet app-dialog"
        ><h2>Daži lauki nav pārbaudīti</h2>
        <p>
          Pārbaudiet atrastos ieteikumus. Nepārbaudīti dati netiks iekļauti PDF; varat turpināt ar
          skenējumu.
        </p>
        <v-btn color="primary" block @click="confirmWarning = false">Pārbaudīt laukus</v-btn
        ><v-btn variant="text" block @click="skipUnchecked">Turpināt tāpat</v-btn></v-card
      >
    </v-dialog>
    <AiAnalysisOverlay
      :active="recognizing"
      :progress="analysisProgress"
      @cancel="analysisController?.abort()"
    />
    <ImagePreviewDialog
      :page="selectedPage"
      :pages="currentStep === 3 && currentDocument ? documentPages(active, currentDocument) : pages"
      @select="selectedPage = $event"
      :return-focus="previewTrigger"
      @close="selectedPage = null"
    />
    <PdfExportDialog
      v-if="pdfDocumentId && currentStep !== 4"
      :controller="session"
      :document-id="pdfDocumentId"
      :initial-options="pdfInitial"
      :inline="currentStep === 4"
      :key="pdfDocumentId"
      :workflow-state="{ ...state, step: currentStep }"
      @busy="pdfBusy = $event"
      @complete="exportCompleted = $event"
      @next="nextScan"
      @select="go"
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
  </div>
</template>
