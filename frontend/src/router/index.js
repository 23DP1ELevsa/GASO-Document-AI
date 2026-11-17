import { createRouter, createWebHashHistory } from 'vue-router'
import { nextTick } from 'vue'
import { t } from '../locales'

const router = createRouter({
  // Hash navigation works in Capacitor and on static hosting without rewrites.
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: () => import('../views/HomeView.vue') },
    { path:'/document/:id', name:'document', component:()=>import('../views/DocumentView.vue') },
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
  scrollBehavior: () => ({ top: 0 }),
})
router.afterEach(async (to, from) => {
  document.title = `${t(`nav.${to.name}`)} · ${t('app.name')}`
  await nextTick()
  if (from.name) document.querySelector('h1')?.focus({ preventScroll: true })
})
export default router
