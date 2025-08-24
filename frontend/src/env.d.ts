/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/ban-types
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_APP_VERSION?: string
  readonly VITE_BUILD_TIME?: string
  readonly VITE_GIT_COMMIT?: string
  readonly VITE_GIT_BRANCH?: string
  readonly VITE_BUILD_NUMBER?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Quasar global component registration for TypeScript
declare module '@vue/runtime-core' {
  export interface GlobalComponents {
    QApp: any
    QLayout: any
    QHeader: any
    QToolbar: any
    QBtn: any
    QBtnGroup: any
    QCard: any
    QCardSection: any
    QIcon: any
    QInput: any
    QSelect: any
    QTable: any
    QTd: any
    QTh: any
    QTr: any
    QChip: any
    QDialog: any
    QMenu: any
    QList: any
    QItem: any
    QItemSection: any
    QItemLabel: any
    QSeparator: any
    QSpace: any
    QAvatar: any
    QPageContainer: any
    QInnerLoading: any
    QTooltip: any
    QBadge: any
    QSpinner: any
    QLinearProgress: any
  }
}

export {}
