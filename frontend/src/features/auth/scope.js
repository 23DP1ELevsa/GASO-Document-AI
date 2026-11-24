import { shallowRef } from 'vue'

export const account = shallowRef(null)
export const accountEvents = new EventTarget()
const lifetime = new AbortController()
let requests = new AbortController()

export function accountScope() {
  return { id: account.value?.id, signal: lifetime.signal }
}

export function lockAccount() {
  if (!account.value) return
  account.value = null
  lifetime.abort()
  cancelAccountRequests()
  accountEvents.dispatchEvent(new Event('locked'))
}

export function accountRequestSignal() {
  return AbortSignal.any([lifetime.signal, requests.signal])
}

export function cancelAccountRequests() {
  requests.abort()
  requests = new AbortController()
  accountEvents.dispatchEvent(new Event('cancel-requests'))
}

export function accountKey(key) {
  const { id } = accountScope()
  return id ? key + ':' + id : null
}

export function csrfHeaders() {
  const value = globalThis.document?.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/)?.[1]
  return value ? { 'X-XSRF-TOKEN': decodeURIComponent(value) } : {}
}

export function accountHeaders() {
  const { id } = accountScope()
  return { ...csrfHeaders(), ...(id && { 'X-GASO-Account': id }) }
}

export function checkAccountResponse(response) {
  if (account.value && [401, 419].includes(response.status)) lockAccount()
}
