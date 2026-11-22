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
          <template v-if="editing !== field.key || readOnly">
            <div class="attribute-value">
              <span>{{ displayValue(field) }}</span
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
            </div>
            <p v-if="errors.includes(field.key) && !readOnly" class="field-error" role="alert">
              {{ t('grouping.invalidValue') }}
            </p>
          </template>
          <div v-else class="inline-attribute-editor">
            <label v-if="field.custom"
              >Lauka nosaukums<textarea
                :value="field.label"
                rows="1"
                maxlength="100"
                :disabled="disabled"
                @change="emit('rename', field.key, $event.target.value)"
              />
            </label>
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
          >Atribūta nosaukums<textarea
            v-model="label"
            rows="1"
            maxlength="100"
            :disabled="disabled"
          />
        </label>
        <label
          >Atribūta vērtība<textarea
            v-model="value"
            rows="1"
            maxlength="2000"
            :disabled="disabled"
          />
        </label>
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
      <div
        v-for="field in fields.filter((field) => field.evidence)"
        :key="field.key"
        class="review-source"
      >
        <p>
          <strong>{{ field.label }}</strong
          ><span v-if="field.page"> · {{ field.page }}. lapa</span>
        </p>
        <p class="attribute-evidence">{{ field.evidence }}</p>
      </div>
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
  container-type: inline-size;
  scroll-margin-top: 88px;
  overflow-wrap: anywhere;
}
.compact-attributes {
  margin: 16px 0;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: rgb(var(--v-theme-surface));
}
.compact-attribute {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
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
  font-size: var(--text-small);
}
.compact-attribute dd {
  min-width: 0;
  margin: 0;
}
.attribute-value {
  display: flex;
  gap: 6px;
  align-items: center;
  justify-content: space-between;
  font-size: var(--text-label);
  font-weight: 600;
}
.attribute-value > span {
  min-width: 0;
  white-space: pre-wrap;
}
.document-information textarea {
  field-sizing: content;
  resize: vertical;
  max-height: max(8rem, 45dvh);
}
.inline-attribute-editor .status-chip,
.inline-attribute-editor .field-feedback {
  display: none;
}
.inline-edit-actions {
  display: flex;
  flex-wrap: wrap;
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
.review-source {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-8);
  padding: var(--space-12);
  margin-bottom: var(--space-8);
  background: var(--soft);
  border-radius: var(--radius-control);
}
.compact-attribute.editing {
  grid-template-columns: minmax(0, 1fr);
}
@container (max-width: 24rem) {
  .compact-attribute {
    grid-template-columns: minmax(0, 1fr);
    gap: 0;
  }
}
</style>
