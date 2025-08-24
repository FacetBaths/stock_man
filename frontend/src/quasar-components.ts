// Manual Quasar component registration
// This is a workaround for Vite auto-import issues
import type { App } from 'vue'

// Import all the Quasar components we actually use (excluding QApp which is auto-registered)
import {
  QLayout,
  QHeader,
  QToolbar,
  QBtn,
  QBtnGroup,
  QCard,
  QCardSection,
  QCardActions,
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

export function registerQuasarComponents(app: App) {
  // Register each component globally (QApp is registered automatically by Quasar)
  app.component('QLayout', QLayout)
  app.component('QHeader', QHeader)
  app.component('QToolbar', QToolbar)
  app.component('QBtn', QBtn)
  app.component('QBtnGroup', QBtnGroup)
  app.component('QCard', QCard)
  app.component('QCardSection', QCardSection)
  app.component('QCardActions', QCardActions)
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
}
