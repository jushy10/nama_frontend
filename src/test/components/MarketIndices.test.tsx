import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders, screen, waitFor } from '@/test/test-utils'
import MarketIndices from '@/components/MarketIndices'

/** Minimal quote card — only the fields the index tiles read. */
function quote(ticker: string, price: number, change: number, pct: number) {
  return {
    ticker,
    name: ticker,
    price,
    change,
    change_percent: pct,
  }
}

const BY_SYMBOL: Record<string, ReturnType<typeof quote>> = {
  SPY: quote('SPY', 731.88, -1.74, -0.24),
  QQQ: quote('QQQ', 706.47, 7.11, 1.0),
}

/**
 * A tiny two-candle intraday series, timed midday ET so the client's
 * regular-hours clamp keeps both bars.
 */
function candleSeries(symbol: string) {
  const bar = (hourUtc: number, open: number, close: number) => ({
    time: Date.UTC(2026, 6, 1, hourUtc) / 1000,
    timestamp: new Date(Date.UTC(2026, 6, 1, hourUtc)).toISOString(),
    open,
    high: Math.max(open, close) + 1,
    low: Math.min(open, close) - 1,
    close,
    volume: 1_000_000,
    direction: close >= open ? 'up' : 'down',
  })
  return {
    symbol,
    timeframe: '5Min',
    count: 2,
    candles: [bar(15, 730, 731), bar(16, 731, 732)],
  }
}

/**
 * Answers /stocks/ticker/SYMBOL/candles with a small series and the index-tile quotes
 * from BY_SYMBOL. The tiles quote each fund through the ETF endpoint
 * (/stocks/etf/SYMBOL), not the stock ticker card; 404s the rest.
 */
function stubFetch() {
  const mock = vi.fn((url: string | URL) => {
    const u = String(url)
    const isCandles = u.includes('/candles')
    const symbol =
      (isCandles
        ? u.match(/\/stocks\/ticker\/([^/?]+)\/candles/)
        : u.match(/\/stocks\/etf\/([^/?]+)/))?.[1] ?? ''
    const data = isCandles ? candleSeries(symbol) : BY_SYMBOL[symbol]
    return Promise.resolve({
      ok: data != null,
      status: data != null ? 200 : 404,
      json: () => Promise.resolve(data ?? { detail: `No data for ${symbol}.` }),
    })
  })
  vi.stubGlobal('fetch', mock)
  return mock
}

afterEach(() => vi.unstubAllGlobals())

describe('MarketIndices', () => {
  it('renders index proxies with their day move', async () => {
    stubFetch()
    renderWithProviders(<MarketIndices />)

    // Friendly labels, not the raw ETF tickers, head each tile.
    expect(
      await screen.findByRole('heading', { name: /markets today/i }),
    ).toBeInTheDocument()
    expect(await screen.findByText('S&P 500')).toBeInTheDocument()
    expect(screen.getByText('Nasdaq 100')).toBeInTheDocument()

    // A resolved symbol shows price and signed day-change percent.
    expect(await screen.findByText('$731.88')).toBeInTheDocument()
    expect(screen.getByText('-0.24%')).toBeInTheDocument()
    expect(screen.getByText('+1.00%')).toBeInTheDocument()
  })

  it('shows a dash for a symbol that fails to load', async () => {
    stubFetch()
    renderWithProviders(<MarketIndices />)

    // DIA isn't in BY_SYMBOL, so its tile degrades to a dash rather than
    // blanking the whole row.
    expect(await screen.findByText('S&P 500')).toBeInTheDocument()
    expect(screen.getByText('Dow Jones')).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('charts the S&P 500 by default and swaps on tile select', async () => {
    const mock = stubFetch()
    const { user } = renderWithProviders(<MarketIndices />)

    // The default chart is SPY over 1D.
    expect(
      await screen.findByRole('img', { name: /candlestick price chart/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /S&P 500 · SPY/ }),
    ).toBeInTheDocument()
    expect(mock).toHaveBeenCalledWith(
      expect.stringContaining('/stocks/ticker/SPY/candles'),
      expect.anything(),
    )

    // The header carries the range's move: first open (730) → last close (732).
    expect(screen.getByText('+0.27%')).toBeInTheDocument()

    // Picking the Nasdaq tile re-points the chart at QQQ.
    await user.click(
      await screen.findByRole('button', {
        name: /nasdaq 100/i,
        pressed: false,
      }),
    )
    expect(
      await screen.findByRole('heading', { name: /Nasdaq 100 · QQQ/ }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /nasdaq 100/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await waitFor(() =>
      expect(mock).toHaveBeenCalledWith(
        expect.stringContaining('/stocks/ticker/QQQ/candles'),
        expect.anything(),
      ),
    )
  })

  it('refetches candles when the range changes', async () => {
    const mock = stubFetch()
    const { user } = renderWithProviders(<MarketIndices />)

    expect(
      await screen.findByRole('img', { name: /candlestick price chart/i }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '5D' }))
    await waitFor(() =>
      expect(mock).toHaveBeenCalledWith(
        expect.stringMatching(/\/stocks\/ticker\/SPY\/candles\?.*range=5D/),
        expect.anything(),
      ),
    )
  })
})
