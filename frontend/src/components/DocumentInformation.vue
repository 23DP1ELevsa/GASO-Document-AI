<script setup>
import { computed, ref, nextTick } from 'vue'
import { ALL_FIELDS } from '../features/documents/catalog.js'
import {
  isAnalysisStale,
  isConfirmationCurrent,
  validationErrors,
  reviewValues,
} from '../features/documents/model.js'
import { attributeFields, displayValue } from '../features/documents/presentation.js'
import DocumentAttributeField from './DocumentAttributeField.vue'
import AppIcon from './AppIcon.vue'
import { t } from '../locales'
const props = defineProps({
  document: Object,
  session: Object,
  disabled: Boolean,
  managed: Boolean,
  readOnly: Boolean,
})
const emit = defineEmits(['value', 'custom', 'rename', 'remove', 'confirm', 'analyze'])
const editing = ref(null),
  label = ref(''),
  value = ref(''),
  standard = ref('custom')
const stale = computed(() => isAnalysisStale(props.session, props.document))
const confirmed = computed(() => isConfirmationCurrent(props.session, props.document))
const fields = computed(() =>
  attributeFields(props.document, { suggestions: !props.readOnly && !stale.value }),
)
const formDocument = computed(() => ({
  ...props.document,
  values: !stale.value && !props.readOnly ? reviewValues(props.document) : props.document.values,
}))
const errors = computed(() => validationErrors(formDocument.value))
async function edit(key) {
  editing.value = key
  await nextTick()
  document.getElementById(props.document.id + '-' + key)?.focus()
}
async function focusInvalid() {
  if (!errors.value.length) return false
  await edit(errors.value[0])
  await nextTick()
  document
    .getElementById(props.document.id + '-' + errors.value[0])
    ?.scrollIntoView({ block: 'center' })
  return true
}
defineExpose({ focusInvalid })
function removeField(key) {
  emit('remove', key)
  editing.value = null
}
async function finishEditing() {
  document.activeElement?.blur()
  await nextTick()
  if (!errors.value.includes(editing.value)) editing.value = null
  else document.getElementById(props.document.id + '-' + editing.value)?.focus()
}
function add() {
  if (standard.value !== 'custom') {
    emit('value', standard.value, value.value || '')
    edit(standard.value)
  } else {
    if (!label.value.trim()) return
    emit('custom', label.value, value.value)
  }
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
    <p v-if="stale && !readOnly" class="ocr-warning" role="status">
      Dokuments ir mainīts. Pārbaudiet datus pirms apstiprināšanas.
    </p>
    <p v-if="confirmed" class="review-status" role="status">Informācija apstiprināta</p>
    <p v-else-if="!readOnly" class="small-muted">
      Pārskatiet datus. Labojiet tikai to, kas nav pareizs.
    </p>
    <dl class="compact-attributes">
      <div
        v-for="field in fields"
        :key="field.key"
        class="compact-attribute"
        :class="{ editing: editing === field.key && !readOnly }"
        :data-field="field.key"
      >
        <dt>{{ field.label }}</dt>
        <dd>
          <template v-if="editing !== field.key || readOnly"
            ><span>{{ displayValue(field) }}</span
            ><button
              v-if="!readOnly"
              type="button"
              class="icon-button"
              :disabled="disabled"
              :aria-label="'Rediģēt: ' + field.label"
              @click="edit(field.key)"
            >
              <AppIcon name="edit" :size="18" />
            </button>
            <p v-if="errors.includes(field.key) && !readOnly" class="field-error" role="alert">
              {{ t('grouping.invalidValue') }}
            </p></template
          >
          <div v-else class="inline-attribute-editor">
            <label v-if="field.custom"
              >Lauka nosaukums<input
                :value="field.label"
                maxlength="100"
                :disabled="disabled"
                @change="emit('rename', field.key, $event.target.value)"
            /></label>
            <DocumentAttributeField
              :field="field"
              :document="formDocument"
              :disabled="disabled"
              :stale="stale"
              :confirmed="confirmed"
              :errors="errors"
              @value="(key, value) => emit('value', key, value)"
            />
            <div class="inline-edit-actions">
              <v-btn variant="tonal" :disabled="disabled" @click="finishEditing">Gatavs</v-btn
              ><v-btn
                v-if="field.custom"
                variant="text"
                color="error"
                :disabled="disabled"
                @click="removeField(field.key)"
                >Dzēst</v-btn
              >
            </div>
          </div>
        </dd>
      </div>
    </dl>
    <p v-if="!fields.length" class="small-muted">Vēl nav pievienotas dokumenta informācijas.</p>
    <details v-if="!readOnly" class="review-extra">
      <summary>Pievienot lauku</summary>
      <form class="custom-field-form" @submit.prevent="add">
        <label
          >Lauks<select v-model="standard" :disabled="disabled">
            <option value="custom">Pielāgots atribūts</option>
            <option
              v-for="key in ALL_FIELDS.filter((key) => !fields.some((field) => field.key === key))"
              :key="key"
              :value="key"
            >
              {{ t('grouping.fields.' + key) }}
            </option>
          </select></label
        >
        <label v-if="standard === 'custom'"
          >Atribūta nosaukums<input v-model="label" maxlength="100" :disabled="disabled"
        /></label>
        <label
          >Atribūta vērtība<input v-model="value" maxlength="2000" :disabled="disabled"
        /></label>
        <v-btn
          type="submit"
          variant="tonal"
          :disabled="disabled || (standard === 'custom' && !label.trim())"
          >Pievienot atribūtu</v-btn
        >
      </form>
    </details>
    <details v-if="document.analysis" class="review-sources">
      <summary>Papildu informācija</summary>
      <template v-for="field in fields.filter((field) => field.evidence)" :key="field.key"
        ><p>
          <strong>{{ field.label }}</strong> · {{ field.page }}. lapa
        </p>
        <p>{{ field.evidence }}</p></template
      >
      <p v-if="document.analysis.result.usage" class="small-muted">
        API patēriņš: ievade {{ document.analysis.result.usage.input_tokens ?? '—' }}, izvade
        {{ document.analysis.result.usage.output_tokens ?? '—' }}, kopā
        {{ document.analysis.result.usage.total_tokens ?? '—' }} tokeni.
      </p>
    </details>
  </section>
</template>
<style>
.document-information {
  scroll-margin-top: 88px;
}
.compact-attributes {
  margin: 16px 0;
  border: 1px solid var(--border);
  border-radius: 18px;
  overflow: hidden;
  background: rgb(var(--v-theme-surface));
}
.compact-attribute {
  display: grid;
  grid-template-columns: minmax(85px, 0.8fr) minmax(0, 1.2fr);
  gap: 8px;
  align-items: center;
  padding: 12px;
  border-bottom: 1px solid var(--border);
}
.compact-attribute:last-child {
  border-bottom: 0;
}
.compact-attribute dt {
  color: var(--muted);
  font-size: 12px;
}
.compact-attribute dd {
  display: flex;
  gap: 6px;
  align-items: center;
  justify-content: space-between;

  margin: 0;
  font-size: 14px;
  font-weight: 600;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
.compact-attribute .field-error,
.inline-attribute-editor {
  grid-column: 1 / -1;
}
.inline-attribute-editor input {
  width: 100%;
  min-width: 0;
}
.inline-attribute-editor .status-chip,
.inline-attribute-editor .field-feedback {
  display: none;
}
.inline-edit-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 10px;
}
.review-extra,
.review-sources {
  margin-top: 16px;
}
.review-extra summary,
.review-sources summary {
  min-height: 44px;
  padding: 12px 0;
  cursor: pointer;
}
.compact-attribute dd > span {
  min-width: 0;
  overflow-wrap: anywhere;
}
.compact-attribute dd > button {
  flex-shrink: 0;
}
.compact-attribute.editing dt,
.compact-attribute.editing dd {
  grid-column: 1/-1;
}
.compact-attribute.editing dd {
  display: block;
}
</style>
