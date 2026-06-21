/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // Dev only: proxy "/api/*" to the real backend so requests are same-origin and
  // not blocked by CORS. The client uses a relative "/api" base in dev (see
  // src/lib/api.ts); production bakes the absolute VITE_API_URL at build time.
  server: {
    proxy: {
      '/api': {
        target: 'https://api.namainsights.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
})
