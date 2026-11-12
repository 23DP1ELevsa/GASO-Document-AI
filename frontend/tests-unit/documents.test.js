import test from 'node:test'
import assert from 'node:assert/strict'
import { makeOcrResult } from '../src/features/ocr/model.js'
import { defaultProcessing } from '../src/features/processing/geometry.js'
import {
  analyzePages,
  normalizeAmount,
  normalizeDate,
  suggestBoundaries,
} from '../src/features/documents/analysis.js'
import {
  migrateGrouping,
  createDocument,
  assignPages,
  reorderPage,
  mergeDocuments,
  splitDocument,
  deleteDocument,
  validateDocuments,
  documentPages,
  unassignedPages,
  editValue,
  addCustomField,
  confirmDocument,
  isConfirmationCurrent,
  sourceVersion,
  isAnalysisStale,
  updateDocument,
  replacePageReference,
  reconcilePages,
  validationErrors,
  documentExportPlan,
} from '../src/features/documents/model.js'

function page(id, text = '') {
  const result = { id, name: `${id}.png`, width: 900, height: 1200, thumbnail: new Blob(['thumb']) }
  return { ...result, ocr: makeOcrResult(result, ['lav'], { text }, 1, 100) }
}
function session() {
  return migrateGrouping({
    id: 'session',
    createdAt: 1,
    revision: 0,
    pages: ['a', 'b', 'c', 'd'].map((id) => page(id)),
  })
}
function analyzed(session, id) {
  return updateDocument(session, id, (document) => ({
    ...document,
    analysis: {
      source: sourceVersion(session, document),
      result: analyzePages(documentPages(session, document)),
    },
  }))
}

test('legacy migration preserves every image reference, order, original and corrected OCR without assuming ownership', () => {
  const original = new Blob(['original']),
    processed = new Blob(['processed'])
  const old = { id: 'old', pages: [{ ...page('a', 'OCR'), original, processed }], revision: 5 }
  old.pages[0].ocr.editedText = 'Labots'
  const migrated = migrateGrouping(old)
  assert.equal(migrated.pages, old.pages)
  assert.equal(migrated.pages[0].original, original)
  assert.equal(migrated.pages[0].processed, processed)
  assert.equal(migrated.pages[0].ocr.editedText, 'Labots')
  assert.equal(migrated.pages[0].ocr.originalText, 'OCR')
  assert.deepEqual(migrated.documents, [])
  assert.equal(unassignedPages(migrated).length, 1)
  assert.equal(migrateGrouping(migrated).schemaVersion, 2)
})
test('multiple groups have unique IDs and exclusive ownership; moves preserve their requested order', () => {
  let s = createDocument(session(), ['a', 'b'], 'Pirmais')
  s = createDocument(s, ['c'], 'Otrais')
  const [first, second] = s.documents.map((document) => document.id)
  assert.notEqual(first, second)
  assert.deepEqual(
    unassignedPages(s).map((p) => p.id),
    ['d'],
  )
  s = assignPages(s, ['b', 'd', 'b'], second)
  assert.deepEqual(s.documents[0].pageIds, ['a'])
  assert.deepEqual(s.documents[1].pageIds, ['c', 'b', 'd'])
  s = reorderPage(s, second, 'd', -1)
  assert.deepEqual(
    documentPages(s, s.documents[1]).map((p) => p.id),
    ['c', 'd', 'b'],
  )
  s = assignPages(s, ['a'], null)
  assert.deepEqual(
    unassignedPages(s).map((p) => p.id),
    ['a'],
  )
  assert.throws(() => assignPages(s, ['missing'], first))
  assert.throws(() => assignPages(s, ['a'], 'missing'))
  const duplicate = {
    ...s,
    documents: [...s.documents, { ...s.documents[0], id: 'other', pageIds: ['b'] }],
  }
  assert.throws(() => validateDocuments(duplicate))
  assert.throws(() => validateDocuments({ ...s, documents: [...s.documents, s.documents[0]] }))
})
test('splitting and merging keep pages and target attributes but never transfer another document’s values', () => {
  let s = createDocument(session(), ['a', 'b', 'c'])
  const first = s.documents[0].id
  s = editValue(s, first, 'sender', 'Pirmais nosūtītājs')
  s = confirmDocument(s, first)
  s = splitDocument(s, first, ['c', 'b'])
  const second = s.documents[1].id
  assert.deepEqual(s.documents[1].pageIds, ['b', 'c'])
  assert.equal(s.documents[1].values.sender, null)
  assert.equal(s.documents[1].confirmation, null)
  assert.equal(isConfirmationCurrent(s, s.documents[0]), false)
  s = editValue(s, second, 'sender', 'Otrais nosūtītājs')
  s = mergeDocuments(s, first, second)
  assert.equal(s.documents.length, 1)
  assert.deepEqual(s.documents[0].pageIds, ['a', 'b', 'c'])
  assert.equal(s.documents[0].values.sender, 'Pirmais nosūtītājs')
  assert.throws(() => mergeDocuments(s, first, first))
  assert.throws(() => splitDocument(s, first, ['a', 'b', 'c']))
  assert.throws(() => splitDocument(s, first, ['missing']))
})
test('deleting a group leaves all original pages and OCR available, including for the last group', () => {
  let s = createDocument(session(), ['a', 'b'])
  const pages = s.pages
  s = deleteDocument(s, s.documents[0].id)
  assert.equal(s.pages, pages)
  assert.equal(unassignedPages(s).length, 4)
  assert.equal(s.documents.length, 0)
})
test('analysis, manual edits, custom fields and confirmed snapshot are independent and serializable', () => {
  let s = createDocument(session(), ['a'])
  const id = s.documents[0].id
  s = editValue(s, id, 'document_type', 'invoice')
  s = editValue(s, id, 'document_number', '00012')
  s = editValue(s, id, 'total_amount', '12.34')
  s = addCustomField(s, id, 'Projekta kods', 'SYNTH-2026')
  s = confirmDocument(s, id)
  assert.equal(isConfirmationCurrent(s, s.documents[0]), true)
  const confirmation = s.documents[0].confirmation
  s = analyzed(s, id)
  assert.equal(s.documents[0].values.document_number, '00012')
  assert.equal(s.documents[0].confirmation, confirmation)
  assert.equal(isConfirmationCurrent(s, s.documents[0]), true)
  s = editValue(s, id, 'document_number', '00013')
  assert.equal(isConfirmationCurrent(s, s.documents[0]), false)
  assert.equal(s.documents[0].confirmation.values.document_number, '00012')
  const restored = migrateGrouping(JSON.parse(JSON.stringify(s)))
  assert.equal(
    restored.documents[0].values[restored.documents[0].customFields[0].key],
    'SYNTH-2026',
  )
  assert.equal(restored.documents[0].confirmation.values.document_number, '00012')
  assert.throws(() => editValue(s, id, '__proto__', 'bad'))
})
test('invalid manual dates, money and currency cannot be confirmed', () => {
  let s = createDocument(session(), ['a'])
  const id = s.documents[0].id
  for (const [key, value] of [
    ['issue_date', '2026-02-30'],
    ['total_amount', '1,234'],
    ['currency', '$'],
    ['document_type', 'bad'],
  ])
    s = editValue(s, id, key, value)
  assert.deepEqual(validationErrors(s.documents[0]).sort(), [
    'currency',
    'document_type',
    'issue_date',
    'total_amount',
  ])
  assert.throws(() => confirmDocument(s, id))
})

test('live attribute editing preserves spaces between words and clears only empty inputs', () => {
  let s = createDocument(session(), ['a'])
  const id = s.documents[0].id
  for (const text of ['S', 'SI', 'SIA', 'SIA ', 'SIA S', 'SIA Sintētisks uzņēmums']) {
    s = editValue(s, id, 'sender', text)
    assert.equal(s.documents[0].values.sender, text)
  }
  s = editValue(s, id, 'sender', '')
  assert.equal(s.documents[0].values.sender, null)
})
test('page composition, ordering, replacement, image processing, OCR edits and reruns invalidate provenance only for their own document', () => {
  let s = createDocument(session(), ['a', 'b'])
  s = createDocument(s, ['c'])
  for (const document of s.documents) {
    s = analyzed(s, document.id)
    s = confirmDocument(s, document.id)
  }
  const id = s.documents[0].id
  const variants = [
    assignPages(s, ['d'], id),
    assignPages(s, ['b'], null),
    reorderPage(s, id, 'b', -1),
    ...[
      { processing: { ...defaultProcessing(), rotation: 90 } },
      { ocr: { ...s.pages[0].ocr, editedText: 'Labots', editedAt: 200 } },
      { ocr: { ...s.pages[0].ocr, recognizedAt: 200 } },
      { contentRevision: 1 },
    ].map((change) => ({
      ...s,
      pages: s.pages.map((p) => (p.id === 'a' ? { ...p, ...change } : p)),
    })),
    replacePageReference(
      { ...s, pages: s.pages.map((p) => (p.id === 'a' ? page('replacement') : p)) },
      'a',
      'replacement',
    ),
    reconcilePages({ ...s, pages: s.pages.filter((p) => p.id !== 'a') }),
  ]
  for (const variant of variants) {
    assert.equal(isAnalysisStale(variant, variant.documents[0]), true)
    assert.equal(isConfirmationCurrent(variant, variant.documents[0]), false)
    assert.equal(isAnalysisStale(variant, variant.documents[1]), false)
    assert.equal(isConfirmationCurrent(variant, variant.documents[1]), true)
    assert.equal(variant.documents[0].confirmation, s.documents[0].confirmation)
  }
  const reorderedSession = { ...s, pages: [...s.pages].reverse() }
  assert.equal(isAnalysisStale(reorderedSession, reorderedSession.documents[0]), false)
})
test('PDF preparation describes ordered image references and structured information without copying blobs or generating PDFs', () => {
  let s = createDocument(session(), ['c', 'a'])
  const id = s.documents[0].id
  s = editValue(s, id, 'document_title', 'Dokuments')
  const plan = documentExportPlan(s, id)
  assert.deepEqual(plan.pages, [
    { pageId: 'c', imageRecordId: 'c' },
    { pageId: 'a', imageRecordId: 'a' },
  ])
  assert.equal(plan.information.document_title, 'Dokuments')
  assert.equal(plan.confirmed, false)
})

test('LV/EN/RU labels normalize synthetic invoices with page evidence and preserve leading zeros', () => {
  for (const [heading, number, date, total] of [
    ['Rēķins', 'Rēķina Nr.', 'Izdošanas datums', 'Kopā apmaksai'],
    ['Invoice', 'Invoice Number', 'Invoice date', 'Grand total'],
    ['Счёт', 'Номер счёта', 'Дата счёта', 'Итого к оплате'],
  ]) {
    const result = analyzePages([
      page('a', `${heading}\n${number}: 00012\n${date}: 10.11.2026\n${total}: 1 234,56 EUR`),
    ])
    assert.equal(result.document_type, 'invoice')
    assert.equal(result.attributes.invoice_number, '00012')
    assert.equal(result.attributes.document_number, '00012')
    assert.equal(result.attributes.issue_date, '2026-11-10')
    assert.equal(result.attributes.total_amount, '1234.56')
    assert.equal(result.attributes.currency, 'EUR')
    assert.equal(result.attributes.sender, null)
    assert.equal(result.requires_review, true)
    assert.equal(result.evidence.total_amount[0].pageId, 'a')
    assert.equal(result.evidence.total_amount[0].page, 1)
  }
})
test('reordered layouts and labeled counterparties work without filenames, coordinates or first-company guesses', () => {
  const lines = [
    'Invoice No. ABC-002',
    'Invoice',
    'Supplier: SIA Sintētiskais pārdevējs',
    'Bill to: SIA Sintētiskais pircējs',
    'Due date: 2026-12-01',
    'Grand total: EUR 1,234.56',
  ]
  for (const ordered of [lines, [...lines].reverse()]) {
    const result = analyzePages([
      page('a', `SIA Nepareizais pirmais uzņēmums\n${ordered.join('\n')}`),
    ])
    assert.equal(result.document_type, 'invoice')
    assert.equal(result.attributes.sender, 'SIA Sintētiskais pārdevējs')
    assert.equal(result.attributes.recipient, 'SIA Sintētiskais pircējs')
    assert.equal(result.attributes.due_date, '2026-12-01')
    assert.equal(result.attributes.total_amount, '1234.56')
  }
})
test('VAT, net, gross, paid, balance and unrelated large numbers never substitute for the explicit total', () => {
  const result = analyzePages([
    page(
      'a',
      'Invoice Nr. 123\nInvoice No.: 123\nSubtotal: 100.00\nVAT amount: 21.00\nGross total: 121.00\nPaid amount: 30.00\nBalance due: 91.00\nGrand total: 121.00 EUR\nReference: 99999999',
    ),
  ])
  assert.equal(result.attributes.total_amount, '121.00')
  assert.equal(result.attributes.subtotal_amount, '100.00')
  assert.equal(result.attributes.tax_amount, '21.00')
  assert.equal(result.attributes.invoice_gross_amount, '121.00')
  assert.equal(result.attributes.paid_amount, '30.00')
  assert.equal(result.attributes.balance_due, '91.00')
  const absent = analyzePages([
    page(
      'a',
      'Invoice\nVAT amount: 9999.00\nSubtotal: 100.00\nPaid amount: 30.00\nAmount due: 91.00',
    ),
  ])
  assert.equal(absent.attributes.total_amount, null)
  assert.equal(absent.attributes.balance_due, '91.00')
})
test('ambiguous or malformed candidates, unknown roles, conflicting types and stale OCR yield null/unknown', () => {
  const result = analyzePages([
    page(
      'a',
      'Invoice\nInvoice Number: 1\nSeller: SIA A\nGrand total: 20.00 EUR\nIssue date: 03/04/2026',
    ),
    page('b', 'Grand total: 21.00 EUR\nSeller: SIA B\nCurrency: USD\nContract No. C1'),
  ])
  for (const key of ['total_amount', 'sender', 'currency', 'issue_date', 'recipient'])
    assert.equal(result.attributes[key], null)
  assert.equal(result.document_type, 'unknown')
  assert.equal(result.evidence.total_amount[1].page, 2)
  const malformed = analyzePages([page('a', 'Grand total: 20.00\nGrand total: unreadable')])
  assert.equal(malformed.attributes.total_amount, null)
  assert.equal(analyzePages([page('a', 'Rēķins')]).document_type, 'unknown')
  const stalePage = {
    ...page('a', 'Invoice No. A1\nGrand total: 50.00'),
    processing: { ...defaultProcessing(), rotation: 90 },
  }
  const stale = analyzePages([stalePage])
  assert.equal(stale.attributes.total_amount, null)
  assert.ok(stale.warnings.includes('stale_ocr'))
})
test('normalizers reject invalid dates, ambiguous thousands, incomplete decimals and symbols without context', () => {
  for (const raw of ['1 234,56', '1,234.56', '1.234,56', '1234.56'])
    assert.equal(normalizeAmount(raw), '1234.56')
  for (const raw of ['1,234', '12 34,56', '12.5', '$12', '1e6'])
    assert.equal(normalizeAmount(raw), null)
  assert.equal(normalizeDate('29.02.2024'), '2024-02-29')
  for (const raw of ['29.02.2026', '31.04.2026', '03/04/2026', '2026-13-01'])
    assert.equal(normalizeDate(raw), null)
  assert.equal(analyzePages([page('a', 'Grand total: $100.00')]).attributes.currency, null)
})
test('contract, application, insurance and delivery types require supporting content', () => {
  for (const [text, type] of [
    ['Līgums\nLīguma Nr.: C1', 'contract'],
    ['Iesniegums\nIesniedzējs: Sintētiska persona\nAdresāts: Sintētiska iestāde', 'application'],
    ['Insurance policy\nPolicy Number: P1', 'insurance_document'],
    ['Delivery note No. D1', 'delivery_note'],
  ])
    assert.equal(analyzePages([page('a', text)]).document_type, type)
})
test('boundary suggestions require a heading plus differing explicit invoice identities and never mutate grouping', () => {
  const pages = [
    page('a', 'Invoice No. A1'),
    page('b', 'Invoice No. A1'),
    page('c', 'Invoice\nInvoice Number: A2'),
    page('d', 'Invoice'),
  ]
  const copy = pages.map((p) => p.id)
  assert.deepEqual(suggestBoundaries(pages), [
    { pageId: 'c', index: 2, previousNumber: 'A1', nextNumber: 'A2' },
  ])
  assert.deepEqual(
    pages.map((p) => p.id),
    copy,
  )
  assert.deepEqual(suggestBoundaries([page('a', 'Rēķins'), page('b', 'Rēķins')]), [])
  assert.deepEqual(
    suggestBoundaries([page('a', 'Invoice No. A1'), page('b', 'Invoice Number: A2')]),
    [],
  )
})
