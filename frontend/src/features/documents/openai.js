import { ALL_FIELDS, DOCUMENT_TYPES } from './catalog.js'
import { documentPages, sourceVersion, updateDocument } from './model.js'
import { isOcrStale, textForPage } from '../ocr/model.js'

export const AI_ERRORS = {
  consent_required: 'Pirms AI analīzes apstipriniet OCR teksta nosūtīšanu OpenAI.',
  offline: 'Nav interneta savienojuma. Varat turpināt ar lokālo analīzi.',
  not_configured: 'Serverī nav konfigurēta OpenAI API atslēga.',
  ai_disabled: 'AI analīze serverī nav ieslēgta.',
  access_denied: 'AI analīze pieejama tikai uzticamā lokālajā vidē.',
  insufficient_quota: 'OpenAI API kredīti vai piešķirtā kvota ir izsmelti.',
  upstream_authentication: 'OpenAI noraidīja servera autentifikāciju.',
  upstream_rate_limit: 'OpenAI pieprasījumu limits ir sasniegts. Mēģiniet vēlāk.',
  rate_limit: 'Pārāk daudz pieprasījumu. Mēģiniet vēlāk.',
  test_limit: 'Servera testēšanas pieprasījumu limits ir sasniegts.',
  duplicate_request: 'Šis teksts nesen jau nosūtīts. Pirms atkārtošanas uzgaidiet.',
  busy: 'Analīze jau notiek. Uzgaidiet.',
  timeout: 'AI analīzes gaidīšanas laiks beidzās.',
  empty_text: 'Dokumentā nav salasāma OCR teksta.',
  stale_ocr: 'Atjaunojiet lapu OCR pirms AI analīzes.',
  input_too_large: 'Dokuments pārsniedz AI analīzes apjoma ierobežojumu.',
  source_changed: 'Dokuments analīzes laikā mainījās. Rezultāts nav piemērots.',
  refused_response: 'OpenAI atteica dokumenta analīzi.',
  incomplete_response: 'OpenAI atbilde nav pabeigta. Rezultāts nav saglabāts.',
  invalid_response: 'AI atbilde nav derīga. Rezultāts nav saglabāts.',
  unavailable: 'AI analīze nav pieejama. Varat turpināt ar lokālo analīzi.',
}
export class AiError extends Error {
  constructor(code) {
    super(AI_ERRORS[code] || AI_ERRORS.unavailable)
    this.name = 'AiError'
    this.code = Object.hasOwn(AI_ERRORS, code) ? code : 'unavailable'
  }
}
export function analysisPayload(session, id, consent) {
  if (consent !== true) throw new AiError('consent_required')
  const document = session.documents.find((item) => item.id === id)
  if (!document?.pageIds.length) throw new AiError('empty_text')
  const pages = documentPages(session, document)
  if (pages.length !== document.pageIds.length || pages.some(isOcrStale))
    throw new AiError('stale_ocr')
  const payload = pages.map((page, index) => ({
    id: page.id,
    number: index + 1,
    text: textForPage(page),
  }))
  if (!payload.some((page) => page.text.trim())) throw new AiError('empty_text')
  if (payload.length > 20 || payload.reduce((sum, page) => sum + [...page.text].length, 0) > 60000)
    throw new AiError('input_too_large')
  return { consent: true, pages: payload }
}
export function validateAiResult(result) {
  const fields = ALL_FIELDS.filter((key) => key !== 'document_type')
  if (
    !result ||
    result.provider !== 'openai' ||
    result.requires_review !== true ||
    !DOCUMENT_TYPES.includes(result.document_type) ||
    !result.attributes ||
    typeof result.evidence !== 'object' ||
    result.evidence === null ||
    Array.isArray(result.evidence) ||
    !Array.isArray(result.warnings) ||
    result.warnings.some((value) => typeof value !== 'string') ||
    Object.keys(result.attributes).length !== fields.length ||
    fields.some(
      (key) =>
        !Object.hasOwn(result.attributes, key) ||
        (result.attributes[key] !== null && typeof result.attributes[key] !== 'string'),
    )
  )
    throw new AiError('invalid_response')
  return result
}
export async function requestAiAnalysis(
  payload,
  { fetcher = globalThis.fetch, online = globalThis.navigator?.onLine, timeout = 70000 } = {},
) {
  if (online === false) throw new AiError('offline')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetcher('/api/document-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: 'no-store',
      credentials: 'omit',
    })
    let data
    try {
      data = await response.json()
    } catch {
      throw new AiError('invalid_response')
    }
    if (!response.ok) throw new AiError(data?.error?.code || 'unavailable')
    return validateAiResult(data.result)
  } catch (error) {
    if (error instanceof AiError) throw error
    throw new AiError(controller.signal.aborted ? 'timeout' : 'unavailable')
  } finally {
    clearTimeout(timer)
  }
}
export function attachAiAnalysis(session, id, source, result) {
  const document = session.documents.find((item) => item.id === id)
  if (!document || sourceVersion(session, document) !== source) throw new AiError('source_changed')
  return updateDocument(session, id, (item) => ({
    ...item,
    analysis: {
      provider: 'openai',
      analyzedAt: Date.now(),
      source,
      result: validateAiResult(result),
    },
  }))
}
