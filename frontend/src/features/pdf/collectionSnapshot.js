import { createExportSnapshot, PDF_LIMITS, PdfError, safeFilename } from './model.js'
export function collectionSnapshot(collection, { scansOnly = false, documentId } = {}) {
  const entries = documentId
    ? collection.documents.filter((item) => item.id === documentId)
    : collection.documents
  if (!entries.length) throw new PdfError('empty')
  const documents = entries.map((document) => {
    const session = {
      id: document.sessionId,
      revision: 1,
      pages: document.pages,
      documents: [document],
    }
    const snapshot = createExportSnapshot(session, document.id, {
      includeInformation: !scansOnly && document.confirmed,
      quality: 'high',
    })
    snapshot.pages = snapshot.pages.map((page) => ({
      ...page,
      imageRecordId: document.pages.find((item) => item.id === page.id).imageRecordId,
    }))
    return snapshot
  })
  const pages = documents.flatMap((item) => item.pages)
  if (pages.length > PDF_LIMITS.scanPages) throw new PdfError('limit')
  return {
    documents,
    pages,
    options: { includeInformation: documents.some((item) => item.options.includeInformation) },
    metadata: {
      title: collection.name,
      filename: safeFilename(documentId ? documents[0].metadata.filename : collection.name),
    },
  }
}
