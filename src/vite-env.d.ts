/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the backend API. Baked in at build time via VITE_API_URL. */
  readonly VITE_API_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
