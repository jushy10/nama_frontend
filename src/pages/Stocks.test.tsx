import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders, screen } from '@/test/test-utils'
import Stocks from '@/pages/Stocks'

const sample = {
  symbol: 'NVDA',
  name: 'NVIDIA Corporation Common Stock',
  exchange: 'NASDAQ',
  price: 209.97,
  change: 5.27,
  change_percent: 2.57,
  open: 207.4,
  high: 211.385,
  low: 206.5,
  previous_close: 204.7,
  volume: 4026083,
  bid: 210.0,
  ask: 231.8,
  spread: 21.8,
  as_of: '2026-06-18T20:45:23.729548Z',
  market_cap: 3_210_000_000_000,
  dividend_per_share: 0.04,
  dividend_yield: 0.02,
  performance: {
    '1w': 3.1,
    '1m': -1.2,
    '3m': 8.4,
    '6m': 15.0,
    ytd: 22.3,
    '1y': 40.1,
  },
  drawdown_from_high: -24.5,
  metrics: {
    pe: 34.6,
    peg: 1.19,
    pb: 34.0,
    ps: 9.4,
    gross_margin: 47.9,
    operating_margin: 32.6,
    net_margin: 27.2,
    current_ratio: 1.07,
    debt_to_equity: 0.8,
    beta: 1.1,
    week_52_high: 317.4,
    week_52_low: 199.26,
  },
  growth: {
    revenue_yoy: 12.8,
    eps_yoy: 29.0,
    forward_revenue_growth: 16.6,
    forward_eps_growth: 15.2,
  },
}

const candlesSample = {
  symbol: 'NVDA',
  timeframe: '1Day',
  count: 2,
  candles: [
    {
      time: 1718668800,
      timestamp: '2026-06-17T00:00:00Z',
      open: 200,
      high: 210,
      low: 198,
      close: 205,
      volume: 1_000_000,
      direction: 'up',
    },
    {
      time: 1718755200,
      timestamp: '2026-06-18T00:00:00Z',
      open: 205,
      high: 212,
      low: 204,
      close: 209.97,
      volume: 1_200_000,
      direction: 'up',
    },
  ],
}

const rsiSample = {
  symbol: 'NVDA',
  timeframe: '1Day',
  period: 14,
  count: 3,
  latest: 22.81,
  signal: 'oversold',
  overbought: 70.0,
  oversold: 30.0,
  points: [
    { time: 1781582400, timestamp: '2026-06-16T04:00:00Z', value: 23.6 },
    { time: 1781668800, timestamp: '2026-06-17T04:00:00Z', value: 23.67 },
    { time: 1782273600, timestamp: '2026-06-24T04:00:00Z', value: 22.81 },
  ],
}

// The consolidated quarterly series (oldest → newest): two reported quarters
// plus two upcoming ones carrying the forward EPS/revenue consensus. Drives
// the beat charts + the next-report chip.
const quarterlyEarningsSample = {
  symbol: 'NVDA',
  count: 4,
  reported_count: 2,
  upcoming_count: 2,
  quarters: [
    {
      fiscal_year: 2026,
      fiscal_quarter: 3,
      period_end: '2025-11-20',
      report_date: '2025-11-19',
      eps_actual: 0.81,
      eps_estimate: 0.75,
      eps_surprise: 0.06,
      eps_surprise_percent: 8.0,
      revenue_estimate: null,
      revenue_actual: null,
      beat: true,
      is_reported: true,
    },
    {
      fiscal_year: 2027,
      fiscal_quarter: 1,
      period_end: '2026-05-28',
      report_date: '2026-05-27',
      eps_actual: 0.96,
      eps_estimate: 0.92,
      eps_surprise: 0.04,
      eps_surprise_percent: 4.3,
      revenue_estimate: null,
      revenue_actual: null,
      beat: true,
      is_reported: true,
    },
    {
      fiscal_year: 2027,
      fiscal_quarter: 2,
      period_end: '2026-08-27',
      report_date: '2026-07-30',
      eps_actual: null,
      eps_estimate: 1.05,
      eps_surprise: null,
      eps_surprise_percent: null,
      revenue_estimate: 89_000_000_000,
      revenue_actual: null,
      beat: null,
      is_reported: false,
    },
    {
      fiscal_year: 2027,
      fiscal_quarter: 3,
      period_end: '2026-11-26',
      report_date: '2026-10-29',
      eps_actual: null,
      eps_estimate: 1.18,
      eps_surprise: null,
      eps_surprise_percent: null,
      revenue_estimate: 95_400_000_000,
      revenue_actual: null,
      beat: null,
      is_reported: false,
    },
  ],
}

// The annual series (oldest → newest): two reported fiscal years plus one
// upcoming (estimated) one. Drives the card's Quarterly/Annual toggle.
const annualEarningsSample = {
  symbol: 'NVDA',
  count: 3,
  reported_count: 2,
  upcoming_count: 1,
  years: [
    {
      fiscal_year: 2025,
      period_end: '2025-01-31',
      eps_actual: 2.94,
      eps_estimate: null,
      revenue_actual: 130_497_000_000,
      revenue_estimate: null,
      net_income: 72_880_000_000,
      is_reported: true,
    },
    {
      fiscal_year: 2026,
      period_end: '2026-01-31',
      eps_actual: 4.9,
      eps_estimate: null,
      revenue_actual: 215_938_000_000,
      revenue_estimate: null,
      net_income: 120_067_000_000,
      is_reported: true,
    },
    {
      fiscal_year: 2027,
      period_end: '2027-01-25',
      eps_actual: null,
      eps_estimate: 8.97,
      revenue_actual: null,
      revenue_estimate: 392_638_707_720,
      net_income: null,
      is_reported: false,
    },
  ],
}

const recommendationsSample = {
  symbol: 'NVDA',
  count: 2,
  direction: 'upgraded',
  latest: {
    period: '2026-06-01',
    strong_buy: 18,
    buy: 20,
    hold: 4,
    sell: 0,
    strong_sell: 0,
    total: 42,
    score: 1.67,
    consensus: 'Buy',
  },
  trends: [],
}

/** A fetch stub that answers snapshot, candles, RSI, earnings, and ratings apart. */
function stubFetch(
  stock: unknown,
  candles: unknown,
  rsi: unknown = rsiSample,
  recommendations: unknown = recommendationsSample,
  quarterly: unknown = quarterlyEarningsSample,
  annual: unknown = annualEarningsSample,
) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string | URL) => {
      const u = String(url)
      const body = u.includes('/recommendations')
        ? recommendations
        : u.includes('/earnings/quarterly')
          ? quarterly
          : u.includes('/earnings/annual')
            ? annual
            : u.includes('/rsi')
              ? rsi
              : u.includes('/candles')
                ? candles
                : stock
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(body),
      })
    }),
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('Stocks search', () => {
  it('shows a stock snapshot after a successful search', async () => {
    stubFetch(sample, candlesSample)
    const { user } = renderWithProviders(<Stocks />)

    await user.type(screen.getByLabelText(/ticker symbol/i), 'nvda')
    await user.click(screen.getByRole('button', { name: /search/i }))

    expect(
      await screen.findByRole('heading', { name: 'NVDA' }),
    ).toBeInTheDocument()
    expect(screen.getByText('$209.97')).toBeInTheDocument()
    // The symbol is normalized to upper-case before the request.
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/stocks/NVDA'),
      expect.anything(),
    )

    // The company logo is rendered from the logo endpoint.
    const logo = screen.getByRole('img', { name: /nvda logo/i })
    expect(logo).toHaveAttribute(
      'src',
      expect.stringContaining('/stocks/NVDA/logo'),
    )

    // The enriched fields and performance strip render.
    expect(screen.getByText('Mkt Cap')).toBeInTheDocument()
    expect(screen.getByText('Performance')).toBeInTheDocument()

    // Volume was dropped from the snapshot card.
    expect(screen.queryByText('Volume')).not.toBeInTheDocument()

    // Drawdown-from-high gets its own DCA card with a tiered buy call.
    expect(screen.getByText('DCA Signal')).toBeInTheDocument()
    expect(screen.getByText('24.5%')).toBeInTheDocument()
    expect(screen.getByText('Moderate Buy')).toBeInTheDocument()

    // Net margin drives a profitability verdict card; 27.2% reads Highly
    // Profitable. (Rides the snapshot's metrics block.)
    expect(
      await screen.findByRole('heading', { name: 'Profitability' }),
    ).toBeInTheDocument()
    expect(screen.getByText('net profit margin')).toBeInTheDocument()
    expect(screen.getByText('Highly Profitable')).toBeInTheDocument()

    // The candlestick chart loads from the candles endpoint.
    expect(
      await screen.findByRole('heading', { name: /price chart/i }),
    ).toBeInTheDocument()
    expect(await screen.findByText('Vol')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/stocks/NVDA/candles'),
      expect.anything(),
    )

    // The RSI card loads and turns the deeply oversold reading into a Strong Buy.
    expect(
      await screen.findByRole('heading', { name: 'RSI' }),
    ).toBeInTheDocument()
    expect(screen.getByText('22.8')).toBeInTheDocument()
    // 'Strong Buy' is also a legend label on the analyst card below, so match all.
    expect(screen.getAllByText('Strong Buy').length).toBeGreaterThan(0)
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/stocks/NVDA/rsi'),
      expect.anything(),
    )

    // The analyst card loads with its consensus chip and month-over-month trend.
    expect(
      await screen.findByRole('heading', { name: 'Analyst Ratings' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/upgraded from last month/i)).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/stocks/NVDA/recommendations'),
      expect.anything(),
    )

    // The earnings card loads with its header, next-report chip and per-quarter EPS.
    expect(
      await screen.findByRole('heading', { name: 'Earnings' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Next report')).toBeInTheDocument()
    // $0.96 is the newest quarter's actual — shown both on the bar and in the
    // hover detail line, so match all occurrences.
    expect(screen.getAllByText('$0.96').length).toBeGreaterThan(0)
    // Trailing earnings metrics relocated from the stock endpoint render as tiles.
    expect(screen.getByText('Trailing metrics')).toBeInTheDocument()
    expect(screen.getByText('Net Margin')).toBeInTheDocument()
    // 27.2% shows on this tile and as the profitability card's headline figure.
    expect(screen.getAllByText('27.2%').length).toBeGreaterThan(0)
    // The next-earnings consensus plots forward "expected" bars on the EPS and
    // revenue charts, labelled with the forecast quarter (Q2 '27) and the
    // consensus value beneath — the report date is no longer drawn on the bars.
    expect(screen.getByText('Upcoming (est.)')).toBeInTheDocument()
    // Round billions render "$89B" or "$89.0B" depending on the ICU version.
    expect(screen.getAllByText(/\$89(\.0)?B/).length).toBeGreaterThan(0)
    expect(screen.getAllByText("Q2 '27").length).toBeGreaterThan(0)
    // Both upcoming quarters the endpoint returns plot as their own forecast
    // column, not just the immediate next report.
    expect(screen.getAllByText("Q3 '27").length).toBeGreaterThan(0)
    expect(screen.getAllByText('$1.18').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/\$95\.4B/).length).toBeGreaterThan(0)
    expect(screen.queryByText('Est. Jul 30')).not.toBeInTheDocument()
    // The hover detail line defaults to the latest quarter (est 0.92 → act 0.96).
    expect(screen.getByText('$0.92')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/stocks/NVDA/earnings'),
      expect.anything(),
    )

    // The annual series loads too, surfacing a Quarterly/Annual toggle on the
    // card; switching shows the fiscal years — reported EPS/revenue plus the
    // upcoming year's consensus as a forecast column.
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/stocks/NVDA/earnings/annual'),
      expect.anything(),
    )
    await user.click(await screen.findByRole('button', { name: 'Annual' }))
    expect(screen.getAllByText('FY26').length).toBeGreaterThan(0)
    expect(screen.getAllByText('$4.90').length).toBeGreaterThan(0)
    expect(screen.getAllByText('FY27').length).toBeGreaterThan(0)
    expect(screen.getAllByText('$392.6B').length).toBeGreaterThan(0)
  })

  it('deep-links to a snapshot from the ?symbol= query param', async () => {
    stubFetch(sample, candlesSample)
    renderWithProviders(<Stocks />, { initialEntries: ['/stocks?symbol=nvda'] })

    // No typing/submitting — the URL ticker alone drives the fetch.
    expect(
      await screen.findByRole('heading', { name: 'NVDA' }),
    ).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/stocks/NVDA'),
      expect.anything(),
    )
  })

  it('shows an error message when the symbol is not found', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: () =>
          Promise.resolve({ detail: "No stock data found for symbol 'ZZZZ'." }),
      }),
    )
    const { user } = renderWithProviders(<Stocks />)

    await user.type(screen.getByLabelText(/ticker symbol/i), 'ZZZZ')
    await user.click(screen.getByRole('button', { name: /search/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /no stock data found/i,
    )
  })
})
