import { computed, ref, watch } from 'vue'
import { useTheme } from 'vuetify'
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core'
import { THEME_KEY } from '../plugins/vuetify'

const storageUnavailable = ref(false)
export function useAppearance() {
  const theme = useTheme()
  const isDark = computed(() => theme.global.current.value.dark)
  function setTheme(name) {
    theme.change(name)
    try {
      localStorage.setItem(THEME_KEY, name)
      storageUnavailable.value = false
    } catch {
      storageUnavailable.value = true
    }
  }
  watch(
    isDark,
    (dark) => {
      document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', dark ? '#101722' : '#f5f7fb')
      if (Capacitor.getPlatform() === 'android') {
        SystemBars.setStyle({ style: dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(
          () => {},
        )
      }
    },
    { immediate: true },
  )
  return { isDark, setTheme, storageUnavailable }
}
