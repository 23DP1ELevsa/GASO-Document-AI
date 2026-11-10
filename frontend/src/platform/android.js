import { Capacitor } from '@capacitor/core'

export async function setupAndroid(router) {
  if (Capacitor.getPlatform() !== 'android') return
  const { App } = await import('@capacitor/app')
  const { SplashScreen } = await import('@capacitor/splash-screen')
  await App.addListener('backButton', () => {
    if (router.currentRoute.value.name === 'home') App.exitApp()
    else if (router.options.history.state.back) router.back()
    else router.replace('/')
  })
  await SplashScreen.hide()
}
