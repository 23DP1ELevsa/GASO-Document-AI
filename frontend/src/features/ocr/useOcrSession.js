import { computed, onScopeDispose, ref, watch } from 'vue'
import { createOcrService } from './ocrService.js'
import {
  makeOcrResult,
  imageVersion,
  textForPage,
  ocrErrorCode,
  normalizeLanguages,
  OcrError,
} from './model.js'
import { resolveOcrInput } from './input.js'
import { readImageRecord } from '../scanning/draftRepository.js'
import { processingJob } from '../processing/processor.js'

export function useOcrSession(session) {
  const service = createOcrService()
  const running = ref(false),
    currentPageId = ref(null),
    progress = ref(0),
    phase = ref('initializing')
  const total = ref(0),
    current = ref(0),
    completed = ref(0),
    errors = ref(0)
  const message = ref(''),
    saveError = ref(''),
    cancelled = ref(false)
  let controller = null,
    disposed = false
  const combinedText = computed(() =>
    (session.active.value?.pages || [])
      .map((page, index) => `${index + 1}. lapa\n${textForPage(page)}`)
      .join('\n\n'),
  )
  function cancel() {
    cancelled.value = true
    controller?.abort()
    service.cancel()
  }
  watch(
    () => session.active.value?.id,
    () => {
      if (running.value) cancel()
      total.value = current.value = completed.value = errors.value = 0
      message.value = saveError.value = ''
      cancelled.value = false
    },
  )
  async function run(pages, languages, confirmRerun) {
    if (running.value || session.busy.value || !pages.length) return
    const selected = normalizeLanguages(languages)
    if (pages.some((page) => page.ocr) && !confirmRerun()) return
    const sessionId = session.active.value.id
    const snapshot = [...pages]
    controller = new AbortController()
    running.value = true
    cancelled.value = false
    message.value = ''
    saveError.value = ''
    total.value = snapshot.length
    current.value = completed.value = errors.value = 0
    try {
      for (const page of snapshot) {
        if (cancelled.value || disposed || session.active.value?.id !== sessionId) break
        current.value++
        currentPageId.value = page.id
        progress.value = 0
        phase.value = 'initializing'
        const startedAt = Date.now()
        try {
          const image = await resolveOcrInput(page, {
            readImageRecord,
            processingJob,
            signal: controller.signal,
          })
          if (cancelled.value) break
          const data = await service.recognize(image, selected, (update) => {
            progress.value = update.progress
            phase.value = update.phase
          })
          if (cancelled.value || disposed) break
          const latest = session.active.value?.pages.find((item) => item.id === page.id)
          if (
            session.active.value?.id !== sessionId ||
            !latest ||
            imageVersion(latest) !== imageVersion(page)
          )
            continue
          session.applyOcr(page.id, {
            ocr: makeOcrResult(page, selected, data, Date.now() - startedAt),
            ocrAttempt: null,
          })
          completed.value++
        } catch (error) {
          if (disposed || session.active.value?.id !== sessionId) break
          const code = cancelled.value ? 'cancelled' : ocrErrorCode(error)
          if (session.active.value.pages.some((item) => item.id === page.id))
            session.applyOcr(page.id, {
              ocrAttempt: {
                status: code === 'cancelled' ? 'cancelled' : 'error',
                errorCode: code,
                languages: selected,
                imageVersion: imageVersion(page),
                startedAt,
                durationMs: Date.now() - startedAt,
              },
            })
          if (code !== 'cancelled') {
            errors.value++
            message.value = code
          }
        }
        // Save each completed page atomically, so a later failure cannot lose it.
        if (!disposed) {
          try {
            await session.save()
          } catch (error) {
            saveError.value = error
            break
          }
        }
        if (cancelled.value) break
      }
    } finally {
      currentPageId.value = null
      running.value = false
      controller = null
    }
  }
  async function saveText(id, text) {
    if (running.value) throw new OcrError('busy')
    session.editOcrText(id, text)
    await session.save()
    saveError.value = ''
  }
  onScopeDispose(() => {
    disposed = true
    cancel()
    service.dispose()
  })
  return {
    running,
    currentPageId,
    progress,
    phase,
    total,
    current,
    completed,
    errors,
    message,
    saveError,
    cancelled,
    combinedText,
    run,
    cancel,
    saveText,
  }
}
