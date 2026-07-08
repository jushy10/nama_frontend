import { beforeEach, describe, expect, it, vi } from 'vitest'
import posthog from 'posthog-js'
import { renderWithProviders, screen } from '@/test/test-utils'
import {
  AnalyticsProvider,
  analyticsEnabled,
  trackEvent,
} from '@/lib/analytics'

// Mock the SDK so the module wires against spies — no real network — and we can
// assert nothing is sent while analytics is disabled. vi.mock is hoisted above
// the imports, so both this file and the analytics module see the mock.
vi.mock('posthog-js', () => ({
  default: { init: vi.fn(), capture: vi.fn() },
}))

// There's no VITE_PUBLIC_POSTHOG_KEY in the test env, so analytics is disabled —
// which is exactly the contract these tests lock in: off unless a key is
// configured, so dev, tests, and PR builds send nothing.
describe('analytics (no PostHog key configured)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('is disabled without a key', () => {
    expect(analyticsEnabled).toBe(false)
  })

  it('trackEvent sends nothing while disabled', () => {
    trackEvent('ticker_viewed', { ticker: 'AAPL' })
    expect(posthog.capture).not.toHaveBeenCalled()
  })

  it('AnalyticsProvider renders children without initializing PostHog', () => {
    renderWithProviders(
      <AnalyticsProvider>
        <span>child content</span>
      </AnalyticsProvider>,
    )
    expect(screen.getByText('child content')).toBeInTheDocument()
    expect(posthog.init).not.toHaveBeenCalled()
    expect(posthog.capture).not.toHaveBeenCalled()
  })
})
