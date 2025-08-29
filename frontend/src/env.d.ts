/// <reference types="vite/client" />
/// <reference types="quasar" />

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

// Quasar provides its own TypeScript definitions
// No manual component declarations needed - let Quasar handle its own types

export {}
