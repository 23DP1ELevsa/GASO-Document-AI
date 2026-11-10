<script setup>
import { computed, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import PageHeading from '../components/PageHeading.vue'
import ScanPageCard from '../components/ScanPageCard.vue'
import ImagePreviewDialog from '../components/ImagePreviewDialog.vue'
import { useScanSession } from '../features/scanning/useScanSession'
import { errorCode } from '../features/scanning/errors'
import { t, dateTime } from '../locales'

const route = useRoute(),
  router = useRouter()
const session = useScanSession()
const { active, dirty, busy } = session
const camera = ref(null),
  gallery = ref(null),
  replacement = ref(null)
const selectedPage = shallowRef(null),
  error = ref(''),
  success = ref('')
let replacementId = null
const previewTrigger = shallowRef(null)
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
async function selected(event, replacing = false) {
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
  if (dirty.value && !window.confirm(t('scan.confirmDiscard'))) return
  clearMessages()
  session.newSession()
  await router.replace({ name: 'scan', query: {} })
}
async function deleteSession() {
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
        <v-btn color="primary" size="large" :disabled="busy" @click="camera.click()"
          ><AppIcon name="camera" :size="20" />{{ t('scan.camera') }}</v-btn
        ><v-btn
          color="primary"
          variant="tonal"
          size="large"
          :disabled="busy"
          @click="gallery.click()"
          ><AppIcon name="gallery" :size="20" />{{ t('scan.gallery') }}</v-btn
        >
      </div>
      <p class="small-muted">{{ t('scan.limits') }}</p></v-card
    >
    <div v-if="error" class="scan-error" role="alert">{{ error }}</div>
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
          <v-btn variant="text" :disabled="busy" @click="startNew"
            ><AppIcon name="plus" :size="18" />{{ t('scan.newSession') }}</v-btn
          ><v-btn
            v-if="pages.length || active?.revision"
            variant="text"
            color="error"
            :disabled="busy"
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
          :busy="busy"
          @preview="openPreview"
          @move="move"
          @replace="replace"
          @remove="remove"
        />
      </div>
    </section>
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
        :disabled="busy || (!pages.length && !active?.revision) || !dirty"
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
  </div>
</template>
