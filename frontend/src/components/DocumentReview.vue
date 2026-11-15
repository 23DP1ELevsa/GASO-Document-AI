<script setup>
import { computed } from 'vue'
import AppIcon from './AppIcon.vue'
import BlobImage from './BlobImage.vue'
import OcrProgress from './OcrProgress.vue'
import OcrLanguagePicker from './OcrLanguagePicker.vue'
import DocumentInformation from './DocumentInformation.vue'
import { documentPages, isConfirmationCurrent } from '../features/documents/model.js'
import { t } from '../locales'
const props = defineProps({
  session: Object,
  document: Object,
  ocr: Object,
  languages: Array,
  settingsError: Boolean,
  disabled: Boolean,
})
const emit = defineEmits([
  'select',
  'preview',
  'recognize',
  'skip',
  'change',
  'analyze',
  'languages',
  'recognize-page',
  'text',
])
const pages = computed(() => documentPages(props.session, props.document))
const documents = computed(() => props.session.documents.filter((item) => item.pageIds.length))
const hasSuggestions = computed(() => Boolean(props.document.analysis))
const documentTitle = (item, index = 0) =>
  item.values.document_title || t('workflow.documentNumber', { number: index + 1 })
</script>
<template>
  <section class="workflow-review">
    <label v-if="documents.length > 1" class="workflow-document-select"
      >{{ t('workflow.selectDocument')
      }}<select
        :value="document.id"
        :disabled="disabled"
        @change="emit('select', $event.target.value)"
      >
        <option v-for="(item, index) in documents" :key="item.id" :value="item.id">
          {{ documentTitle(item, index)
          }}{{ isConfirmationCurrent(session, item) ? ' · ' + t('workflow.confirmed') : '' }}
        </option>
      </select></label
    >
    <div v-if="pages.length" class="review-preview-strip">
      <button
        v-for="(page, index) in pages"
        :key="page.id"
        :disabled="disabled"
        :aria-label="t('scan.openPreview', { number: session.pages.indexOf(page) + 1 })"
        @click="emit('preview', page, $event.currentTarget)"
      >
        <BlobImage :blob="page.thumbnail" alt="" /><span>{{ index + 1 }}</span>
      </button>
    </div>
    <div v-if="!hasSuggestions" class="recognition-panel bordered-card">
      <span class="recognition-icon"><AppIcon name="sparkles" :size="24" /></span>
      <h3>Atrast svarīgos datus</h3>
      <p>Atradīsim numuru, datumus un summu. Pārbaudiet atrasto vai aizpildiet laukus paši.</p>
      <button class="text-link" :disabled="disabled" @click="emit('skip')">
        Izlaist — saglabāt tikai skenējumu
      </button>
    </div>
    <v-btn v-else variant="text" color="primary" :disabled="disabled" @click="emit('recognize')">{{
      t('workflow.recognize')
    }}</v-btn>
    <OcrProgress :ocr="ocr" />
    <div class="review-layout">
      <DocumentInformation
        :key="document.id"
        :document="document"
        :session="session"
        :disabled="disabled"
        managed
        @value="(key, value) => emit('change', 'editValue', document.id, key, value)"
        @analyze="emit('analyze', document.id)"
        @custom="(label, value) => emit('change', 'addCustomField', document.id, label, value)"
      />
    </div>
    <details class="review-text-tools bordered-card">
      <summary>{{ t('workflow.text') }}</summary>
      <OcrLanguagePicker
        :model-value="languages"
        :disabled="disabled"
        @update:model-value="emit('languages', $event)"
      />
      <p v-if="settingsError" class="scan-error" role="alert">{{ t('ocr.settingsError') }}</p>
      <div v-for="(page, index) in pages" :key="page.id" class="review-text-row">
        <BlobImage
          :blob="page.thumbnail"
          :alt="t('scan.pageNumber', { number: index + 1 })"
        /><span>{{ t('scan.pageNumber', { number: index + 1 }) }}</span
        ><v-btn
          variant="text"
          :disabled="disabled"
          @click="emit('recognize-page', page, $event.currentTarget)"
          >{{ t('workflow.recognizePage') }}</v-btn
        ><v-btn
          v-if="page.ocr"
          variant="text"
          :disabled="disabled"
          @click="emit('text', page, $event.currentTarget)"
          >{{ t('workflow.fullText') }}</v-btn
        >
      </div>
    </details>
    <p v-if="documents.length > 1" class="small-muted">
      {{
        t('workflow.reviewCount', {
          done: documents.filter((item) => isConfirmationCurrent(session, item)).length,
          total: documents.length,
        })
      }}
    </p>
  </section>
</template>
