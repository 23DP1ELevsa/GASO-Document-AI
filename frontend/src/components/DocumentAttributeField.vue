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
function normalize(event) {
  if (money.value) {
    const value = normalizeAmount(event.target.value)
    if (value !== null) emit('value', props.field.key, value)
  }
}
</script>
<template>
  <div class="document-field" :class="{ 'field-confirmed': confirmed }">
    <label :for="id">{{ field.label }}</label>
    <select
      v-if="field.key === 'document_type'"
      :id="id"
      :value="document.values[field.key]"
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
      :value="document.values[field.key] ?? ''"
      :disabled="disabled"
      :type="field.key.endsWith('_date') || field.key.startsWith('coverage_') ? 'date' : 'text'"
      :inputmode="money ? 'decimal' : 'text'"
      :placeholder="money ? '0,00' : ''"
      maxlength="2000"
      :aria-invalid="errors.includes(field.key)"
      :aria-describedby="errors.includes(field.key) ? `${id}-error` : undefined"
      @input="emit('value', field.key, $event.target.value)"
      @blur="normalize"
    />
    <p v-if="errors.includes(field.key)" :id="`${id}-error`" class="field-error">
      {{ t('grouping.invalidValue') }}
    </p>
    <div class="field-feedback">
      <span v-if="confirmed" class="field-status verified">{{ t('workflow.confirmed') }}</span
      ><template v-else-if="suggestion !== null && !stale"
        ><span class="field-status">{{ t('workflow.suggested') }}</span
        ><span class="field-suggestion-value">{{ display }}</span
        ><v-btn
          size="small"
          color="primary"
          variant="text"
          :disabled="disabled"
          :aria-label="t('grouping.useField', { field: field.label })"
          @click="emit('value', field.key, suggestion)"
          >{{ t('grouping.use') }}</v-btn
        ></template
      ><span v-else class="field-status">{{
        t(
          document.values[field.key] !== null && document.values[field.key] !== 'unknown'
            ? 'workflow.check'
            : 'workflow.notFound',
        )
      }}</span>
    </div>
  </div>
</template>
