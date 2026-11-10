<script setup>
import { ref, onScopeDispose } from 'vue'
import OcrLanguagePicker from './OcrLanguagePicker.vue'
import { useOcrSettings, prepareOfflineResources } from '../features/ocr/useOcrSettings.js'
import { ocrErrorCode } from '../features/ocr/model.js'
import { t } from '../locales'
const { languages, storageError, setLanguages } = useOcrSettings()
const preparing = ref(false),
  progress = ref(0),
  ready = ref(false),
  error = ref('')
let controller
async function prepare() {
  if (preparing.value) return
  preparing.value = true
  ready.value = false
  error.value = ''
  controller = new AbortController()
  try {
    await prepareOfflineResources(
      languages.value,
      (value) => (progress.value = value),
      controller.signal,
    )
    ready.value = true
  } catch (reason) {
    if (!controller.signal.aborted) error.value = t(`ocr.errors.${ocrErrorCode(reason)}`)
  } finally {
    preparing.value = false
  }
}
onScopeDispose(() => controller?.abort())
</script>
<template>
  <v-card class="settings-card bordered-card">
    <h3>{{ t('ocr.settingsTitle') }}</h3>
    <OcrLanguagePicker
      :model-value="languages"
      :disabled="preparing"
      @update:model-value="setLanguages"
    />
    <p class="small-muted">{{ t('ocr.languageHint') }}</p>
    <p v-if="storageError" class="scan-error" role="alert">{{ t('ocr.settingsError') }}</p>
    <p class="small-muted">{{ t('ocr.offlineHint') }}</p>
    <v-btn
      color="primary"
      variant="tonal"
      class="ocr-offline-button"
      :disabled="preparing"
      @click="prepare"
      >{{ t('ocr.prepareOffline') }}</v-btn
    >
    <div v-if="preparing" role="status">
      <p>{{ t('ocr.preparing') }} {{ progress }}%</p>
      <v-progress-linear :model-value="progress" :aria-label="t('ocr.preparing')" color="primary" />
      <v-btn variant="text" @click="controller?.abort()">{{ t('ocr.cancel') }}</v-btn>
    </div>
    <p v-if="ready" class="scan-success" role="status">{{ t('ocr.offlineReady') }}</p>
    <p v-if="error" class="scan-error" role="alert">{{ error }}</p>
  </v-card>
</template>
