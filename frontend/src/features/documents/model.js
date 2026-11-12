import { newId } from '../scanning/id.js'
import { imageVersion, isOcrStale, textForPage } from '../ocr/model.js'
import { ALL_FIELDS, DOCUMENT_TYPES, emptyValues } from './catalog.js'
import { normalizeAmount, normalizeDate } from './analysis.js'

export function documentPages(session, document) {
  const pages = new Map(session.pages.map((page) => [page.id, page]))
  return document.pageIds.map((id) => pages.get(id)).filter(Boolean)
}
export function sourceVersion(session, document) {
  // Exact comparison, including text, avoids hash collisions and timestamp-only invalidation.
  return JSON.stringify(
    documentPages(session, document).map((page) => [
      page.id,
      imageVersion(page),
      page.modifiedAt ?? null,
      page.contentRevision ?? 0,
      page.ocr?.recognizedAt ?? null,
      page.ocr?.editedAt ?? null,
      page.ocr?.imageVersion ?? null,
      textForPage(page),
    ]),
  )
}
export function isAnalysisStale(session, document) {
  return Boolean(
    document.analysis &&
    (document.analysis.source !== sourceVersion(session, document) ||
      documentPages(session, document).some(isOcrStale)),
  )
}
export function isConfirmationCurrent(session, document) {
  return Boolean(
    document.confirmation &&
    document.confirmation.source === sourceVersion(session, document) &&
    JSON.stringify(document.confirmation.values) === JSON.stringify(document.values),
  )
}
export function unassignedPages(session) {
  const assigned = new Set((session.documents || []).flatMap((document) => document.pageIds))
  return session.pages.filter((page) => !assigned.has(page.id))
}
export function validateDocuments(session) {
  const documentIds = new Set(),
    assigned = new Set(),
    pageIds = new Set(session.pages.map((page) => page.id))
  for (const document of session.documents || []) {
    if (
      !document.id ||
      documentIds.has(document.id) ||
      document.sessionId !== session.id ||
      !Array.isArray(document.pageIds)
    )
      throw new Error('Invalid document')
    documentIds.add(document.id)
    for (const id of document.pageIds) {
      if (!pageIds.has(id) || assigned.has(id)) throw new Error('Invalid page ownership')
      assigned.add(id)
    }
  }
}
export function migrateGrouping(session) {
  // Version 1 drafts had no ownership. Preserve pages and all OCR, leaving them unassigned.
  const migrated = { ...session, schemaVersion: 2, documents: session.documents || [] }
  validateDocuments(migrated)
  return migrated
}
function changed(session, documents) {
  const result = { ...session, schemaVersion: 2, documents, updatedAt: Date.now() }
  validateDocuments(result)
  return result
}
function requireDocument(session, id) {
  const document = session.documents.find((item) => item.id === id)
  if (!document) throw new Error('Missing document')
  return document
}
export function updateDocument(session, id, transform) {
  requireDocument(session, id)
  return changed(
    session,
    session.documents.map((document) =>
      document.id === id ? { ...transform(document), updatedAt: Date.now() } : document,
    ),
  )
}
export function assignPages(session, pageIds, targetId = null) {
  if (targetId !== null) requireDocument(session, targetId)
  const validIds = new Set(session.pages.map((page) => page.id))
  const selected = [...new Set(pageIds)]
  if (selected.some((id) => !validIds.has(id))) throw new Error('Missing page')
  return changed(
    session,
    session.documents.map((document) => {
      const remaining = document.pageIds.filter((id) => !selected.includes(id))
      const nextIds = document.id === targetId ? [...remaining, ...selected] : remaining
      return JSON.stringify(nextIds) === JSON.stringify(document.pageIds)
        ? document
        : { ...document, pageIds: nextIds, updatedAt: Date.now() }
    }),
  )
}
export function createDocument(session, pageIds = [], title = '') {
  const now = Date.now()
  const document = {
    id: newId(),
    sessionId: session.id,
    pageIds: [],
    values: { ...emptyValues(), document_title: title.trim() || null },
    customFields: [],
    analysis: null,
    confirmation: null,
    createdAt: now,
    updatedAt: now,
  }
  return assignPages(changed(session, [...session.documents, document]), pageIds, document.id)
}
export function deleteDocument(session, id) {
  requireDocument(session, id)
  // Only remove metadata: all pages become unassigned, images and OCR remain intact.
  return changed(
    session,
    session.documents.filter((document) => document.id !== id),
  )
}
export function mergeDocuments(session, targetId, sourceId) {
  if (targetId === sourceId) throw new Error('Same document')
  const source = requireDocument(session, sourceId)
  return deleteDocument(assignPages(session, source.pageIds, targetId), sourceId)
}
export function splitDocument(session, id, pageIds) {
  const document = requireDocument(session, id)
  const selected = [...new Set(pageIds)]
  if (
    !selected.length ||
    selected.length >= document.pageIds.length ||
    selected.some((pageId) => !document.pageIds.includes(pageId))
  )
    throw new Error('Invalid split')
  // New documents never inherit another document's attributes or confirmation.
  return createDocument(
    session,
    document.pageIds.filter((pageId) => selected.includes(pageId)),
  )
}
export function reorderPage(session, id, pageId, direction) {
  return updateDocument(session, id, (document) => {
    const ids = [...document.pageIds],
      index = ids.indexOf(pageId),
      target = index + direction
    if (![-1, 1].includes(direction) || index < 0 || target < 0 || target >= ids.length)
      return document
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    return { ...document, pageIds: ids }
  })
}
export function replacePageReference(session, oldId, newId) {
  return changed(
    session,
    session.documents.map((document) =>
      document.pageIds.includes(oldId)
        ? {
            ...document,
            pageIds: document.pageIds.map((id) => (id === oldId ? newId : id)),
            updatedAt: Date.now(),
          }
        : document,
    ),
  )
}
export function reconcilePages(session) {
  const ids = new Set(session.pages.map((page) => page.id))
  return changed(
    session,
    session.documents.map((document) => {
      const pageIds = document.pageIds.filter((id) => ids.has(id))
      return pageIds.length === document.pageIds.length
        ? document
        : { ...document, pageIds, updatedAt: Date.now() }
    }),
  )
}
export function editValue(session, id, key, raw) {
  const document = requireDocument(session, id)
  if (!ALL_FIELDS.includes(key) && !document.customFields.some((field) => field.key === key))
    throw new Error('Unknown attribute')
  if (raw !== null && typeof raw !== 'string') throw new Error('Invalid value')
  // Input events arrive one character at a time. Preserve spaces while typing names/titles.
  const value = raw === null || raw === '' ? null : raw
  return updateDocument(session, id, (item) => ({
    ...item,
    values: { ...item.values, [key]: value },
  }))
}
export function validationErrors(document) {
  const errors = []
  for (const [key, value] of Object.entries(document.values)) {
    if (value === null) continue
    if (key === 'document_type' && !DOCUMENT_TYPES.includes(value)) errors.push(key)
    if ((key.endsWith('_date') || key.startsWith('coverage_')) && normalizeDate(value) !== value)
      errors.push(key)
    if ((key.endsWith('_amount') || key === 'balance_due') && normalizeAmount(value) !== value)
      errors.push(key)
    if (key === 'currency' && !/^[A-Z]{3}$/.test(value)) errors.push(key)
  }
  return [...new Set(errors)]
}
export function confirmDocument(session, id) {
  const document = requireDocument(session, id)
  if (!document.pageIds.length || validationErrors(document).length)
    throw new Error('Invalid information')
  return updateDocument(session, id, (item) => ({
    ...item,
    confirmation: {
      confirmedAt: Date.now(),
      source: sourceVersion(session, item),
      values: { ...item.values },
    },
  }))
}
export function addCustomField(session, id, label, value = null) {
  if (!label.trim()) throw new Error('Missing label')
  const key = `custom_${newId().replaceAll('-', '')}`
  return updateDocument(session, id, (document) => ({
    ...document,
    customFields: [...document.customFields, { key, label: label.trim() }],
    values: { ...document.values, [key]: value?.trim() || null },
  }))
}
// Future PDF adapter reads image blobs by pageId, preserving document order and visual content.
export function documentExportPlan(session, id) {
  const document = requireDocument(session, id)
  return {
    documentId: id,
    information: { ...document.values },
    customFields: document.customFields.map((field) => ({ ...field })),
    confirmed: isConfirmationCurrent(session, document),
    pages: document.pageIds.map((pageId) => ({ pageId, imageRecordId: pageId })),
  }
}
