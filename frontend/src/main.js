import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import vuetify from './plugins/vuetify'
import { setupPwa } from './composables/usePwa'
import { setupAndroid } from './platform/android'
import './styles/main.css'

const app = createApp(App)
app.use(router).use(vuetify)
router.isReady().then(async () => {
  app.mount('#app')
  await setupPwa()
  await setupAndroid(router)
})
