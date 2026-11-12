<script setup>
import { computed, ref } from 'vue'
import { COMMON_FIELDS, TYPE_FIELDS, DOCUMENT_TYPES } from '../features/documents/catalog.js'
import {
  isAnalysisStale,
  isConfirmationCurrent,
  validationErrors,
} from '../features/documents/model.js'
import { t, dateTime } from '../locales'

const props = defineProps({ document: Object, session: Object, disabled: Boolean })
const emit = defineEmits(['value', 'analyze', 'confirm', 'custom'])
const label = ref(''),
  value = ref('')
const stale = computed(() => isAnalysisStale(props.session, props.document))
const confirmed = computed(() => isConfirmationCurrent(props.session, props.document))
const errors = computed(() => validationErrors(props.document))
const fields = computed(() => {
  const type = props.document.values.document_type
  const suggestedType = props.document.analysis?.result.document_type
  const extraKeys = Object.keys(props.document.values).filter(
    (key) => props.document.values[key] !== null && !key.startsWith('custom_'),
  )
  return [
    ...new Set([
      ...COMMON_FIELDS,
      ...(TYPE_FIELDS[type] || []),
      ...(TYPE_FIELDS[suggestedType] || []),
      ...extraKeys,
    ]),
  ]
    .map((key) => ({ key, label: t(`grouping.fields.${key}`) }))
    .concat(props.document.customFields)
})
function suggestion(key) {
  const result = props.document.analysis?.result
  return key === 'document_type'
    ? (result?.document_type ?? null)
    : (result?.attributes[key] ?? null)
}
function display(key, value) {
  return value === null
    ? t('grouping.notFound')
    : key === 'document_type'
      ? t(`grouping.types.${value}`)
      : value
}
function addField() {
  if (!label.value.trim()) return
  emit('custom', label.value, value.value)
  label.value = value.value = ''
}
</script>
<template>
  <section
    class="document-information"
    data-testid="document-information"
    :aria-label="t('grouping.information')"
  >
    <h4>{{ t('grouping.information') }}</h4>
    <p class="small-muted">{{ t('grouping.reviewHint') }}</p>
    <p v-if="stale" class="ocr-warning" role="status">{{ t('grouping.stale') }}</p>
    <p v-if="document.confirmation" class="small-muted" role="status">
      {{ t(confirmed ? 'grouping.confirmed' : 'grouping.confirmationChanged') }} ·
      {{ dateTime(document.confirmation.confirmedAt) }}
    </p>
    <div class="group-actions">
      <v-btn
        color="primary"
        variant="tonal"
        :disabled="disabled || !document.pageIds.length"
        @click="emit('analyze')"
        >{{ t('grouping.analyze') }}</v-btn
      >
      <v-btn
        color="primary"
        :disabled="disabled || !document.pageIds.length || errors.length > 0"
        @click="emit('confirm')"
        >{{ t('grouping.confirm') }}</v-btn
      >
    </div>
    <p v-if="document.analysis" class="small-muted">
      {{ t('grouping.analyzedAt') }} {{ dateTime(document.analysis.analyzedAt) }}
    </p>
    <ul v-if="document.analysis?.result.warnings.length" class="analysis-warnings">
      <li v-for="warning in document.analysis.result.warnings" :key="warning">
        {{ t(`grouping.warnings.${warning}`) }}
      </li>
    </ul>
    <table class="attribute-table">
      <caption class="sr-only">
        {{
          t('grouping.information')
        }}
      </caption>
      <thead>
        <tr>
          <th scope="col">{{ t('grouping.attribute') }}</th>
          <th scope="col">{{ t('grouping.userValue') }}</th>
          <th scope="col">{{ t('grouping.suggestion') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="field in fields" :key="field.key">
          <th scope="row">{{ field.label }}</th>
          <td>
            <label class="sr-only" :for="`${document.id}-${field.key}`">{{ field.label }}</label>
            <select
              v-if="field.key === 'document_type'"
              :id="`${document.id}-${field.key}`"
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
              :id="`${document.id}-${field.key}`"
              :value="document.values[field.key] ?? ''"
              :disabled="disabled"
              :type="
                field.key.endsWith('_date') || field.key.startsWith('coverage_') ? 'date' : 'text'
              "
              :inputmode="
                field.key.endsWith('_amount') || field.key === 'balance_due' ? 'decimal' : 'text'
              "
              :placeholder="
                field.key.endsWith('_amount') || field.key === 'balance_due' ? '0.00' : ''
              "
              maxlength="2000"
              :aria-invalid="errors.includes(field.key)"
              @input="emit('value', field.key, $event.target.value)"
            />
            <p v-if="errors.includes(field.key)" class="field-error">
              {{ t('grouping.invalidValue') }}
            </p>
          </td>
          <td class="attribute-suggestion">
            <span class="mobile-suggestion-label">{{ t('grouping.suggestion') }}</span>
            <span>{{ display(field.key, suggestion(field.key)) }}</span>
            <v-btn
              v-if="suggestion(field.key) !== null"
              size="small"
              variant="text"
              color="primary"
              :disabled="disabled || stale"
              :aria-label="t('grouping.useField', { field: field.label })"
              @click="emit('value', field.key, suggestion(field.key))"
              >{{ t('grouping.use') }}</v-btn
            >
            <details v-if="document.analysis?.result.evidence[field.key]?.length">
              <summary>{{ t('grouping.evidence') }}</summary>
              <p
                v-for="(source, index) in document.analysis.result.evidence[field.key]"
                :key="index"
                class="attribute-evidence"
              >
                {{ t('scan.pageNumber', { number: source.page }) }}: {{ source.text }}
              </p>
            </details>
          </td>
        </tr>
      </tbody>
    </table>
    <form class="custom-field-form" @submit.prevent="addField">
      <h5>{{ t('grouping.customTitle') }}</h5>
      <label
        >{{ t('grouping.customLabel') }}<input v-model="label" maxlength="100" :disabled="disabled"
      /></label>
      <label
        >{{ t('grouping.customValue')
        }}<input v-model="value" maxlength="2000" :disabled="disabled"
      /></label>
      <v-btn type="submit" variant="tonal" :disabled="disabled || !label.trim()">{{
        t('grouping.addAttribute')
      }}</v-btn>
    </form>
    <details v-if="document.confirmation" class="confirmation-history">
      <summary>{{ t('grouping.lastConfirmation') }}</summary>
      <dl>
        <template v-for="field in fields" :key="field.key"
          ><dt>{{ field.label }}</dt>
          <dd>
            {{ display(field.key, document.confirmation.values[field.key] ?? null) }}
          </dd></template
        >
      </dl>
    </details>
    <p class="small-muted">{{ t('grouping.saveHint') }}</p>
  </section>
</template>
