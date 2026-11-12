<script setup>
import { computed, ref, shallowRef, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import PageHeading from '../components/PageHeading.vue'
import ScanPageCard from '../components/ScanPageCard.vue'
import ImagePreviewDialog from '../components/ImagePreviewDialog.vue'
import ScanEditorDialog from '../components/ScanEditorDialog.vue'
import OcrResultDialog from '../components/OcrResultDialog.vue'
import OcrLanguagePicker from '../components/OcrLanguagePicker.vue'
import DocumentGroups from '../components/DocumentGroups.vue'
import { useOcrSession } from '../features/ocr/useOcrSession.js'
import { useOcrSettings } from '../features/ocr/useOcrSettings.js'
import { useScanSession } from '../features/scanning/useScanSession'
import { errorCode } from '../features/scanning/errors'
import { t, dateTime } from '../locales'

const route = useRoute(),
  router = useRouter()
const session = useScanSession()
const { active, dirty, busy } = session
const ocr = useOcrSession(session)
const { languages, storageError, setLanguages } = useOcrSettings()
const locked = computed(() => busy.value || ocr.running.value)
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
function openEditor(page, trigger) {
  editorTrigger.value = trigger
  editingPage.value = page
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
  } catch (reason) {
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
  <div class="view scan-workspace">
    <PageHeading
      :eyebrow="t('scan.eyebrow')"
      :title="t('scan.title')"
      :description="t('scan.description')"
    />
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
    <v-card class="scan-import-card bordered-card"
      ><div class="scan-import-heading">
        <span class="step-icon"><AppIcon name="camera" /></span>
        <div>
          <h2>{{ t('scan.importTitle') }}</h2>
          <p>{{ t('scan.cameraHint') }}</p>
        </div>
      </div>
      <div class="scan-import-actions">
        <v-btn color="primary" size="large" :disabled="locked" @click="camera.click()"
          ><AppIcon name="camera" :size="20" />{{ t('scan.camera') }}</v-btn
        ><v-btn
          color="primary"
          variant="tonal"
          size="large"
          :disabled="locked"
          @click="gallery.click()"
          ><AppIcon name="gallery" :size="20" />{{ t('scan.gallery') }}</v-btn
        >
      </div>
      <p class="small-muted">{{ t('scan.limits') }}</p></v-card
    >
    <div v-if="error" class="scan-error" role="alert">{{ error }}</div>
    <div v-if="ocr.saveError.value" class="scan-error" role="alert">
      {{ t(`scan.errors.${errorCode(ocr.saveError.value)}`) }}
    </div>
    <div v-if="success" class="scan-success" role="status">{{ success }}</div>
    <div v-if="busy" class="scan-working" role="status">
      <v-progress-circular
        indeterminate
        :size="22"
        :width="2"
        color="primary"
        :aria-label="t('scan.working')"
      />{{ t('scan.working') }}
    </div>
    <section class="session-section" :aria-busy="busy">
      <header class="session-heading">
        <div>
          <h2>
            {{ t('scan.preview') }}
            <span class="count-badge" data-testid="page-count">{{ pages.length }}</span>
          </h2>
          <p v-if="active">{{ t('documents.created') }} {{ dateTime(active.createdAt) }}</p>
        </div>
        <div class="session-tools">
          <v-btn variant="text" :disabled="locked" @click="startNew"
            ><AppIcon name="plus" :size="18" />{{ t('scan.newSession') }}</v-btn
          ><v-btn
            v-if="pages.length || active?.revision"
            variant="text"
            color="error"
            :disabled="locked"
            :aria-label="t('scan.deleteSession')"
            @click="deleteSession"
            ><AppIcon name="trash" :size="20"
          /></v-btn>
        </div>
      </header>
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
    </section>
    <DocumentGroups
      v-if="active && (pages.length || active.documents.length)"
      :key="active.id"
      :session="active"
      :disabled="locked"
      @change="changeDocuments"
      @analyze="analyzeDocument"
    />
    <v-card v-if="pages.length" class="ocr-session bordered-card">
      <h3>{{ t('ocr.sessionTitle') }}</h3>
      <p class="small-muted">{{ t('ocr.sessionHint') }}</p>
      <OcrLanguagePicker
        :model-value="languages"
        :disabled="locked"
        @update:model-value="setLanguages"
      />
      <p v-if="storageError" class="scan-error" role="alert">{{ t('ocr.settingsError') }}</p>
      <v-btn color="primary" variant="tonal" :disabled="locked" @click="runOcr(pages)">{{
        t('ocr.recognizeAll')
      }}</v-btn>
      <div v-if="ocr.total.value" class="ocr-progress" role="status">
        <p>
          {{
            t('ocr.batchProgress', {
              current: ocr.current.value,
              total: ocr.total.value,
              completed: ocr.completed.value,
              errors: ocr.errors.value,
            })
          }}
        </p>
        <template v-if="ocr.running.value">
          <p>{{ t(`ocr.phase.${ocr.phase.value}`) }} {{ ocr.progress.value }}%</p>
          <v-progress-linear
            :model-value="ocr.progress.value"
            :aria-label="t('ocr.progress')"
            color="primary"
          />
          <v-btn variant="text" @click="ocr.cancel">{{ t('ocr.cancel') }}</v-btn>
        </template>
        <p v-else-if="ocr.cancelled.value">{{ t('ocr.cancelled') }}</p>
      </div>
      <p v-if="ocr.message.value" class="scan-error" role="alert">
        {{ t(`ocr.errors.${ocr.message.value}`) }}
      </p>
      <details v-if="pages.some((page) => page.ocr)">
        <summary>{{ t('ocr.combined') }}</summary>
        <p class="small-muted">{{ t('ocr.combinedHint') }}</p>
        <textarea readonly :value="ocr.combinedText.value" :aria-label="t('ocr.combined')" />
      </details>
    </v-card>
    <v-card class="session-savebar bordered-card"
      ><div>
        <h3>
          {{ t(dirty ? 'scan.unsaved' : active?.revision ? 'scan.savedState' : 'scan.newState') }}
        </h3>
        <p>
          {{ t('scan.pageCount', { count: pages.length })
          }}<span v-if="active?.revision && !dirty"> · {{ dateTime(active.updatedAt) }}</span>
        </p>
      </div>
      <v-btn
        color="primary"
        :disabled="locked || (!pages.length && !active?.revision) || !dirty"
        @click="save"
        ><AppIcon name="save" :size="19" />{{ t('scan.save') }}</v-btn
      ></v-card
    >
    <div class="scan-local-info">
      <AppIcon name="shield" :size="24" />
      <div>
        <h3>{{ t('scan.localTitle') }}</h3>
        <p>{{ t('scan.localInfo') }}</p>
        <p>{{ t('scan.unsavedHint') }}</p>
      </div>
    </div>
    <ImagePreviewDialog
      :page="selectedPage"
      :return-focus="previewTrigger"
      @close="selectedPage = null"
    />
    <ScanEditorDialog
      v-if="editingPage"
      :page="editingPage"
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
