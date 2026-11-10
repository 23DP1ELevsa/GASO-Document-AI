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
          primary: '#2458d3',
          background: '#f5f7fb',
          surface: '#ffffff',
          'on-surface': '#1a2942',
          secondary: '#547090',
          success: '#267c65',
          error: '#b63838',
        },
      },
      dark: {
        dark: true,
        colors: {
          primary: '#9bb8ff',
          background: '#101722',
          surface: '#192333',
          'on-surface': '#e5edf9',
          secondary: '#9db0ca',
          success: '#81d2b6',
          error: '#ffb4ab',
        },
      },
    },
  },
})
