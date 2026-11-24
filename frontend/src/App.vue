<script setup>
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from './components/AppIcon.vue'
import AppHeader from './components/AppHeader.vue'
import { t } from './locales'
import { useAppearance } from './composables/useAppearance'
import { usePwa } from './composables/usePwa'
import { useScanSession } from './features/scanning/useScanSession'
import { startStorage } from './features/storage/sync.js'
import { account } from './features/auth/scope.js'
import { checkingSession } from './features/auth/session.js'

const route = useRoute()
const router = useRouter()
const activeView = shallowRef(null)
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
watch(
  account,
  (user, previous) => {
    if (user) startStorage()
    else if (previous && !navigator.onLine) router.replace({ name: 'login' })
  },
  { immediate: true },
)
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
  { name: 'home', icon: 'home' },
  { name: 'documents', icon: 'documents' },
  { name: 'collections', icon: 'folder' },
]
const isScanning = computed(() => route.name === 'scan')
const showNavigation = computed(() => navigation.some((item) => item.name === route.name))
const showBack = computed(
  () =>
    ['scan', 'document', 'settings', 'profile'].includes(route.name) ||
    (route.name === 'collections' && typeof route.query.collection === 'string'),
)
function goBack() {
  if (!['settings', 'profile'].includes(route.name)) return activeView.value?.goBack?.()
  if (router.options.history.state.back) router.back()
  else router.replace({ name: 'home' })
}
</script>

<template>
  <v-app>
    <a href="#main-content" class="skip-link" @click.prevent="focusMain">{{ t('app.skip') }}</a>
    <div class="workspace" :class="{ 'scan-shell': isScanning }">
      <AppHeader
        :back="showBack"
        :back-disabled="activeView?.backDisabled"
        :offline="!online"
        @back="goBack"
      >
        <template v-if="!isScanning">
          <RouterLink
            v-if="account && route.name !== 'profile'"
            :to="{ name: 'profile' }"
            class="icon-button"
            :aria-label="t('nav.profile')"
            ><AppIcon name="profile" size="var(--icon-size)"
          /></RouterLink>
          <RouterLink
            v-if="account && route.name !== 'settings'"
            :to="{ name: 'settings' }"
            class="icon-button"
            :aria-label="t('nav.settings')"
            ><AppIcon name="settings" size="var(--icon-size)"
          /></RouterLink>
          <button
            v-if="!account || route.name === 'settings'"
            type="button"
            class="icon-button theme-toggle"
            :aria-label="t(isDark ? 'settings.light' : 'settings.dark')"
            @click="setTheme(isDark ? 'light' : 'dark')"
          >
            <AppIcon :name="isDark ? 'sun' : 'moon'" size="var(--icon-size)" />
          </button>
        </template>
      </AppHeader>
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
        <div v-if="checkingSession" class="account-loading" role="status">
          <v-progress-circular indeterminate size="26" color="primary" />
          <span>Pārbauda sesiju…</span>
        </div>
        <RouterView v-else-if="account || route.meta.guest" v-slot="{ Component }">
          <component
            :is="Component"
            :key="route.meta.guest ? route.name : 'workspace'"
            ref="activeView"
          />
        </RouterView>
      </v-main>
      <nav v-if="account && showNavigation" class="bottom-nav" :aria-label="t('app.navigation')">
        <RouterLink v-for="item in navigation" :key="item.name" :to="{ name: item.name }">
          <span class="bottom-icon"><AppIcon :name="item.icon" size="var(--icon-nav)" /></span>
          <span>{{ t(`nav.${item.name}`) }}</span>
        </RouterLink>
      </nav>
      <div id="app-footer"></div>
    </div>
  </v-app>
</template>

<style scoped>
.account-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding-block: 3rem;
}
</style>
