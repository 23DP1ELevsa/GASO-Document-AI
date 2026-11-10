<script setup>
import { ref, shallowRef, computed, onMounted, onScopeDispose } from 'vue'
import AppIcon from './AppIcon.vue'
import CornerPicker from './CornerPicker.vue'
import { useBlobUrl } from '../composables/useBlobUrl'
import { readOriginal } from '../features/scanning/draftRepository'
import { errorCode } from '../features/scanning/errors'
import { processingJob } from '../features/processing/processor'
import {
  defaultProcessing,
  normalizeProcessing,
  processingKey,
  validCorners,
} from '../features/processing/geometry'
import { t } from '../locales'

const props = defineProps({ page: { type: Object, required: true } })
const emit = defineEmits(['close', 'apply'])
const parameters = ref(defaultProcessing()),
  source = shallowRef(null),
  display = shallowRef(null),
  preview = shallowRef(null)
const displayUrl = useBlobUrl(() => display.value),
  previewUrl = useBlobUrl(() => preview.value)
const busy = ref(false),
  progress = ref(0),
  error = ref(''),
  notice = ref(''),
  previewKey = ref(''),
  savedKey = ref(''),
  limited = ref(false)
const valid = computed(() => validCorners(parameters.value.corners))
const currentKey = computed(() => (valid.value ? processingKey(parameters.value) : ''))
const stale = computed(() => previewKey.value !== currentKey.value)
const changed = computed(() => currentKey.value !== savedKey.value)
let job = null,
  disposed = false
async function run(action, extra = {}) {
  if (busy.value || disposed) return null
  busy.value = true
  progress.value = 0
  error.value = ''
  try {
    job = processingJob(
      {
        action,
        original: source.value,
        width: props.page.width,
        height: props.page.height,
        ...extra,
      },
      (value) => {
        progress.value = value
      },
    )
    const result = await job.promise
    return disposed ? null : result
  } catch (reason) {
    if (!disposed && reason.code !== 'cancelled')
      error.value = t(`scan.errors.${errorCode(reason)}`)
    return null
  } finally {
    job = null
    if (!disposed) busy.value = false
  }
}
function acceptDetection(detection) {
  if (detection?.status === 'found') {
    parameters.value = { ...parameters.value, corners: detection.corners }
    notice.value = t('editor.detected')
  } else notice.value = t('editor.uncertain')
}
async function renderPreview() {
  if (!valid.value) {
    error.value = t('scan.errors.invalidQuad')
    return
  }
  const snapshot = normalizeProcessing(parameters.value)
  const result = await run('render', { parameters: snapshot, preview: true })
  if (result) {
    preview.value = result.processed
    previewKey.value = processingKey(snapshot)
    limited.value = result.limited
  }
}
onMounted(async () => {
  try {
    source.value = props.page.original || (await readOriginal(props.page.id))
    if (disposed) return
    parameters.value = normalizeProcessing(props.page.processing)
    savedKey.value = processingKey(parameters.value)
    const result = await run('inspect', { detect: !props.page.processing })
    if (!result) return
    display.value = result.display
    if (!props.page.processing) acceptDetection(result.detection)
    await renderPreview()
  } catch (reason) {
    if (!disposed) error.value = t(`scan.errors.${errorCode(reason)}`)
  }
})
async function detect() {
  const result = await run('detect')
  if (result) {
    acceptDetection(result.detection)
    await renderPreview()
  }
}
function cornersChanged(corners) {
  parameters.value = { ...parameters.value, corners }
  error.value = ''
}
async function resetCorners() {
  parameters.value = { ...parameters.value, corners: defaultProcessing().corners }
  notice.value = t('editor.manual')
  await renderPreview()
}
async function rotate(degrees) {
  parameters.value = {
    ...parameters.value,
    rotation: (parameters.value.rotation + degrees + 360) % 360,
  }
  await renderPreview()
}
async function resetRotation() {
  parameters.value = { ...parameters.value, rotation: 0 }
  await renderPreview()
}
async function filter(value) {
  parameters.value = { ...parameters.value, filter: value }
  await renderPreview()
}
async function restore() {
  parameters.value = defaultProcessing()
  notice.value = t('editor.restored')
  await renderPreview()
}
async function apply() {
  if (!valid.value || stale.value || busy.value) return
  const result = await run('render', {
    parameters: normalizeProcessing(parameters.value),
    preview: false,
  })
  if (result) emit('apply', { ...result, original: source.value })
}
onScopeDispose(() => {
  disposed = true
  job?.cancel()
  source.value = null
  display.value = null
  preview.value = null
})
</script>
<template>
  <v-dialog
    :model-value="true"
    max-width="1320"
    :persistent="busy"
    :aria-label="t('editor.edit')"
    @update:model-value="!$event && emit('close')"
  >
    <v-card class="scan-editor">
      <header class="editor-heading">
        <div>
          <p class="eyebrow">{{ t('editor.eyebrow') }}</p>
          <h2>{{ t('editor.edit') }}</h2>
          <p class="small-muted">{{ page.name }}</p>
        </div>
        <v-btn variant="text" :aria-label="t('editor.cancel')" @click="emit('close')"
          ><AppIcon name="close"
        /></v-btn>
      </header>
      <div v-if="error" class="scan-error" role="alert">{{ error }}</div>
      <p v-if="notice" class="editor-notice" role="status">{{ notice }}</p>
      <div v-if="busy" class="editor-progress" role="status">
        <v-progress-circular
          indeterminate
          :size="22"
          :width="2"
          color="primary"
          :aria-label="t('editor.working')"
        /><span>{{ t('editor.working') }} {{ progress }}%</span>
      </div>
      <div v-if="displayUrl" class="editor-layout">
        <section class="editor-original">
          <h3>{{ t('editor.original') }}</h3>
          <CornerPicker
            :url="displayUrl"
            :width="page.width"
            :height="page.height"
            :corners="parameters.corners"
            :disabled="busy"
            @update="cornersChanged"
          />
          <div class="editor-row">
            <v-btn variant="tonal" color="primary" :disabled="busy" @click="detect"
              ><AppIcon name="scan" :size="18" />{{ t('editor.detect') }}</v-btn
            ><v-btn variant="text" :disabled="busy" @click="resetCorners">{{
              t('editor.resetCorners')
            }}</v-btn>
          </div>
        </section>
        <section class="editor-result">
          <h3>{{ t('editor.result') }}</h3>
          <div class="editor-result-image">
            <img v-if="previewUrl" :src="previewUrl" :alt="t('editor.result')" />
            <p v-else class="small-muted">{{ t('editor.previewHint') }}</p>
          </div>
          <p v-if="stale" class="editor-validation" role="status">{{ t('editor.stale') }}</p>
          <p v-if="!valid" class="editor-validation" role="alert">
            {{ t('scan.errors.invalidQuad') }}
          </p>
          <div class="editor-filter-options" role="group" :aria-label="t('editor.filters')">
            <v-btn
              v-for="mode in ['original', 'enhanced', 'grayscale', 'bw']"
              :key="mode"
              :variant="parameters.filter === mode ? 'tonal' : 'text'"
              color="primary"
              :aria-pressed="parameters.filter === mode"
              :disabled="busy || !valid"
              @click="filter(mode)"
              >{{ t(`editor.filter.${mode}`) }}</v-btn
            >
          </div>
          <div class="editor-rotation" role="group" :aria-label="t('editor.rotation')">
            <v-btn variant="outlined" :disabled="busy || !valid" @click="rotate(-90)">{{
              t('editor.left')
            }}</v-btn
            ><v-btn variant="outlined" :disabled="busy || !valid" @click="rotate(90)">{{
              t('editor.right')
            }}</v-btn
            ><v-btn variant="outlined" :disabled="busy || !valid" @click="rotate(180)">180°</v-btn
            ><v-btn variant="text" :disabled="busy || !valid" @click="resetRotation">{{
              t('editor.resetRotation')
            }}</v-btn>
          </div>
          <p class="small-muted">{{ t('editor.rotationValue', { value: parameters.rotation }) }}</p>
        </section>
      </div>
      <p v-if="displayUrl" class="editor-limit-note small-muted">{{ t('editor.limits') }}</p>
      <footer class="editor-footer">
        <v-btn variant="text" :disabled="busy || !source" @click="restore">{{
          t('editor.restore')
        }}</v-btn>
        <div>
          <v-btn variant="text" @click="emit('close')">{{ t('editor.cancel') }}</v-btn
          ><v-btn
            variant="tonal"
            color="primary"
            :disabled="busy || !displayUrl || !valid"
            @click="renderPreview"
            >{{ t('editor.preview') }}</v-btn
          ><v-btn
            color="primary"
            :disabled="busy || !displayUrl || !valid || stale || !changed"
            @click="apply"
            >{{ t('editor.apply') }}</v-btn
          >
        </div>
      </footer>
      <p class="small-muted editor-save-hint">{{ t('editor.saveHint') }}</p>
    </v-card>
  </v-dialog>
</template>
