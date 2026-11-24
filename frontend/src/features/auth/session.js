import { ref } from 'vue'
import {
  account,
  accountEvents,
  accountHeaders,
  accountRequestSignal,
  cancelAccountRequests,
  checkAccountResponse,
  lockAccount,
} from './scope.js'

export const checkingSession = ref(true)
export const sessionMessage = ref('')
let initialSession
let refreshing
let authChannel
let changingAccount = false

const messages = {
  access_denied: 'Piekļuve kontam ir pieejama tikai atļautajā lokālajā vidē.',
  csrf_expired: 'Sesijas drošības pārbaude neizdevās. Mēģiniet vēlreiz.',
  rate_limit: 'Pārāk daudz mēģinājumu. Uzgaidiet un mēģiniet vēlreiz.',
  unauthenticated: 'Sesija ir beigusies. Pieslēdzieties vēlreiz.',
  offline: 'Lai piekļūtu kontam un dokumentiem, nepieciešams savienojums ar serveri.',
  storage_unavailable: 'Kontu datubāze nav pieejama. Mēģiniet vēlreiz.',
  unavailable: 'Neizdevās sazināties ar serveri. Mēģiniet vēlreiz.',
}

async function request(path, { method = 'GET', data, signal } = {}) {
  if (!navigator.onLine) throw new Error(messages.offline)
  const timeout = AbortSignal.timeout(15_000)
  let response
  try {
    response = await fetch('/api/auth/' + path, {
      method,
      body: data ? JSON.stringify(data) : undefined,
      headers: {
        Accept: 'application/json',
        ...accountHeaders(),
        ...(data && { 'Content-Type': 'application/json' }),
      },
      cache: 'no-store',
      credentials: 'same-origin',
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    })
  } catch {
    signal?.throwIfAborted()
    throw new Error(messages.unavailable)
  }
  if (response.status === 204) return
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(messages[result.error?.code] || messages.unavailable)
    error.status = response.status
    error.fields = result.errors
    throw error
  }
  return result
}

function reloadTo(hash) {
  history.replaceState(null, '', hash)
  location.reload()
}

function refresh() {
  if (refreshing || changingAccount) return refreshing
  const signal = accountRequestSignal()
  refreshing = (async () => {
    try {
      const user = await request('me', { signal })
      if (changingAccount || signal.aborted) return
      if (account.value && account.value.id !== user.id) {
        lockAccount()
        return
      }
      if (typeof user.id !== 'string' || !/^[a-f0-9]{24}$/.test(user.id)) {
        throw new Error(messages.unavailable)
      }
      account.value = user
      sessionMessage.value = ''
    } catch (error) {
      if (changingAccount || signal.aborted) return
      if (error.status !== 401) sessionMessage.value = error.message
      lockAccount()
    } finally {
      refreshing = null
    }
  })()
  return refreshing
}

export function restoreSession() {
  if (initialSession) return initialSession
  accountEvents.addEventListener('locked', () => {
    if (!changingAccount && navigator.onLine) reloadTo('#/login')
  })
  if ('BroadcastChannel' in window) {
    authChannel = new BroadcastChannel('gaso-account')
    authChannel.onmessage = ({ data }) => {
      if (!account.value) return
      if (data?.accountId !== account.value.id) lockAccount()
      else refresh()
    }
  }
  document.addEventListener('visibilitychange', () => {
    if (account.value && !document.hidden) refresh()
  })
  window.addEventListener('pageshow', ({ persisted }) => {
    if (persisted) location.reload()
  })
  window.addEventListener('offline', () => {
    sessionMessage.value = messages.offline
    lockAccount()
  })
  window.addEventListener('online', () => {
    if (!account.value && sessionMessage.value === messages.offline) {
      sessionMessage.value = 'Savienojums atjaunots. Pārbaudiet sesiju vēlreiz vai pieslēdzieties.'
    }
  })
  setInterval(() => {
    if (account.value && !document.hidden) refresh()
  }, 60_000)
  initialSession = refresh().finally(() => {
    checkingSession.value = false
  })
  return initialSession
}

export async function enterAccount(mode, data) {
  changingAccount = true
  try {
    await request('csrf-cookie')
    const user = await request(mode, { method: 'POST', data })
    authChannel?.postMessage({ accountId: user.id })
    reloadTo('#/')
  } catch (error) {
    changingAccount = false
    throw error
  }
}

export async function logoutAccount() {
  changingAccount = true
  cancelAccountRequests()
  try {
    try {
      await request('logout', { method: 'POST' })
    } catch (error) {
      if (error.status !== 419) throw error
      await request('csrf-cookie')
      await request('logout', { method: 'POST' })
    }
  } catch (error) {
    if (error.status !== 401) {
      changingAccount = false
      accountEvents.dispatchEvent(new Event('resume-requests'))
      throw error
    }
  }
  lockAccount()
  authChannel?.postMessage({ accountId: null })
  reloadTo('#/login')
}

export async function accountAction(path, options) {
  try {
    return await request(path, { ...options, signal: accountRequestSignal() })
  } catch (error) {
    checkAccountResponse(error)
    throw error
  }
}
