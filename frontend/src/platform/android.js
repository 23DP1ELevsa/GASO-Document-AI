import { Capacitor } from '@capacitor/core'

export async function setupAndroid(router) {
  if (Capacitor.getPlatform() !== 'android') return
  const { App } = await import('@capacitor/app')
  const { SplashScreen } = await import('@capacitor/splash-screen')
  await App.addListener('backButton', () => {
    if (!window.dispatchEvent(new Event('gaso:back', { cancelable: true }))) return
    const { name } = router.currentRoute.value
    const { back } = router.options.history.state
    if (name === 'home' || name === 'login') App.exitApp()
    else if (name === 'register' && back !== '/login') router.replace({ name: 'login' })
    else if (back) router.back()
    else router.replace('/')
  })
  await SplashScreen.hide()
}
