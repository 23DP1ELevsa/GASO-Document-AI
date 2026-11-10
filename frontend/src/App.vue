<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import AppIcon from './components/AppIcon.vue'
import { t } from './locales'
import { useAppearance } from './composables/useAppearance'
import { usePwa } from './composables/usePwa'
import { useScanSession } from './features/scanning/useScanSession'

const route = useRoute()
const { isDark, setTheme, storageUnavailable } = useAppearance()
const { updateAvailable, offlineError, update } = usePwa()
const { hasUnsavedChanges } = useScanSession()
const protectChanges = (event) => {
  if (hasUnsavedChanges.value) {
    event.preventDefault()
    event.returnValue = ''
  }
}
const updateSafely = () => {
  if (!hasUnsavedChanges.value || window.confirm(t('scan.confirmDiscard'))) update()
}
const online = ref(navigator.onLine)
const connectionChanged = () => {
  online.value = navigator.onLine
}
const focusMain = () => document.getElementById('main-content')?.focus()
const focusHeading = () => document.querySelector('main h1')?.focus({ preventScroll: true })
onMounted(() => {
  window.addEventListener('online', connectionChanged)
  window.addEventListener('offline', connectionChanged)
  window.addEventListener('beforeunload', protectChanges)
})
onUnmounted(() => {
  window.removeEventListener('online', connectionChanged)
  window.removeEventListener('offline', connectionChanged)
  window.removeEventListener('beforeunload', protectChanges)
})
const navigation = [
  { name: 'home', path: '/' },
  { name: 'scan', path: '/scan' },
  { name: 'documents', path: '/documents' },
  { name: 'settings', path: '/settings' },
]
</script>

<template>
  <v-app>
    <a href="#main-content" class="skip-link" @click.prevent="focusMain">{{ t('app.skip') }}</a>
    <aside class="sidebar">
      <RouterLink to="/" class="brand" :aria-label="t('app.name')"
        ><span class="brand-mark"><AppIcon name="scan" :size="26" /></span
        ><span
          ><strong>{{ t('app.brand') }}</strong
          ><small>{{ t('app.shortName') }}</small></span
        ></RouterLink
      >
      <p class="sidebar-caption">{{ t('app.workspace') }}</p>
      <nav :aria-label="t('app.navigation')" class="side-nav">
        <RouterLink
          v-for="item in navigation"
          :key="item.name"
          :to="item.path"
          :class="{ selected: route.name === item.name }"
          ><AppIcon :name="item.name" /><span>{{ t(`nav.${item.name}`) }}</span
          ><span v-if="route.name === item.name" class="nav-dot"
        /></RouterLink>
      </nav>
      <div class="sidebar-bottom">
        <div class="sidebar-local">
          <AppIcon name="shield" /><span>{{ t('app.local') }}</span
          ><span class="status-dot" />
        </div>
        <p>{{ t('app.footer') }}</p>
        <span class="prototype-label">{{ t('app.prototype') }} · 0.1</span>
      </div>
    </aside>

    <div class="workspace">
      <header class="topbar">
        <RouterLink to="/" class="mobile-brand"
          ><span class="brand-mark"><AppIcon name="scan" /></span
          ><strong>{{ t('app.name') }}</strong></RouterLink
        >
        <span class="desktop-section">{{ t(`nav.${route.name || 'home'}`) }}</span>
        <div class="topbar-actions">
          <span class="local-badge"><span class="status-dot" />{{ t('app.local') }}</span
          ><span v-if="!online" class="offline-badge"
            ><AppIcon name="offline" :size="16" />{{ t('app.offline') }}</span
          ><v-btn
            class="theme-toggle"
            variant="text"
            :aria-label="t(isDark ? 'settings.light' : 'settings.dark')"
            @click="setTheme(isDark ? 'light' : 'dark')"
            ><AppIcon :name="isDark ? 'sun' : 'moon'" :size="20"
          /></v-btn>
        </div>
      </header>
      <v-main id="main-content" class="main-content" tabindex="-1">
        <div v-if="updateAvailable" class="update-banner" role="status">
          <span>{{ t('pwa.update') }}</span
          ><v-btn size="small" color="primary" @click="updateSafely">{{ t('pwa.reload') }}</v-btn>
        </div>
        <v-alert v-if="storageUnavailable" type="warning" variant="tonal" class="mb-4">{{
          t('app.storageWarning')
        }}</v-alert>
        <v-alert v-if="offlineError" type="warning" variant="tonal" class="mb-4">{{
          t('pwa.error')
        }}</v-alert>
        <RouterView v-slot="{ Component }"
          ><Transition name="page" mode="out-in" @after-enter="focusHeading"
            ><component :is="Component" /></Transition
        ></RouterView>
        <footer class="workspace-footer">
          <span>{{ t('app.name') }}</span
          ><span>{{ t('app.prototype') }} <span class="footer-dot">·</span> v0.1.0</span>
        </footer>
      </v-main>
    </div>

    <nav class="bottom-nav" :aria-label="t('app.navigation')">
      <RouterLink
        v-for="item in navigation"
        :key="item.name"
        :to="item.path"
        :class="{ selected: route.name === item.name }"
        ><span class="bottom-icon"><AppIcon :name="item.name" :size="23" /></span
        ><span>{{ t(`nav.${item.name}`) }}</span></RouterLink
      >
    </nav>
  </v-app>
</template>
