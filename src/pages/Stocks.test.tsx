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

const earningsSample = {
  symbol: 'NVDA',
  count: 4,
  beats: 3,
  scored: 4,
  beat_rate: 75.0,
  metrics: {
    eps: 8.27,
    eps_growth_yoy: 29.0,
    revenue_growth_yoy: 12.8,
    gross_margin: 47.9,
    operating_margin: 32.6,
    net_margin: 27.2,
    roe: 146.7,
    roic: null,
    payout_ratio: 12.7,
  },
  next_report: {
    report_date: '2026-07-30',
    fiscal_year: 2027,
    fiscal_quarter: 2,
    eps_estimate: 1.05,
    revenue_estimate: 89_000_000_000,
    session: 'amc',
  },
  quarters: [
    {
      period: '2026-05-28',
      fiscal_year: 2027,
      fiscal_quarter: 1,
      actual: 0.96,
      estimate: 0.92,
      surprise: 0.04,
      surprise_percent: 4.3,
      beat: true,
    },
    {
      period: '2025-11-20',
      fiscal_year: 2026,
      fiscal_quarter: 3,
      actual: 0.81,
      estimate: 0.75,
      surprise: 0.06,
      surprise_percent: 8.0,
      beat: true,
    },
  ],
}

/** A fetch stub that answers the snapshot, candles, RSI, and earnings apart. */
function stubFetch(
  stock: unknown,
  candles: unknown,
  rsi: unknown = rsiSample,
  earnings: unknown = earningsSample,
) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string | URL) => {
      const u = String(url)
      const body = u.includes('/earnings')
        ? earnings
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

    // The candlestick chart loads from the candles endpoint.
    expect(
      await screen.findByRole('heading', { name: /price chart/i }),
    ).toBeInTheDocument()
    expect(await screen.findByText('Vol')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/stocks/NVDA/candles'),
      expect.anything(),
    )

    // The RSI card loads and turns the oversold reading into a Buy call.
    expect(
      await screen.findByRole('heading', { name: 'RSI' }),
    ).toBeInTheDocument()
    expect(screen.getByText('22.8')).toBeInTheDocument()
    expect(screen.getByText('Buy')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/stocks/NVDA/rsi'),
      expect.anything(),
    )

    // The earnings card loads with its beat-rate summary and per-quarter EPS.
    expect(
      await screen.findByRole('heading', { name: 'Earnings' }),
    ).toBeInTheDocument()
    expect(screen.getByText('75%')).toBeInTheDocument()
    // $0.96 is the newest quarter's actual — shown both on the bar and in the
    // hover detail line, so match all occurrences.
    expect(screen.getAllByText('$0.96').length).toBeGreaterThan(0)
    // Trailing earnings metrics relocated from the stock endpoint render as tiles.
    expect(screen.getByText('Trailing metrics')).toBeInTheDocument()
    expect(screen.getByText('Net Margin')).toBeInTheDocument()
    expect(screen.getByText('27.2%')).toBeInTheDocument()
    // The next-earnings consensus plots a forward "expected" bar on the chart.
    expect(screen.getByText('Upcoming (est.)')).toBeInTheDocument()
    expect(screen.getByText('Est. Jul 30')).toBeInTheDocument()
    // The hover detail line defaults to the latest quarter (est 0.92 → act 0.96).
    expect(screen.getByText('$0.92')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/stocks/NVDA/earnings'),
      expect.anything(),
    )
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
