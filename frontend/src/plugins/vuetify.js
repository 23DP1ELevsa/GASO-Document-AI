import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import {
  VApp,
  VMain,
  VBtn,
  VCard,
  VChip,
  VSwitch,
  VSnackbar,
  VAlert,
  VProgressCircular,
  VProgressLinear,
  VDialog,
  VMenu,
} from 'vuetify/components'

export const THEME_KEY = 'gaso-document-ai:theme'
export function readTheme() {
  try {
    return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export default createVuetify({
  components: {
    VApp,
    VMain,
    VBtn,
    VCard,
    VChip,
    VSwitch,
    VSnackbar,
    VAlert,
    VProgressCircular,
    VProgressLinear,
    VDialog,
    VMenu,
  },
  defaults: {
    VBtn: { rounded: 'lg', elevation: 0, style: 'text-transform: none; letter-spacing: 0;' },
    VCard: { rounded: 'xl', elevation: 0 },
  },
  theme: {
    defaultTheme: readTheme(),
    themes: {
      light: {
        dark: false,
        colors: {
          primary: '#0069c1',
          'on-primary': '#ffffff',
          background: '#f6fafc',
          surface: '#ffffff',
          'on-surface': '#131e2b',
          secondary: '#547090',
          success: '#267c65',
          error: '#b63838',
        },
      },
      dark: {
        dark: true,
        colors: {
          primary: '#4c9deb',
          'on-primary': '#101c2c',
          background: '#0c121a',
          surface: '#151c26',
          'on-surface': '#eaeff5',
          secondary: '#9db0ca',
          success: '#81d2b6',
          error: '#ffb4ab',
        },
      },
    },
  },
})
