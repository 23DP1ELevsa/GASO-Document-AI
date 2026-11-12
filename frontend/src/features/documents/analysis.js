import { isOcrStale, textForPage } from '../ocr/model.js'
import { emptyValues } from './catalog.js'

export function normalizeDate(raw) {
  let value = raw.trim().replace(/\.$/, '')
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(value)) value = value.split('.').reverse().join('-')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null
}

export function normalizeAmount(raw) {
  let value = raw.trim().replace(/[\u00a0\u202f]/g, ' ')
  if (/^-?\d{1,3}(?: \d{3})+(?:[.,]\d{2})?$/.test(value)) value = value.replaceAll(' ', '')
  if (/^-?\d{1,3}(?:,\d{3})+\.\d{2}$/.test(value)) value = value.replaceAll(',', '')
  else if (/^-?\d{1,3}(?:\.\d{3})+,\d{2}$/.test(value)) value = value.replaceAll('.', '')
  if (!/^-?\d+(?:[.,]\d{2})?$/.test(value)) return null
  const [integer, decimal = '00'] = value.replace(',', '.').split('.')
  return `${integer.replace(/^(-?)0+(?=\d)/, '$1')}.${decimal}`
}

const labels = {
  invoice_number: '(?:rēķina\\s*(?:nr\\.?|numurs)|invoice\\s*(?:no\\.?|number)|номер\\s*сч[её]та)',
  contract_number: '(?:līguma\\s*(?:nr\\.?|numurs)|contract\\s*(?:no\\.?|number)|номер договора)',
  policy_number: '(?:polises\\s*(?:nr\\.?|numurs)|policy\\s*(?:no\\.?|number)|номер полиса)',
  delivery_note_number:
    '(?:pavadzīmes\\s*(?:nr\\.?|numurs)|delivery note\\s*(?:no\\.?|number)|номер накладной)',
  document_number:
    '(?:dokumenta\\s*(?:nr\\.?|numurs)|document\\s*(?:no\\.?|number)|номер документа)',
  document_title: '(?:dokumenta nosaukums|document title|название документа)',
  issue_date:
    '(?:izdošanas datums|izrakstīšanas datums|rēķina datums|datums|invoice date|issue date|дата сч[её]та|дата документа)',
  due_date: '(?:apmaksas termiņš|samaksas termiņš|due date|payment due|срок оплаты)',
  sender: '(?:nosūtītājs|pārdevējs|izrakstītājs|seller|supplier|sender|продавец|отправитель)',
  recipient: '(?:pircējs|saņēmējs|adresāts|buyer|bill to|recipient|покупатель|получатель)',
  subtotal_amount: '(?:summa bez pvn|kopā bez pvn|subtotal|net total|сумма без ндс)',
  tax_amount: '(?:pvn summa|vat amount|tax amount|сумма ндс)',
  total_amount:
    '(?:kopā apmaksai|summa apmaksai|grand total|total amount|итого к оплате|общая сумма)',
  invoice_gross_amount: '(?:kopā ar pvn|summa ar pvn|gross total|total including vat|сумма с ндс)',
  paid_amount: '(?:samaksāts|jau samaksāts|paid amount|amount paid|оплачено)',
  balance_due: '(?:atlikusī summa|atlikums apmaksai|balance due|amount due|остаток к оплате)',
  currency: '(?:valūta|currency|валюта)',
  effective_date: '(?:spēkā stāšanās datums|effective date|дата вступления в силу)',
  expiry_date: '(?:beigu datums|expiry date|дата окончания)',
  parties: '(?:līguma puses|contract parties|стороны договора)',
  applicant: '(?:iesniedzējs|applicant|заявитель)',
  application_date: '(?:iesnieguma datums|application date|дата заявления)',
  subject: '(?:priekšmets|tēma|subject|предмет)',
  insured_party: '(?:apdrošinātais|insured party|страхователь)',
  coverage_start: '(?:seguma sākums|coverage start)',
  coverage_end: '(?:seguma beigas|coverage end)',
  delivery_date: '(?:piegādes datums|delivery date|дата доставки)',
  shipper: '(?:preču nosūtītājs|shipper)',
  consignee: '(?:preču saņēmējs|consignee)',
}
const matchers = Object.entries(labels).map(([key, label]) => [
  key,
  new RegExp(`^${label}\\s*(?::\\s*|\\s+)(.*)$`, 'iu'),
])
const headings = {
  invoice:
    /^(?:rēķins|invoice|сч[её]т(?:-фактура)?)(?:\s+(?:nr\.?|no\.?|number|№)\s*([\p{L}\d./-]+))?$/iu,
  contract: /^(?:līgums|contract|договор)(?:\s+(?:nr\.?|no\.?|number|№)\s*([\p{L}\d./-]+))?$/iu,
  application: /^(?:iesniegums|application|заявление)$/iu,
  insurance_document: /^(?:apdrošināšanas polise|insurance policy|страховой полис)$/iu,
  delivery_note:
    /^(?:pavadzīme|delivery note|накладная)(?:\s+(?:nr\.?|no\.?|number|№)\s*([\p{L}\d./-]+))?$/iu,
}
const typeNumbers = {
  invoice: 'invoice_number',
  contract: 'contract_number',
  insurance_document: 'policy_number',
  delivery_note: 'delivery_note_number',
}
const currencyCode = (raw) => {
  const value = raw.toUpperCase().replace('€', 'EUR')
  return ['EUR', 'USD', 'GBP', 'RUB', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN'].includes(value)
    ? value
    : null
}
function money(raw) {
  const match = raw.match(/^(?:([A-Z]{3}|€)\s*)?(-?[\d .,\u00a0\u202f]+?)(?:\s*([A-Z]{3}|€))?$/iu)
  if (!match) return { value: null, currencies: [] }
  const currencies = [match[1], match[3]].filter(Boolean).map(currencyCode)
  return {
    value:
      new Set(currencies).size > 1 || currencies.includes(null) ? null : normalizeAmount(match[2]),
    currencies,
  }
}

// A replaceable local provider: receives only ordered pages, never filenames, network or templates.
export function analyzePages(pages) {
  const candidates = {},
    evidence = {},
    headingSources = {},
    warnings = []
  function add(key, value, source) {
    ;(candidates[key] ||= []).push(value)
    ;(evidence[key] ||= []).push(source)
  }
  pages.forEach((page, index) => {
    if (!page.ocr || !textForPage(page).trim()) warnings.push('missing_ocr')
    if (isOcrStale(page)) {
      warnings.push('stale_ocr')
      return // Never derive fresh suggestions from obsolete OCR.
    }
    for (const line of textForPage(page).split(/\r?\n/)) {
      const text = line.trim()
      const source = { pageId: page.id, page: index + 1, text }
      for (const [type, regex] of Object.entries(headings)) {
        const match = text.match(regex)
        if (!match) continue
        ;(headingSources[type] ||= []).push(source)
        if (match[1]) add(typeNumbers[type], match[1], source)
      }
      for (const [key, regex] of matchers) {
        const match = text.match(regex)
        if (!match) continue
        const raw = match[1].trim()
        let value = raw || null
        if (key.endsWith('_amount') || key === 'balance_due') {
          const parsed = money(raw)
          value = parsed.value
          for (const currency of parsed.currencies) add('currency', currency, source)
        } else if (key.endsWith('_date') || key.startsWith('coverage_')) value = normalizeDate(raw)
        else if (key === 'currency') value = currencyCode(raw)
        else if (key.endsWith('_number')) value = /^[\p{L}\d./-]{1,80}$/u.test(raw) ? raw : null
        add(key, value, source)
      }
    }
  })
  const attributes = emptyValues()
  delete attributes.document_type
  for (const [key, values] of Object.entries(candidates)) {
    const unique = new Set(values)
    attributes[key] = unique.size === 1 && !unique.has(null) ? values[0] : null
    if (attributes[key] === null) warnings.push('ambiguous_attribute')
  }
  const supported = Object.keys(headingSources).filter((type) => {
    if (typeNumbers[type])
      return (
        attributes[typeNumbers[type]] !== null ||
        (type === 'invoice' && attributes.total_amount !== null && attributes.due_date !== null) ||
        (type === 'contract' && (attributes.parties !== null || attributes.effective_date !== null))
      )
    return type === 'application' && attributes.applicant !== null && attributes.recipient !== null
  })
  const document_type =
    supported.length === 1 && Object.keys(headingSources).length === 1 ? supported[0] : 'unknown'
  evidence.document_type = Object.values(headingSources).flat()
  const numberKey = typeNumbers[document_type]
  if (numberKey) {
    const number = attributes[numberKey]
    if (candidates.document_number && attributes.document_number !== number) {
      attributes.document_number = null
      warnings.push('ambiguous_attribute')
    } else {
      attributes.document_number = number
      evidence.document_number = evidence[numberKey] || []
    }
  }
  if (document_type === 'unknown') warnings.push('unknown_type')
  return {
    version: 1,
    provider: 'local_rules',
    document_type,
    attributes,
    evidence,
    requires_review: true,
    warnings: [...new Set(warnings)],
  }
}

// Suggestions only. A repeated heading/number is never a boundary on its own.
export function suggestBoundaries(pages) {
  const suggestions = []
  let previous = null
  pages.forEach((page, index) => {
    if (isOcrStale(page)) {
      previous = null
      return
    }
    const firstLines = textForPage(page)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 4)
    const result = analyzePages([page])
    const number = result.attributes.invoice_number
    if (
      result.document_type !== 'invoice' ||
      !number ||
      !firstLines.some((line) => headings.invoice.test(line))
    )
      return
    if (previous && previous.number !== number)
      suggestions.push({
        pageId: page.id,
        index,
        previousNumber: previous.number,
        nextNumber: number,
      })
    previous = { number }
  })
  return suggestions
}
