import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders, screen, waitFor } from '@/test/test-utils'
import Congress from '@/pages/Congress'
import type {
  CongressActivity,
  CongressLeaderboard,
  CongressLeaderboardEntry,
  CongressTrade,
} from '@/lib/api'

const trade = (overrides: Partial<CongressTrade> = {}): CongressTrade => ({
  member: 'Nancy Pelosi',
  chamber: 'House',
  party: null,
  ticker: 'NVDA',
  name: 'NVIDIA Corporation',
  tx_type: 'Purchase',
  amount_range: '$1,000,001 - $5,000,000',
  amount_midpoint: 3_000_000,
  transaction_date: '2026-06-20',
  disclosure_date: '2026-07-02',
  owner: 'Spouse',
  source_url: null,
  is_buy: true,
  is_sell: false,
  ...overrides,
})

const board = (
  overrides: Partial<CongressActivity> = {},
): CongressActivity => ({
  window: '30d',
  total: 2,
  limit: 50,
  offset: 0,
  count: 2,
  summary: {
    buy_count: 1,
    sell_count: 1,
    buy_value: 3_000_000,
    sell_value: 32_500,
    net_value: 2_967_500,
  },
  items: [
    trade(),
    trade({
      member: 'Tommy Tuberville',
      chamber: 'Senate',
      ticker: 'LMT',
      tx_type: 'Sale',
      amount_range: '$15,001 - $50,000',
      amount_midpoint: 32_500,
      is_buy: false,
      is_sell: true,
    }),
  ],
  ...overrides,
})

const entry = (
  overrides: Partial<CongressLeaderboardEntry> = {},
): CongressLeaderboardEntry => ({
  ticker: 'AAPL',
  name: 'Apple Inc.',
  trade_count: 9,
  member_count: 6,
  buy_count: 5,
  sell_count: 4,
  buy_value: 4_000_000,
  sell_value: 1_000_000,
  net_value: 3_000_000,
  total_value: 5_000_000,
  last_activity: '2026-07-05',
  ...overrides,
})

// Distinct tickers from the trades board above so each ticker stays unambiguous.
const leaderboard = (
  overrides: Partial<CongressLeaderboard> = {},
): CongressLeaderboard => ({
  window: '30d',
  metric: 'members',
  total: 42,
  count: 2,
  items: [
    entry(),
    entry({
      ticker: 'MSFT',
      name: 'Microsoft Corp.',
      member_count: 4,
      trade_count: 5,
    }),
  ],
  ...overrides,
})

const calls: string[] = []

// The page loads the trades board and the attention leaderboard together, so route
// each fetch to the payload for its own endpoint.
function stub({
  activity = board(),
  ranked = leaderboard(),
  fail = false,
}: {
  activity?: CongressActivity
  ranked?: CongressLeaderboard
  fail?: boolean
} = {}) {
  calls.length = 0
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string | URL) => {
      const u = String(url)
      calls.push(u)
      if (fail) {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ detail: 'Congress feed unavailable.' }),
        })
      }
      const payload = u.includes('/market/congress-leaderboard')
        ? ranked
        : activity
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(payload),
      })
    }),
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('Congress trades board', () => {
  it('lists disclosed trades with the member, ticker and direction', async () => {
    stub()
    renderWithProviders(<Congress />)

    expect(await screen.findByText('Nancy Pelosi')).toBeInTheDocument()
    expect(screen.getByText('Tommy Tuberville')).toBeInTheDocument()
    expect(screen.getByText('NVDA')).toBeInTheDocument()
    expect(screen.getByText('Buy')).toBeInTheDocument()
    expect(screen.getByText('Sell')).toBeInTheDocument()
    // Defaults to the 30-day disclosure window.
    expect(calls.some((u) => u.includes('/market/congress-activity'))).toBe(
      true,
    )
    expect(calls.some((u) => u.includes('window=30d'))).toBe(true)
    // The window total line is shown.
    expect(
      screen.getByText(/trades disclosed in this window/i),
    ).toBeInTheDocument()
  })

  it('re-queries when the disclosure window changes', async () => {
    stub()
    const { user } = renderWithProviders(<Congress />)

    await screen.findByText('Nancy Pelosi')
    await user.click(screen.getByRole('button', { name: '7D' }))

    await waitFor(() =>
      expect(calls.some((u) => u.includes('window=7d'))).toBe(true),
    )
  })

  it('shows an empty state when the window has no trades', async () => {
    stub({
      activity: board({ total: 0, count: 0, items: [] }),
      ranked: leaderboard({ total: 0, count: 0, items: [] }),
    })
    renderWithProviders(<Congress />)

    expect(
      await screen.findByText(/no congressional trades in this window/i),
    ).toBeInTheDocument()
  })

  it('surfaces an error when the request fails', async () => {
    stub({ fail: true })
    renderWithProviders(<Congress />)

    const alerts = await screen.findAllByRole('alert')
    expect(
      alerts.some((a) =>
        /congress feed unavailable/i.test(a.textContent ?? ''),
      ),
    ).toBe(true)
  })

  it('links each ticker to its stock detail page', async () => {
    stub()
    renderWithProviders(<Congress />)

    const link = await screen.findByRole('link', { name: /view NVDA details/i })
    expect(link).toHaveAttribute('href', '/search?symbol=NVDA')
  })
})

describe('Congress attention leaderboard', () => {
  it('ranks the stocks getting the most attention', async () => {
    stub()
    renderWithProviders(<Congress />)

    expect(screen.getByText(/getting the most attention/i)).toBeInTheDocument()
    // The top-ranked stocks render as cards, distinct from the trades table
    // (await the data-driven cards, not the static heading).
    expect(
      await screen.findByRole('link', { name: /view AAPL details/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /view MSFT details/i }),
    ).toBeInTheDocument()
    // Defaults to ranking by distinct members, and reports the universe size.
    expect(
      screen.getByText(/42 stocks traded this window/i),
    ).toBeInTheDocument()
    expect(
      calls.some(
        (u) =>
          u.includes('/market/congress-leaderboard') &&
          u.includes('metric=members') &&
          u.includes('limit=12'),
      ),
    ).toBe(true)
  })

  it('re-ranks when the metric changes', async () => {
    stub()
    const { user } = renderWithProviders(<Congress />)

    await screen.findByText('AAPL')
    await user.click(screen.getByRole('button', { name: 'Trades' }))

    await waitFor(() =>
      expect(
        calls.some(
          (u) =>
            u.includes('/market/congress-leaderboard') &&
            u.includes('metric=trades'),
        ),
      ).toBe(true),
    )
  })

  it('links a ranked stock to its detail page', async () => {
    stub()
    renderWithProviders(<Congress />)

    const link = await screen.findByRole('link', { name: /view AAPL details/i })
    expect(link).toHaveAttribute('href', '/search?symbol=AAPL')
  })
})
