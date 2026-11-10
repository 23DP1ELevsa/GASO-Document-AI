import { ref } from 'vue'
import { Capacitor } from '@capacitor/core'

const installEvent = ref(null)
const updateAvailable = ref(false)
const offlineError = ref(false)
let updateWorker

export async function setupPwa() {
  if (Capacitor.isNativePlatform()) return
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    installEvent.value = event
  })
  window.addEventListener('appinstalled', () => {
    installEvent.value = null
  })
  if (import.meta.env.PROD) {
    try {
      const { registerSW } = await import('virtual:pwa-register')
      updateWorker = registerSW({
        onNeedRefresh() {
          updateAvailable.value = true
        },
        onRegisterError() {
          offlineError.value = true
        },
      })
    } catch {
      offlineError.value = true
    }
  }
}

export function usePwa() {
  async function install() {
    if (!installEvent.value) return
    const prompt = installEvent.value
    installEvent.value = null
    await prompt.prompt()
    await prompt.userChoice
  }
  return {
    installEvent,
    updateAvailable,
    offlineError,
    install,
    update: () => updateWorker?.(true),
  }
}
