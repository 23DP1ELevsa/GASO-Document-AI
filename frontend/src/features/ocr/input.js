import { OcrError } from './model.js'

// Never use the thumbnail. Re-render a legacy page if its processed blob is absent.
export async function resolveOcrInput(page, { readImageRecord, processingJob, signal }) {
  if (signal?.aborted) throw new OcrError('cancelled')
  let original = page.original,
    processed = page.processed
  if (!original && !processed) {
    const stored = await readImageRecord(page.id)
    original = stored.blob
    processed = stored.processed
  }
  if (signal?.aborted) throw new OcrError('cancelled')
  if (processed instanceof Blob) return processed
  if (!(original instanceof Blob)) throw new OcrError('imageUnavailable')
  if (!page.processing) return original
  const job = processingJob({
    action: 'render',
    original,
    width: page.width,
    height: page.height,
    parameters: page.processing,
    preview: false,
  })
  const cancel = () => job.cancel()
  signal?.addEventListener('abort', cancel, { once: true })
  try {
    const result = await job.promise
    return result.processed || original
  } finally {
    signal?.removeEventListener('abort', cancel)
  }
}
