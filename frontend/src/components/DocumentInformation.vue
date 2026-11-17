<script setup>
import { computed, ref } from 'vue'
import { COMMON_FIELDS } from '../features/documents/catalog.js'
import {
  isAnalysisStale,
  isConfirmationCurrent,
  validationErrors,
} from '../features/documents/model.js'
import DocumentAttributeField from './DocumentAttributeField.vue'
import { t } from '../locales'
const props = defineProps({
  document: Object,
  session: Object,
  disabled: Boolean,
  managed: Boolean,
})
const emit = defineEmits(['value', 'custom', 'rename', 'remove', 'review', 'confirm', 'analyze'])
const label = ref(''),
  value = ref('')
const stale = computed(() => isAnalysisStale(props.session, props.document))
const confirmed = computed(() => isConfirmationCurrent(props.session, props.document))
const fields = computed(() => {
  const item = props.document
  const keys = new Set([
    'document_type',
    'document_title',
    ...(item.analysis?.result.version === 2 ? [] : COMMON_FIELDS),
    ...Object.keys(item.values).filter((key) => item.values[key] !== null),
    ...(item.dynamicAttributes || []).map((field) => field.key),
  ])
  return [...keys].map((key) => ({
    ...item.dynamicAttributes?.find((field) => field.key === key),
    key,
    label:
      item.customFields.find((field) => field.key === key)?.label || t('grouping.fields.' + key),
    custom: item.customFields.some((field) => field.key === key),
  }))
})
const pending = computed(() =>
  (props.document.dynamicAttributes || []).filter((field) => field.status !== 'reviewed'),
)
function add() {
  if (!label.value.trim()) return
  emit('custom', label.value, value.value)
  label.value = value.value = ''
}
</script>
<template>
  <section
    class="document-information"
    data-testid="document-information"
    tabindex="-1"
    aria-label="Dokumenta informācija"
  >
    <h3>Dokumenta informācija</h3>
    <p v-if="stale" class="ocr-warning" role="status">
      Attēli ir mainīti. Pārbaudiet informāciju un analizējiet atkārtoti.
    </p>
    <p v-if="confirmed" class="review-status">Informācija apstiprināta</p>
    <p v-if="pending.length" role="status">Vēl jāpārbauda {{ pending.length }} atribūti.</p>
    <v-btn
      v-if="pending.length"
      variant="tonal"
      :disabled="disabled"
      @click="pending.forEach((field) => emit('review', field.key))"
      >Esmu pārbaudījis visus laukus</v-btn
    >
    <div class="attribute-table" role="table" aria-label="Dokumenta atribūti">
      <div v-for="field in fields" :key="field.key" class="attribute-table-row" role="row">
        <div role="cell">
          <label v-if="field.custom"
            >Atribūta nosaukums<input
              :value="field.label"
              maxlength="100"
              :disabled="disabled"
              @change="emit('rename', field.key, $event.target.value)"
          /></label>
          <DocumentAttributeField
            :field="field"
            :document="document"
            :disabled="disabled"
            :stale="stale"
            :confirmed="confirmed"
            :errors="validationErrors(document)"
            @value="(key, value) => emit('value', key, value)"
          />
          <small v-if="field.origin"
            >{{ field.status === 'reviewed' ? 'Pārbaudīts' : 'Jāpārbauda' }} ·
            {{ field.origin === 'ai' ? 'AI ieteikums' : 'Lietotāja dati' }}</small
          >
          <details v-if="field.evidence">
            <summary>Avots · {{ field.page }}. lapa</summary>
            <p>{{ field.evidence }}</p>
            <small>AI nolasīts fragments; salīdziniet ar fotoattēlu.</small>
          </details>
        </div>
        <div role="cell" class="attribute-actions">
          <v-btn
            v-if="field.status === 'unreviewed'"
            variant="text"
            :disabled="disabled"
            :aria-label="'Apstiprināt: ' + field.label"
            @click="emit('review', field.key)"
            >Apstiprināt</v-btn
          >
          <v-btn
            v-if="field.custom"
            variant="text"
            color="error"
            :disabled="disabled"
            :aria-label="'Dzēst: ' + field.label"
            @click="emit('remove', field.key)"
            >Dzēst</v-btn
          >
        </div>
      </div>
    </div>
    <form class="custom-field-form" @submit.prevent="add">
      <h4>Pievienot atribūtu</h4>
      <label
        >Atribūta nosaukums<input v-model="label" maxlength="100" :disabled="disabled"
      /></label>
      <label>Vērtība<input v-model="value" maxlength="2000" :disabled="disabled" /></label>
      <v-btn type="submit" variant="tonal" :disabled="disabled || !label.trim()"
        >Pievienot atribūtu</v-btn
      >
    </form>
    <p v-if="document.analysis?.result.usage" class="small-muted">
      API patēriņš: ievade {{ document.analysis.result.usage.input_tokens ?? '?' }}, izvade
      {{ document.analysis.result.usage.output_tokens ?? '?' }}, kopā
      {{ document.analysis.result.usage.total_tokens ?? '?' }} tokeni.
    </p>
  </section>
</template>
<style>
.document-information {
  scroll-margin-top: 88px;
}
.attribute-table {
  margin: 16px 0;
}
.attribute-table-row {
  padding: 14px 0;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 8px;
}
.attribute-table-row input {
  width: 100%;
  min-width: 0;
}
.attribute-table-row small {
  opacity: 0.7;
}
.attribute-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
}
.attribute-table .document-field {
  display: grid;
  grid-template-columns: minmax(100px, 0.8fr) minmax(0, 1.2fr);
  gap: 10px;
  align-items: start;
}
.attribute-table .field-card-heading {
  display: grid;
  gap: 6px;
}
.attribute-table .field-feedback,
.attribute-table .field-source {
  grid-column: 1 / -1;
}
.attribute-table .document-field input,
.attribute-table .document-field select {
  min-width: 0;
  width: 100%;
}
</style>
