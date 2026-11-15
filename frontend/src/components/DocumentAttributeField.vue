<script setup>
import { computed } from 'vue'
import { DOCUMENT_TYPES } from '../features/documents/catalog.js'
import { normalizeAmount } from '../features/documents/analysis.js'
import { t } from '../locales'
const props = defineProps({
  field: Object,
  document: Object,
  disabled: Boolean,
  stale: Boolean,
  confirmed: Boolean,
  errors: Array,
})
const emit = defineEmits(['value'])
const id = computed(() => `${props.document.id}-${props.field.key}`)
const suggestion = computed(() => {
  const result = props.document.analysis?.result
  const value =
    props.field.key === 'document_type'
      ? result?.document_type
      : result?.attributes[props.field.key]
  return value === undefined || value === 'unknown' ? null : value
})
const display = computed(() =>
  props.field.key === 'document_type' ? t(`grouping.types.${suggestion.value}`) : suggestion.value,
)
const money = computed(
  () => props.field.key.endsWith('_amount') || props.field.key === 'balance_due',
)
const currentValue = computed(() => props.document.values[props.field.key])
const filled = computed(
  () =>
    currentValue.value !== null &&
    currentValue.value !== undefined &&
    currentValue.value !== '' &&
    currentValue.value !== 'unknown',
)
const shownValue = computed(() =>
  filled.value
    ? currentValue.value
    : !props.stale && !props.document.editedFields?.includes(props.field.key)
      ? suggestion.value
      : null,
)
const checked = computed(() => filled.value && (props.confirmed || !props.stale))
const sources = computed(() => props.document.analysis?.result.evidence[props.field.key] || [])
function normalize(event) {
  if (money.value && filled.value) {
    const value = normalizeAmount(event.target.value)
    if (value !== null) emit('value', props.field.key, value)
  }
}
</script>
<template>
  <div
    class="document-field"
    :class="{ 'field-confirmed': checked, 'field-check': !filled && suggestion !== null && !stale }"
  >
    <div class="field-card-heading">
      <label :for="id">{{ field.label }}</label>
      <span
        class="status-chip"
        :class="{ 'status-success': checked, 'status-muted': !shownValue }"
        >{{ checked ? 'Pārbaudīts' : shownValue ? 'Pārbaudiet' : 'Nav atrasts' }}</span
      >
    </div>
    <select
      v-if="field.key === 'document_type'"
      :id="id"
      :value="shownValue || 'unknown'"
      :disabled="disabled"
      @change="emit('value', field.key, $event.target.value)"
    >
      <option v-for="type in DOCUMENT_TYPES" :key="type" :value="type">
        {{ t(`grouping.types.${type}`) }}
      </option>
    </select>
    <input
      v-else
      :id="id"
      :value="shownValue ?? ''"
      :disabled="disabled"
      :type="field.key.endsWith('_date') || field.key.startsWith('coverage_') ? 'date' : 'text'"
      :inputmode="money ? 'decimal' : 'text'"
      :placeholder="money ? '0,00' : 'Nav atrasts — ievadiet'"
      maxlength="2000"
      :aria-invalid="errors.includes(field.key)"
      :aria-describedby="errors.includes(field.key) ? `${id}-error` : undefined"
      @input="emit('value', field.key, $event.target.value)"
      enterkeyhint="next"
      @blur="normalize"
    />
    <p v-if="errors.includes(field.key)" :id="`${id}-error`" class="field-error">
      {{ t('grouping.invalidValue') }}
    </p>
    <div class="field-feedback">
      <template
        v-if="
          suggestion !== null && !stale && !filled && !document.editedFields?.includes(field.key)
        "
        ><span class="field-suggestion-value">{{ display }}</span
        ><v-btn
          size="small"
          color="primary"
          variant="text"
          :disabled="disabled"
          :aria-label="t('grouping.useField', { field: field.label })"
          @click="emit('value', field.key, suggestion)"
          >Pareizi</v-btn
        ></template
      >
    </div>
    <details v-if="sources.length" class="field-source">
      <summary>Datu avots</summary>
      <p v-for="(source, index) in sources" :key="index">
        {{ source.page }}. lapa · {{ source.text }}
      </p>
    </details>
  </div>
</template>
