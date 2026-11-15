<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from './components/AppIcon.vue'
import MobileHeader from './components/MobileHeader.vue'
import { t } from './locales'
import { useAppearance } from './composables/useAppearance'
import { usePwa } from './composables/usePwa'
import { useScanSession } from './features/scanning/useScanSession'

const route = useRoute()
const router = useRouter()
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
  { name: 'documents', path: '/documents' },
]
</script>

<template>
  <v-app>
    <a href="#main-content" class="skip-link" @click.prevent="focusMain">{{ t('app.skip') }}</a>
    <div class="workspace" :class="{ 'scan-shell': route.name === 'scan' }">
      <MobileHeader
        v-if="route.name !== 'scan'"
        :brand="route.name === 'home'"
        :title="t(`nav.${route.name || 'home'}`)"
        :subtitle="route.name === 'documents' ? 'Saglabāti tikai šajā ierīcē' : undefined"
        :back="route.name === 'settings'"
        @back="router.back()"
      >
        <span v-if="!online" class="offline-badge"
          ><AppIcon name="offline" :size="16" /><span class="sr-only">{{
            t('app.offline')
          }}</span></span
        >
        <RouterLink
          v-if="route.name !== 'settings'"
          to="/settings"
          class="icon-button"
          aria-label="Iestatījumi"
          ><AppIcon name="settings" :size="20"
        /></RouterLink>
        <button
          v-else
          class="icon-button theme-toggle"
          :aria-label="t(isDark ? 'settings.light' : 'settings.dark')"
          @click="setTheme(isDark ? 'light' : 'dark')"
        >
          <AppIcon :name="isDark ? 'sun' : 'moon'" :size="20" />
        </button>
      </MobileHeader>
      <v-main id="main-content" class="main-content" tabindex="-1">
        <p v-if="!online && route.name === 'scan'" class="offline-badge scan-offline" role="status">
          <AppIcon name="offline" :size="16" />{{ t('app.offline') }}
        </p>
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
        <RouterView v-slot="{ Component }"><component :is="Component" /></RouterView>
      </v-main>
    </div>

    <nav
      v-if="route.name === 'home' || route.name === 'documents'"
      class="bottom-nav"
      :aria-label="t('app.navigation')"
    >
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
