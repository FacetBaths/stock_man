import { createApp } from 'vue'
import { createPinia } from 'pinia'
import {
  Quasar,
  Loading,
  Notify,
  Dialog,
  QApp,
  QLayout,
  QHeader,
  QToolbar,
  QBtn,
  QBtnGroup,
  QCard,
  QCardSection,
  QIcon,
  QInput,
  QSelect,
  QTable,
  QTd,
  QTh,
  QTr,
  QChip,
  QDialog,
  QMenu,
  QList,
  QItem,
  QItemSection,
  QItemLabel,
  QSeparator,
  QSpace,
  QAvatar,
  QPageContainer,
  QInnerLoading,
  QTooltip,
  QBadge,
  QSpinner,
  QLinearProgress
} from 'quasar'
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

const app = createApp(App)

// Register Quasar components explicitly
app.component('QApp', QApp)
app.component('QLayout', QLayout)
app.component('QHeader', QHeader)
app.component('QToolbar', QToolbar)
app.component('QBtn', QBtn)
app.component('QBtnGroup', QBtnGroup)
app.component('QCard', QCard)
app.component('QCardSection', QCardSection)
app.component('QIcon', QIcon)
app.component('QInput', QInput)
app.component('QSelect', QSelect)
app.component('QTable', QTable)
app.component('QTd', QTd)
app.component('QTh', QTh)
app.component('QTr', QTr)
app.component('QChip', QChip)
app.component('QDialog', QDialog)
app.component('QMenu', QMenu)
app.component('QList', QList)
app.component('QItem', QItem)
app.component('QItemSection', QItemSection)
app.component('QItemLabel', QItemLabel)
app.component('QSeparator', QSeparator)
app.component('QSpace', QSpace)
app.component('QAvatar', QAvatar)
app.component('QPageContainer', QPageContainer)
app.component('QInnerLoading', QInnerLoading)
app.component('QTooltip', QTooltip)
app.component('QBadge', QBadge)
app.component('QSpinner', QSpinner)
app.component('QLinearProgress', QLinearProgress)

// Set up Quasar with plugins
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
