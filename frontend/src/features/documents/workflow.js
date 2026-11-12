import {
  createDocument,
  assignPages,
  mergeDocuments,
  unassignedPages,
  documentPages,
  isConfirmationCurrent,
} from './model.js'
import { isOcrStale } from '../ocr/model.js'

export function navigationState(value = {}) {
  return {
    step: Number.isInteger(value?.step) && value.step >= 1 && value.step <= 4 ? value.step : null,
    documentId: typeof value?.documentId === 'string' ? value.documentId : null,
  }
}
export function workflowState(session) {
  const pages = session?.pages || []
  const documents = (session?.documents || []).filter((document) => document.pageIds.length)
  const grouped = Boolean(pages.length && documents.length && !unassignedPages(session).length)
  const reviewed =
    grouped && documents.every((document) => isConfirmationCurrent(session, document))
  const maximum = !pages.length ? 1 : documents.length ? 4 : 2
  const navigation = navigationState(session?.workflow)
  const recommended = !pages.length ? 1 : !grouped ? 2 : reviewed ? 4 : 3
  return {
    step: Math.min(navigation.step || recommended, maximum),
    maximum,
    grouped,
    reviewed,
    documents,
    documentId:
      documents.find((document) => document.id === navigation.documentId)?.id ||
      documents[0]?.id ||
      null,
    complete: [pages.length > 0, grouped, reviewed, false],
  }
}
export function asSingleDocument(session) {
  if (!session.pages.length) throw new Error('No pages')
  if (!session.documents.length)
    return createDocument(
      session,
      session.pages.map((page) => page.id),
    )
  let result = session
  const target = result.documents[0].id
  for (const source of session.documents.slice(1))
    result = mergeDocuments(result, target, source.id)
  return assignPages(
    result,
    session.pages.map((page) => page.id),
    target,
  )
}
export function groupAtBoundaries(session, starts = []) {
  const pages = unassignedPages(session)
  if (!pages.length) return session
  const ids = new Set(pages.map((page) => page.id))
  if (starts.some((id) => !ids.has(id))) throw new Error('Invalid boundary')
  const boundaries = new Set(starts)
  let result = session,
    group = []
  for (const page of pages) {
    if (group.length && boundaries.has(page.id)) {
      result = createDocument(result, group)
      group = []
    }
    group.push(page.id)
  }
  return group.length ? createDocument(result, group) : result
}
export function draftHasDocuments(draft) {
  const documents = (draft.documents || []).filter((document) => document.pageIds.length)
  const assigned = new Set(documents.flatMap((document) => document.pageIds))
  return Boolean(
    draft.pageIds.length && documents.length && draft.pageIds.every((id) => assigned.has(id)),
  )
}
export async function recognizeDocument(session, ocr, id, languages, confirmRerun = () => true) {
  const initial = session.active.value
  const document = initial?.documents.find((item) => item.id === id)
  if (!document?.pageIds.length || session.busy.value || ocr.running.value)
    throw new Error('Document unavailable')
  const pages = documentPages(initial, document)
  const pending = pages.filter((page) => !page.ocr || isOcrStale(page))
  let approved = true
  if (pending.length) {
    await ocr.run(pending, languages, () => (approved = confirmRerun()))
    if (!approved || ocr.cancelled.value) return { cancelled: true }
    if (ocr.saveError.value) throw ocr.saveError.value
  }
  const latest = session.active.value
  const current = latest?.documents.find((item) => item.id === id)
  if (
    latest?.id !== initial.id ||
    !current ||
    JSON.stringify(current.pageIds) !== JSON.stringify(document.pageIds)
  )
    throw new Error('Document changed')
  session.analyzeDocument(id)
  await session.save()
  return {
    cancelled: false,
    reused: pages.length - pending.length,
    recognized: pending.length,
    incomplete: documentPages(session.active.value, current).some(
      (page) => !page.ocr || isOcrStale(page) || page.ocr.status === 'empty',
    ),
  }
}
