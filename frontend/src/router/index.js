import { createRouter, createWebHashHistory } from 'vue-router'
import { nextTick } from 'vue'
import { t } from '../locales'
import { account } from '../features/auth/scope.js'
import { restoreSession } from '../features/auth/session.js'

const router = createRouter({
  // Hash navigation works in Capacitor and on static hosting without rewrites.
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      meta: { guest: true },
      component: () => import('../views/AuthView.vue'),
    },
    {
      path: '/register',
      name: 'register',
      meta: { guest: true },
      component: () => import('../views/AuthView.vue'),
    },
    { path: '/profile', name: 'profile', component: () => import('../views/ProfileView.vue') },
    { path: '/', name: 'home', component: () => import('../views/HomeView.vue') },
    {
      path: '/document/:id',
      name: 'document',
      component: () => import('../views/DocumentView.vue'),
    },
    { path: '/scan', name: 'scan', component: () => import('../views/ScanView.vue') },
    {
      path: '/documents',
      name: 'documents',
      component: () => import('../views/DocumentsView.vue'),
    },
    {
      path: '/collections',
      name: 'collections',
      component: () => import('../views/CollectionsView.vue'),
    },
    { path: '/settings', name: 'settings', component: () => import('../views/SettingsView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})
router.beforeEach(async (to) => {
  await restoreSession()
  if (!account.value && !to.meta.guest) return { name: 'login' }
  if (account.value && to.meta.guest) return { name: 'home' }
})
router.afterEach(async (to, from) => {
  document.title = `${t(`nav.${to.name}`)} · ${t('app.name')}`
  if (!from.name || (from.name === 'scan' && to.name === 'scan')) return
  await nextTick()
  const content = document.getElementById('main-content')
  content?.scrollTo(0, 0)
  if (from.name !== to.name || from.path !== to.path)
    content?.querySelector('.page-heading h1')?.focus({ preventScroll: true })
})
export default router
