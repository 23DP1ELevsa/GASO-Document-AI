import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import vuetify from './plugins/vuetify'
import { setupPwa } from './composables/usePwa'
import { setupAndroid } from './platform/android'
import './styles/main.css'
import './styles/mobile.css'

const app = createApp(App)
app.use(router).use(vuetify)
app.mount('#app')
router.isReady().then(async () => {
  await setupPwa()
  await setupAndroid(router)
})
