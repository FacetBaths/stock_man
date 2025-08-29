import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { Quasar, Loading, Notify, Dialog } from 'quasar'
import materialIcons from 'quasar/icon-set/material-icons'

// Import Quasar CSS before everything else
import 'quasar/dist/quasar.css'
import '@quasar/extras/material-icons/material-icons.css'
import '@quasar/extras/fontawesome-v6/fontawesome-v6.css'
import '@quasar/extras/material-symbols-outlined/material-symbols-outlined.css'

import AOS from 'aos'
import 'aos/dist/aos.css'
import App from './App.vue'
import router from './router'

// Debug utilities for development
if (import.meta.env.DEV) {
  import('./utils/auth-debug').then(({ debugTokenRefresh }) => {
    debugTokenRefresh()
  })
}

const app = createApp(App)

// Set up Quasar with automatic component registration
// By using the Quasar Vite plugin, all components should be auto-imported
app.use(Quasar, {
  plugins: [
    Loading,
    Notify,
    Dialog
  ],
  config: {
    brand: {
      primary: '#9945FF',
      secondary: '#14F195',
      accent: '#9C27B0',
      dark: '#1D1D1D',
      'dark-page': '#121212',
      positive: '#21BA45',
      negative: '#C10015',
      info: '#31CCEC',
      warning: '#F2C037'
    },
    notify: {
      position: 'top-right',
      timeout: 3000
    },
    loading: {
      delay: 200
    }
  },
  iconSet: materialIcons
})

// Then setup other plugins
app.use(createPinia())
app.use(router)

AOS.init({
  duration: 800,
  once: true,
  offset: 50
})

app.mount('#app')
