import { ALL_FIELDS } from './catalog.js'
import { reviewValues } from './model.js'
import grouping from '../../locales/grouping.lv.js'
export function documentTitle(document, index = 0) {
  return (
    document.values.document_title ||
    [
      document.values.document_type !== 'unknown'
        ? grouping.types[document.values.document_type]
        : null,
      document.values.document_number ||
        document.values.invoice_number ||
        document.values.contract_number,
    ]
      .filter(Boolean)
      .join(' · ') ||
    'Dokuments ' + (index + 1)
  )
}
export function attributeFields(document, { suggestions = false } = {}) {
  const values = suggestions ? reviewValues(document) : document.values
  const preferred = [
    'document_type',
    'document_number',
    'invoice_number',
    'contract_number',
    'sender',
    'recipient',
    'issue_date',
    'total_amount',
    'currency',
  ]
  const keys = [
    ...new Set([
      ...preferred,
      ...Object.keys(values),
      ...(document.dynamicAttributes || []).map((field) => field.key),
      ...(document.editedFields || []),
    ]),
  ]
  return keys
    .filter(
      (key) =>
        (ALL_FIELDS.includes(key) || document.customFields.some((field) => field.key === key)) &&
        (key === 'document_type' ||
          (values[key] !== null && values[key] !== undefined && values[key] !== '') ||
          document.editedFields?.includes(key)),
    )
    .map((key) => ({
      ...document.dynamicAttributes?.find((field) => field.key === key),
      key,
      value: values[key] ?? null,
      label:
        document.customFields.find((field) => field.key === key)?.label ||
        grouping.fields[key] ||
        key,
      custom: document.customFields.some((field) => field.key === key),
    }))
}
export function displayValue(field) {
  if (field.value == null || field.value === '') return 'Nav norādīts'
  return field.key === 'document_type' ? grouping.types[field.value] || field.value : field.value
}
