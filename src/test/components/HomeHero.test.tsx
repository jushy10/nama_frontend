import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders, screen } from '@/test/test-utils'
import HomeHero from '@/components/HomeHero'

// Index-proxy quote cards for the hero's live snapshot, keyed by ETF ticker.
const QUOTES: Record<
  string,
  { price: number; change: number; change_percent: number }
> = {
  SPY: { price: 731.88, change: -1.74, change_percent: -0.24 },
  QQQ: { price: 706.47, change: 7.11, change_percent: 1.0 },
  DIA: { price: 452.1, change: 0.9, change_percent: 0.2 },
}

const SENTIMENT = {
  vix: {
    as_of: '2026-07-13',
    value: 17.16,
    previous_close: 15.03,
    change: 2.13,
    change_percent: 14.17,
    regime: 'normal',
  },
  fear_greed: {
    score: 43.14,
    as_of: '2026-07-14T22:39:44Z',
    rating: 'fear',
    band: 'fear',
    label: 'Fear',
    previous_close: 43.71,
    previous_1_week: 40.0,
    previous_1_month: 35.51,
    previous_1_year: 76.11,
  },
}

/**
 * Answers the snapshot's reads — the index-proxy quotes (ETF endpoint) and the
 * market-sentiment leg — so the hero renders live figures instead of the
 * unavailable state. Anything else 404s.
 */
function stubFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string | URL) => {
      const u = String(url)
      let data: unknown
      const etf = u.match(/\/stocks\/etf\/([^/?]+)/)
      if (etf) data = QUOTES[etf[1]]
      else if (u.includes('/market/sentiment')) data = SENTIMENT
      return Promise.resolve({
        ok: data != null,
        status: data != null ? 200 : 404,
        json: () => Promise.resolve(data ?? { detail: 'No data.' }),
      })
    }),
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('HomeHero', () => {
  it('renders the headline, the market-status eyebrow, the search box, and the jumps', () => {
    stubFetch()
    renderWithProviders(<HomeHero />)

    // The two-tone headline (its accent phrase "driven by AI" is a separate
    // span, so match the concatenated text).
    expect(
      screen.getByRole('heading', { level: 1, name: /driven by ai/i }),
    ).toBeInTheDocument()

    // The eyebrow carries the live market phase and today's compact date, set
    // in mono like a ticker, e.g. "Market Closed · Tue, Jul 10".
    expect(
      screen.getByText(/\b(mon|tue|wed|thu|fri|sat|sun), [a-z]{3} \d{1,2}\b/i),
    ).toBeInTheDocument()

    // The primary action is the universe search box itself.
    expect(
      screen.getByPlaceholderText(/search a stock or etf/i),
    ).toBeInTheDocument()

    // The secondary CTAs link into the app.
    expect(
      screen.getByRole('link', { name: /open the screener/i }),
    ).toHaveAttribute('href', '/screener')
    expect(screen.getByRole('link', { name: /heat map/i })).toHaveAttribute(
      'href',
      '/heatmap',
    )
  })

  it('carries a live "market at a glance" snapshot beside the search', async () => {
    stubFetch()
    renderWithProviders(<HomeHero />)

    // The snapshot's title + the index proxies with their day move.
    expect(await screen.findByText(/market at a glance/i)).toBeInTheDocument()
    expect(await screen.findByText('S&P 500')).toBeInTheDocument()
    expect(await screen.findByText('-0.24%')).toBeInTheDocument()

    // The compact Fear & Greed + VIX footer lands once sentiment resolves.
    expect(await screen.findByText('Fear & Greed')).toBeInTheDocument()
    expect(await screen.findByText('43')).toBeInTheDocument()
    expect(await screen.findByText('17.2')).toBeInTheDocument()
  })
})
