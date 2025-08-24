import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { Quasar, Loading, Notify, Dialog } from 'quasar'
import materialIcons from 'quasar/icon-set/material-icons'
import '@quasar/extras/material-icons/material-icons.css'
import '@quasar/extras/fontawesome-v6/fontawesome-v6.css'
import '@quasar/extras/material-symbols-outlined/material-symbols-outlined.css'
import 'quasar/dist/quasar.css'
import AOS from 'aos'
import 'aos/dist/aos.css'
import App from './App.vue'
import router from './router'

const app = createApp(App)

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
    }
  },
  iconSet: materialIcons
})

app.use(createPinia())
app.use(router)

AOS.init({
  duration: 800,
  once: true,
  offset: 50
})

app.mount('#app')
