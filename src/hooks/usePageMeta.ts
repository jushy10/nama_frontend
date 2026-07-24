import { useEffect } from 'react'

/**
 * Give the current SPA route its own `<title>` and `<meta name="description">`.
 *
 * The app is a client-rendered SPA, so `index.html` ships a single static title for
 * every route. This sets a distinct, page-appropriate title + description on mount — a
 * real per-page browser-tab title, and metadata Googlebot (which renders JS) reads.
 *
 * Note the ceiling: JS-blind crawlers (most AI crawlers) still don't see this, because
 * they don't run our JavaScript. The genuinely crawlable, indexable surface is the
 * backend-rendered content pages (`/stock`, `/etf`, `/sector`, `/screen`); this just
 * lifts the app's *own* routes above one shared title. Upserts the description tag so it
 * works whether or not `index.html` already carries one.
 */
export function usePageMeta(title: string, description?: string): void {
  useEffect(() => {
    document.title = title
    if (description === undefined) return
    let meta = document.head.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    )
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'description'
      document.head.appendChild(meta)
    }
    meta.content = description
  }, [title, description])
}
