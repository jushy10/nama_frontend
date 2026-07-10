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
 * Three EMA lines (9/21/50) whose points land on the two candles' own times, so
 * the overlay maps onto real bars and its legend chips render. Values sit inside
 * the candles' visible range so the lines draw within the plot.
 */
function emaSeries(symbol: string) {
  const point = (hourUtc: number, value: number) => ({
    time: Date.UTC(2026, 6, 1, hourUtc) / 1000,
    timestamp: new Date(Date.UTC(2026, 6, 1, hourUtc)).toISOString(),
    value,
  })
  const line = (period: number) => ({
    period,
    count: 2,
    latest: 730.6,
    points: [point(15, 730.4), point(16, 730.6)],
  })
  return { symbol, timeframe: '5Min', lines: [line(9), line(21), line(50)] }
}

/**
 * One strong support level at 730.50 — inside the candles' padded visible range
 * (~[728.8, 733.2]), so its price tag renders, and non-empty so the chart shows
 * the "Support levels" toggle.
 */
function supportLevels(symbol: string) {
  return {
    symbol,
    timeframe: '1Day',
    reference_price: 732,
    count: 1,
    levels: [
      {
        price: 730.5,
        touches: 3,
        last_touched: '2026-06-25',
        strength: 'strong',
        distance_percent: -0.2,
      },
    ],
  }
}

/**
 * Answers the chart's reads for the selected proxy — /candles, /ema and
 * /support-levels (all under /stocks/ticker/SYMBOL) — plus the index-tile quotes
 * from BY_SYMBOL, which come through the ETF endpoint (/stocks/etf/SYMBOL), not
 * the stock ticker card. 404s anything else (e.g. an unstubbed tile symbol).
 */
function stubFetch() {
  const mock = vi.fn((url: string | URL) => {
    const u = String(url)
    let data: unknown
    let m: RegExpMatchArray | null
    if ((m = u.match(/\/stocks\/ticker\/([^/?]+)\/candles/))) {
      data = candleSeries(m[1])
    } else if ((m = u.match(/\/stocks\/ticker\/([^/?]+)\/support-levels/))) {
      data = supportLevels(m[1])
    } else if ((m = u.match(/\/stocks\/ticker\/([^/?]+)\/ema/))) {
      data = emaSeries(m[1])
    } else if ((m = u.match(/\/stocks\/etf\/([^/?]+)/))) {
      data = BY_SYMBOL[m[1]]
    }
    return Promise.resolve({
      ok: data != null,
      status: data != null ? 200 : 404,
      json: () => Promise.resolve(data ?? { detail: 'No data.' }),
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

    await user.click(screen.getByRole('button', { name: '7D' }))
    await waitFor(() =>
      expect(mock).toHaveBeenCalledWith(
        expect.stringMatching(/\/stocks\/ticker\/SPY\/candles\?.*range=7D/),
        expect.anything(),
      ),
    )
  })

  it('overlays moving averages and support levels like the stock page', async () => {
    stubFetch()
    renderWithProviders(<MarketIndices />)

    // The chart carries both overlay toggles, defaulted on to match the stock
    // page.
    expect(
      await screen.findByRole('img', { name: /candlestick price chart/i }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Moving averages')).toBeChecked()
    expect(await screen.findByLabelText('Support levels')).toBeChecked()

    // The EMA legend chips render (one per line) and the in-range support level
    // draws its price tag on the axis.
    expect(await screen.findByText('EMA 9')).toBeInTheDocument()
    expect(screen.getByText('EMA 21')).toBeInTheDocument()
    expect(screen.getByText('EMA 50')).toBeInTheDocument()
    expect(screen.getByText('730.50')).toBeInTheDocument()
  })

  it('drops each overlay when its toggle is switched off', async () => {
    stubFetch()
    const { user } = renderWithProviders(<MarketIndices />)

    // Wait for both overlays to land.
    expect(await screen.findByText('EMA 9')).toBeInTheDocument()
    expect(screen.getByText('730.50')).toBeInTheDocument()

    // Switching Moving averages off pulls the EMA legend; support stays.
    await user.click(screen.getByLabelText('Moving averages'))
    await waitFor(() =>
      expect(screen.queryByText('EMA 9')).not.toBeInTheDocument(),
    )
    expect(screen.getByText('730.50')).toBeInTheDocument()

    // Switching Support levels off pulls its price tag too.
    await user.click(screen.getByLabelText('Support levels'))
    await waitFor(() =>
      expect(screen.queryByText('730.50')).not.toBeInTheDocument(),
    )
  })
})
