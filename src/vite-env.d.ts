/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_VDOC_API_BASE_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

type VdocAdminRuntimeConfig = {
  apiBaseUrl?: string
}

interface Window {
  __VDOC_ADMIN_CONFIG__?: VdocAdminRuntimeConfig
}
