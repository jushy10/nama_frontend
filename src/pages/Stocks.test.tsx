import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

/** A fetch stub that answers the snapshot, candles, and RSI endpoints apart. */
function stubFetch(stock: unknown, candles: unknown, rsi: unknown = rsiSample) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string | URL) => {
      const u = String(url)
      const body = u.includes('/rsi')
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
    const user = userEvent.setup()
    render(<Stocks />)

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
    const user = userEvent.setup()
    render(<Stocks />)

    await user.type(screen.getByLabelText(/ticker symbol/i), 'ZZZZ')
    await user.click(screen.getByRole('button', { name: /search/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /no stock data found/i,
    )
  })
})
