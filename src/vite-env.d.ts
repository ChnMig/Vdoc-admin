/// <reference types="vite/client" />

declare const __VDOC_ADMIN_BUILD_INFO__: {
  version: string
  gitCommit: string
  buildTime: string
}

interface ImportMetaEnv {
  readonly VITE_VDOC_API_BASE_URL: string
  readonly VITE_VDOC_PUBLIC_SHARE_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

type VdocAdminRuntimeConfig = {
  apiBaseUrl?: string
  publicShareBaseUrl?: string
  releaseChannel?: 'beta' | 'release'
}

interface Window {
  __VDOC_ADMIN_CONFIG__?: VdocAdminRuntimeConfig
}
