import { ALL_FIELDS, DOCUMENT_TYPES } from './catalog.js'
import { documentPages, sourceVersion, updateDocument } from './model.js'
import { prepareAiImage, AI_IMAGE_LIMITS, abortAnalysis } from './aiImages.js'
import { newId } from '../scanning/id.js'
import { accountHeaders, accountRequestSignal, checkAccountResponse } from '../auth/scope.js'

export const AI_ERRORS = {
  cancelled: 'AI analīze atcelta. Dokumenta dati ir saglabāti.',
  consent_required: 'Pirms AI analīzes apstipriniet fotoattēlu nosūtīšanu OpenAI.',
  offline: 'Nav interneta savienojuma. Varat aizpildīt datus manuāli vai eksportēt skenējumu.',
  not_configured: 'Serverī nav konfigurēta OpenAI API atslēga.',
  ai_disabled: 'AI analīze serverī nav ieslēgta.',
  access_denied: 'AI analīze pieejama tikai uzticamā lokālajā vidē.',
  insufficient_quota: 'OpenAI API kredīti vai piešķirtā kvota ir izsmelti.',
  upstream_authentication: 'OpenAI noraidīja servera autentifikāciju.',
  upstream_rate_limit: 'OpenAI pieprasījumu limits ir sasniegts. Mēģiniet vēlāk.',
  rate_limit: 'Pārāk daudz pieprasījumu. Mēģiniet vēlāk.',
  test_limit: 'Servera testēšanas pieprasījumu limits ir sasniegts.',
  duplicate_request: 'Šis dokuments nesen jau nosūtīts. Pirms atkārtošanas uzgaidiet.',
  busy: 'Analīze jau notiek. Uzgaidiet.',
  timeout: 'AI analīzes gaidīšanas laiks beidzās.',
  upstream_tls:
    'Neizdevās izveidot drošu savienojumu ar OpenAI. Sīkāka informācija ir servera žurnālā.',
  upstream_connection:
    'Savienojums ar OpenAI neizdevās vai tika pārtraukts. Sīkāka informācija ir servera žurnālā.',
  invalid_input: 'Dokumentam nav derīgu fotoattēlu.',
  input_too_large: 'Dokuments pārsniedz AI analīzes apjoma ierobežojumu.',
  source_changed: 'Dokuments analīzes laikā mainījās. Rezultāts nav piemērots.',
  refused_response: 'OpenAI atteica dokumenta analīzi.',
  incomplete_response: 'OpenAI atbilde nav pabeigta. Rezultāts nav saglabāts.',
  invalid_response: 'AI atbilde nav derīga. Rezultāts nav saglabāts.',
  unavailable: 'AI analīze nav pieejama. Varat aizpildīt datus manuāli vai eksportēt skenējumu.',
}
export class AiError extends Error {
  constructor(code) {
    super(AI_ERRORS[code] || AI_ERRORS.unavailable)
    this.name = 'AiError'
    this.code = Object.hasOwn(AI_ERRORS, code) ? code : 'unavailable'
  }
}
export async function analysisPayload(
  session,
  id,
  consent,
  { signal, onProgress = () => {}, prepare = prepareAiImage } = {},
) {
  if (consent !== true) throw new AiError('consent_required')
  if (globalThis.navigator?.onLine === false) throw new AiError('offline')
  const document = session.documents.find((item) => item.id === id)
  if (!document?.pageIds.length) throw new AiError('invalid_input')
  const pages = documentPages(session, document)
  if (pages.length !== document.pageIds.length || pages.length > AI_IMAGE_LIMITS.pages)
    throw new AiError('input_too_large')
  const payload = []
  let total = 0
  for (const [index, page] of pages.entries()) {
    abortAnalysis(signal)
    onProgress({ phase: 'preparing', completed: index, total: pages.length })
    let prepared
    try {
      prepared = await prepare(page, { signal })
    } catch (error) {
      if (signal?.aborted) throw new AiError('cancelled')
      throw new AiError('input_too_large')
    }
    total += prepared.bytes
    if (total > AI_IMAGE_LIMITS.totalBytes) throw new AiError('input_too_large')
    payload.push({ id: page.id, number: index + 1, image: prepared.image })
    onProgress({ phase: 'preparing', completed: index + 1, total: pages.length })
  }
  const result = { consent: true, pages: payload }
  if (new TextEncoder().encode(JSON.stringify(result)).length > AI_IMAGE_LIMITS.bodyBytes)
    throw new AiError('input_too_large')
  return result
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
  if (
    result.version === 2 &&
    (!Array.isArray(result.dynamic_attributes) ||
      result.dynamic_attributes.length > 40 ||
      result.dynamic_attributes.some(
        (field) =>
          typeof field.id !== 'string' ||
          typeof field.label !== 'string' ||
          !field.label.trim() ||
          typeof field.value !== 'string' ||
          (field.key !== null && !fields.includes(field.key)) ||
          !['text', 'date', 'amount', 'currency', 'number'].includes(field.dataType) ||
          field.status !== 'unreviewed' ||
          field.origin !== 'ai' ||
          (field.page !== null && (!Number.isInteger(field.page) || field.page < 1)),
      ))
  )
    throw new AiError('invalid_response')
  return result
}
export async function requestAiAnalysis(
  payload,
  {
    fetcher = globalThis.fetch,
    online = globalThis.navigator?.onLine,
    timeout = 130000,
    signal,
    onProgress = () => {},
  } = {},
) {
  if (online === false) throw new AiError('offline')
  const controller = new AbortController()
  const lifetime = accountRequestSignal()
  const cancel = () => controller.abort()
  signal?.addEventListener('abort', cancel, { once: true })
  if (signal?.aborted) controller.abort()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    abortAnalysis(controller.signal)
    onProgress({ phase: 'waiting' })
    const response = await fetcher('/api/document-analysis', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...accountHeaders(),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.any([controller.signal, lifetime]),
      cache: 'no-store',
      credentials: 'same-origin',
    })
    checkAccountResponse(response)
    let data
    try {
      data = await response.json()
    } catch {
      throw new AiError('invalid_response')
    }
    if (!response.ok) throw new AiError(data?.error?.code || 'unavailable')
    abortAnalysis(controller.signal)
    abortAnalysis(lifetime)
    onProgress({ phase: 'processing' })
    return validateAiResult(data.result)
  } catch (error) {
    if (error instanceof AiError) throw error
    throw new AiError(
      signal?.aborted ? 'cancelled' : controller.signal.aborted ? 'timeout' : 'unavailable',
    )
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', cancel)
  }
}
export function attachAiAnalysis(session, id, source, result) {
  const document = session.documents.find((item) => item.id === id)
  if (!document || sourceVersion(session, document) !== source) throw new AiError('source_changed')
  validateAiResult(result)
  return updateDocument(session, id, (item) => {
    const values = { ...item.values }
    const customFields = [...item.customFields]
    const dynamicAttributes = [...(item.dynamicAttributes || [])]
    if (result.version === 2) {
      for (const suggested of result.dynamic_attributes) {
        const known = dynamicAttributes.find((field) =>
          suggested.key
            ? field.key === suggested.key
            : field.label.toLocaleLowerCase() === suggested.label.toLocaleLowerCase(),
        )
        const custom =
          !suggested.key &&
          customFields.find(
            (field) => field.label.toLocaleLowerCase() === suggested.label.toLocaleLowerCase(),
          )
        const key =
          suggested.key || known?.key || custom?.key || 'custom_' + newId().replaceAll('-', '')
        if (
          item.editedFields?.includes(key) ||
          item.deletedAttributeLabels?.includes(suggested.label.toLocaleLowerCase()) ||
          (values[key] != null && !known)
        )
          continue
        if (!suggested.key && !customFields.some((field) => field.key === key))
          customFields.push({ key, label: suggested.label })
        values[key] = suggested.value
        const field = {
          ...suggested,
          id: known?.id || newId(),
          key,
          normalizedKey: suggested.key,
          status: 'unreviewed',
        }
        const index = dynamicAttributes.findIndex((entry) => entry.key === key)
        if (index >= 0) dynamicAttributes[index] = field
        else dynamicAttributes.push(field)
      }
      if (
        !item.editedFields?.includes('document_type') &&
        (!item.confirmation || item.values.document_type === 'unknown')
      )
        values.document_type = result.document_type
    }
    return {
      ...item,
      values,
      customFields,
      dynamicAttributes,
      analysis: { provider: 'openai', analyzedAt: Date.now(), source, result },
    }
  })
}
