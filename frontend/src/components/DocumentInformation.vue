<script setup>
import { computed, ref } from 'vue'
import DocumentAttributeField from './DocumentAttributeField.vue'
import { COMMON_FIELDS, TYPE_FIELDS } from '../features/documents/catalog.js'
import {
  isAnalysisStale,
  isConfirmationCurrent,
  validationErrors,
} from '../features/documents/model.js'
import { t, dateTime } from '../locales'
const props = defineProps({
  document: Object,
  session: Object,
  disabled: Boolean,
  managed: Boolean,
})
const emit = defineEmits(['value', 'analyze', 'confirm', 'custom'])
const label = ref(''),
  value = ref('')
const stale = computed(() => isAnalysisStale(props.session, props.document))
const confirmed = computed(() => isConfirmationCurrent(props.session, props.document))
const errors = computed(() => validationErrors(props.document))
const common = COMMON_FIELDS.map((key) => ({ key, label: t(`grouping.fields.${key}`) }))
const extra = computed(() => {
  const type = props.document.values.document_type,
    suggested = props.document.analysis?.result.document_type
  const filled = Object.keys(props.document.values).filter(
    (key) => props.document.values[key] !== null && !key.startsWith('custom_'),
  )
  return [...new Set([...(TYPE_FIELDS[type] || []), ...(TYPE_FIELDS[suggested] || []), ...filled])]
    .filter((key) => !COMMON_FIELDS.includes(key))
    .map((key) => ({ key, label: t(`grouping.fields.${key}`) }))
    .concat(props.document.customFields)
})
function addField() {
  if (!label.value.trim()) return
  emit('custom', label.value, value.value)
  label.value = value.value = ''
}
function display(key, value) {
  return value === null || value === undefined
    ? t('workflow.notFound')
    : key === 'document_type'
      ? t(`grouping.types.${value}`)
      : value
}
</script>
<template>
  <section
    class="document-information"
    data-testid="document-information"
    tabindex="-1"
    :aria-label="t('grouping.information')"
  >
    <h3>{{ t('grouping.information') }}</h3>
    <p v-if="stale" class="ocr-warning" role="status">{{ t('grouping.stale') }}</p>
    <p v-if="document.confirmation" class="review-status" role="status">
      {{ t(confirmed ? 'grouping.confirmed' : 'grouping.confirmationChanged') }} ·
      {{ dateTime(document.confirmation.confirmedAt) }}
    </p>
    <div v-if="!managed" class="group-actions">
      <v-btn
        variant="tonal"
        :disabled="disabled || !document.pageIds.length"
        @click="emit('analyze')"
        >{{ t('workflow.recognize') }}</v-btn
      ><v-btn
        color="primary"
        :disabled="disabled || !document.pageIds.length || errors.length > 0"
        @click="emit('confirm')"
        >{{ t('grouping.confirm') }}</v-btn
      >
    </div>
    <div class="document-form-grid">
      <DocumentAttributeField
        v-for="field in common"
        :key="field.key"
        :field="field"
        :document="document"
        :disabled="disabled"
        :stale="stale"
        :confirmed="confirmed"
        :errors="errors"
        @value="(key, value) => emit('value', key, value)"
      />
    </div>
    <details class="review-extra">
      <summary>{{ t('workflow.moreFields') }}</summary>
      <div class="document-form-grid">
        <DocumentAttributeField
          v-for="field in extra"
          :key="field.key"
          :field="field"
          :document="document"
          :disabled="disabled"
          :stale="stale"
          :confirmed="confirmed"
          :errors="errors"
          @value="(key, value) => emit('value', key, value)"
        />
      </div>
      <form class="custom-field-form" @submit.prevent="addField">
        <h4>{{ t('grouping.customTitle') }}</h4>
        <label
          >{{ t('grouping.customLabel')
          }}<input v-model="label" maxlength="100" :disabled="disabled" /></label
        ><label
          >{{ t('grouping.customValue')
          }}<input v-model="value" maxlength="2000" :disabled="disabled" /></label
        ><v-btn type="submit" variant="tonal" :disabled="disabled || !label.trim()">{{
          t('grouping.addAttribute')
        }}</v-btn>
      </form>
    </details>
    <details class="review-sources">
      <summary>{{ t('workflow.analysisDetails') }}</summary>
      <template v-if="document.analysis"
        ><p class="small-muted">
          {{ t('grouping.analyzedAt') }} {{ dateTime(document.analysis.analyzedAt) }}
        </p>
        <ul class="analysis-warnings">
          <li v-for="warning in document.analysis.result.warnings" :key="warning">
            {{ t(`grouping.warnings.${warning}`) }}
          </li>
        </ul>
        <details
          v-for="field in [...common, ...extra].filter(
            (field) => document.analysis.result.evidence[field.key]?.length,
          )"
          :key="field.key"
        >
          <summary>{{ field.label }} · {{ t('grouping.evidence') }}</summary>
          <p
            v-for="(source, index) in document.analysis.result.evidence[field.key]"
            :key="index"
            class="attribute-evidence"
          >
            {{ t('scan.pageNumber', { number: source.page }) }}: {{ source.text }}
          </p>
        </details></template
      ><v-btn
        variant="text"
        :disabled="disabled || !document.pageIds.length"
        @click="emit('analyze')"
        >{{ t('grouping.analyze') }}</v-btn
      >
      <details v-if="document.confirmation" class="confirmation-history">
        <summary>{{ t('grouping.lastConfirmation') }}</summary>
        <dl>
          <template v-for="field in [...common, ...extra]" :key="field.key"
            ><dt>{{ field.label }}</dt>
            <dd>{{ display(field.key, document.confirmation.values[field.key]) }}</dd></template
          >
        </dl>
      </details>
    </details>
  </section>
</template>
