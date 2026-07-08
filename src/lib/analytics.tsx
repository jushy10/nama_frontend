import { useEffect, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import posthog from 'posthog-js'

// PostHog project (client) API key + host, baked in at build time by Vite from
// deploy.yml's env (see README). The key is a *publishable* ingestion key — it's
// meant to ship in the browser bundle, so it's a config value, not a secret.
// It's absent in dev, tests, and PR builds, and that absence is the single
// switch that keeps analytics off everywhere except the deployed site.
const POSTHOG_KEY = import.meta.env.VITE_PUBLIC_POSTHOG_KEY
const POSTHOG_HOST =
  import.meta.env.VITE_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'

/**
 * True only when a PostHog key is configured — i.e. the production build. Every
 * capture path short-circuits on this, so dev/test/PR builds send nothing and
 * PostHog is never even initialized there.
 */
export const analyticsEnabled = Boolean(POSTHOG_KEY)

let initialized = false

/** Initialize PostHog once, on first mount of the provider. */
function ensureInitialized(): void {
  // Guard on the key itself (not analyticsEnabled) so TypeScript narrows it from
  // `string | undefined` to `string` for the init call below.
  if (!POSTHOG_KEY || initialized) return
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    // This is a client-side SPA: React Router swaps pages without a full reload,
    // so PostHog's automatic pageview (which only fires on hard loads) would
    // miss every in-app navigation. We disable it and capture $pageview
    // ourselves on each route change instead (see usePageViews).
    capture_pageview: false,
    // Don't persist a person profile for anonymous visitors — cheaper and
    // privacy-friendlier. Unique-visitor counts still work off the anonymous
    // device id; profiles would begin only if we ever call posthog.identify()
    // (e.g. after adding login).
    person_profiles: 'identified_only',
  })
  initialized = true
}

/**
 * Capture a $pageview on every client-side route change. Runs on mount too, so
 * the initial page load is counted.
 */
function usePageViews(): void {
  const location = useLocation()
  useEffect(() => {
    if (!analyticsEnabled) return
    posthog.capture('$pageview')
  }, [location.pathname, location.search])
}

/**
 * Wraps the app: initializes PostHog once (when enabled) and tracks SPA
 * pageviews. A transparent passthrough when no key is configured, so it's safe
 * to mount unconditionally. Must render inside a Router — it reads useLocation.
 */
export function AnalyticsProvider({ children }: { children: ReactNode }) {
  // Registered before usePageViews' effect below, so init runs before the first
  // pageview capture on mount.
  useEffect(() => {
    ensureInitialized()
  }, [])
  usePageViews()
  return <>{children}</>
}

/**
 * Record a named product event, e.g.
 * `trackEvent('stock_viewed', { ticker: 'AAPL' })`. Autocapture already logs
 * pageviews and generic clicks; reserve this for the handful of meaningful
 * actions worth naming and querying. A no-op when analytics is disabled.
 */
export function trackEvent(
  event: string,
  properties?: Record<string, unknown>,
): void {
  if (!analyticsEnabled) return
  posthog.capture(event, properties)
}
