import { createExportSnapshot, exportSignature, PdfError } from './model.js'
import { loadDraft } from '../scanning/draftRepository.js'

export async function prepareExport(controller, documentId, options, load = loadDraft) {
  if (controller.busy.value || !controller.active.value) throw new PdfError('busy')
  const sessionId = controller.active.value.id
  // Fail early on empty groups or unconfirmed information, without performing a save.
  createExportSnapshot(controller.active.value, documentId, options)
  if (controller.dirty.value) await controller.save()
  const saved = await load(sessionId)
  if (
    controller.active.value?.id !== sessionId ||
    controller.dirty.value ||
    saved.revision !== controller.active.value.revision
  )
    throw new PdfError('sourceChanged')
  const snapshot = createExportSnapshot(saved, documentId, options)
  const current = controller.active.value.documents.find((document) => document.id === documentId)
  if (!current || snapshot.signature !== exportSignature(controller.active.value, current))
    throw new PdfError('sourceChanged')
  return snapshot
}
export async function verifyExport(controller, snapshot, load = loadDraft) {
  const current = controller.active.value
  const document = current?.documents.find((item) => item.id === snapshot.documentId)
  if (
    !current ||
    controller.dirty.value ||
    current.id !== snapshot.sessionId ||
    current.revision !== snapshot.revision ||
    !document ||
    snapshot.signature !== exportSignature(current, document)
  )
    throw new PdfError('sourceChanged')
  const saved = await load(snapshot.sessionId)
  const stored = saved.documents.find((item) => item.id === snapshot.documentId)
  if (
    saved.revision !== snapshot.revision ||
    !stored ||
    snapshot.signature !== exportSignature(saved, stored)
  )
    throw new PdfError('sourceChanged')
  // Recheck the live state after the IndexedDB await as well.
  if (controller.active.value !== current || controller.dirty.value)
    throw new PdfError('sourceChanged')
}
