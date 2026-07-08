/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the backend API. Baked in at build time via VITE_API_URL. */
  readonly VITE_API_URL: string
  /**
   * PostHog project (client) API key. Baked in at build time (deploy.yml). When
   * absent — dev, tests, PR builds — analytics stays off entirely.
   */
  readonly VITE_PUBLIC_POSTHOG_KEY?: string
  /** PostHog API host; defaults to https://us.i.posthog.com when unset. */
  readonly VITE_PUBLIC_POSTHOG_HOST?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
