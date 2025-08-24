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
    QCardActions: any
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
    QPage: any
    QScrollArea: any
    QExpansionItem: any
    QCheckbox: any
    QRadio: any
    QToggle: any
    QSlider: any
    QRange: any
    QTime: any
    QDate: any
    QPopupProxy: any
    QBanner: any
    QBar: any
    QBreadcrumbs: any
    QBreadcrumbsEl: any
    QCarousel: any
    QCarouselControl: any
    QCarouselSlide: any
    QChatMessage: any
    QCircularProgress: any
    QColor: any
    QDrawer: any
    QEditor: any
    QFab: any
    QFabAction: any
    QField: any
    QFile: any
    QFooter: any
    QForm: any
    QImg: any
    QInfiniteScroll: any
    QIntersection: any
    QKnob: any
    QMarkupTable: any
    QNoSsr: any
    QOptionGroup: any
    QPagination: any
    QParallax: any
    QPopupEdit: any
    QPullToRefresh: any
    QRating: any
    QResizeObserver: any
    QResponsive: any
    QRouteTab: any
    QScrollObserver: any
    QSkeleton: any
    QSlideItem: any
    QSlideTransition: any
    QSplitter: any
    QSplitterPanel: any
    QStep: any
    QStepper: any
    QStepperNavigation: any
    QTab: any
    QTabPanel: any
    QTabPanels: any
    QTabs: any
    QTimeline: any
    QTimelineEntry: any
    QToolbarTitle: any
    QTree: any
    QUploader: any
    QVideo: any
    QVirtualScroll: any
  }
}

export {}
