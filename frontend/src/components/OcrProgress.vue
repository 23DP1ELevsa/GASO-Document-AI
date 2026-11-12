<script setup>
import { errorCode } from '../features/scanning/errors.js'
import { t } from '../locales'
defineProps({ ocr: Object })
</script>
<template>
  <div v-if="ocr.total.value" class="ocr-progress">
    <p role="status">
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
      <p role="status">{{ t('ocr.phase.' + ocr.phase.value) }} {{ ocr.progress.value }}%</p>
      <v-progress-linear
        :model-value="ocr.progress.value"
        color="primary"
        :aria-label="t('ocr.progress')"
      />
      <v-btn variant="text" @click="ocr.cancel">{{ t('ocr.cancel') }}</v-btn>
    </template>
    <p v-if="ocr.cancelled.value && !ocr.running.value" role="status">{{ t('ocr.cancelled') }}</p>
    <p v-if="ocr.message.value" class="scan-error" role="alert">
      {{ t('ocr.errors.' + ocr.message.value) }}
    </p>
    <p v-if="ocr.saveError.value" class="scan-error" role="alert">
      {{ t('scan.errors.' + errorCode(ocr.saveError.value)) }}
    </p>
  </div>
</template>
