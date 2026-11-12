// Keep keys aligned with docs/requirements/document-{types,attributes}.md.
export const DOCUMENT_TYPES = [
  'unknown',
  'invoice',
  'contract',
  'application',
  'insurance_document',
  'delivery_note',
  'other',
]
export const COMMON_FIELDS = [
  'document_type',
  'document_title',
  'document_number',
  'sender',
  'recipient',
  'issue_date',
  'due_date',
  'total_amount',
  'currency',
]
export const TYPE_FIELDS = {
  invoice: [
    'invoice_number',
    'subtotal_amount',
    'tax_amount',
    'invoice_gross_amount',
    'paid_amount',
    'balance_due',
  ],
  contract: ['contract_number', 'parties', 'effective_date', 'expiry_date', 'subject'],
  application: ['applicant', 'application_date', 'subject'],
  insurance_document: ['policy_number', 'insured_party', 'coverage_start', 'coverage_end'],
  delivery_note: ['delivery_note_number', 'delivery_date', 'shipper', 'consignee'],
}
export const ALL_FIELDS = [...new Set([...COMMON_FIELDS, ...Object.values(TYPE_FIELDS).flat()])]
export function emptyValues() {
  return Object.fromEntries(
    ALL_FIELDS.map((key) => [key, key === 'document_type' ? 'unknown' : null]),
  )
}
