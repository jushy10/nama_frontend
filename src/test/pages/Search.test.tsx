import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders, screen } from '@/test/test-utils'
import Search from '@/pages/Search'

// The ticker card classifies the symbol (asset_type) and, for a stock, carries
// the whole snapshot — the one request the Search page keys off.
const stockCard = {
  ticker: 'NVDA',
  name: 'NVIDIA Corporation',
  exchange: 'NASDAQ',
  asset_type: 'equity',
  sector: 'technology',
  industry: 'semiconductors',
  price: 209.97,
  change: 5.27,
  change_percent: 2.57,
  market_cap: 3_210_000_000_000,
  dividend: { yield_percentage: 0.02, per_share: 0.04 },
  performance: {
    '1w': 3.1,
    '1m': -1.2,
    '3m': 8.4,
    '6m': 15,
    ytd: 22.3,
    '1y': 40.1,
  },
  metrics: {
    pe: 46.5,
    peg: 1.19,
    forward_peg: 1.42,
    gross_margin: 47.9,
    operating_margin: 32.6,
    net_margin: 27.2,
    revenue_growth_yoy: 69.2,
    eps_growth_yoy: 80.5,
  },
  options_metrics: null,
}

// An ETF's ticker card: asset_type "etf" with the fund-irrelevant blocks null.
const etfCard = {
  ticker: 'VOO',
  name: 'Vanguard S&P 500 ETF',
  exchange: 'NYSE',
  asset_type: 'etf',
  sector: null,
  industry: null,
  price: 685.28,
  change: 3.21,
  change_percent: 0.47,
  market_cap: null,
  dividend: null,
  performance: null,
  metrics: null,
  options_metrics: null,
}

const etfDetail = {
  ticker: 'VOO',
  name: 'Vanguard S&P 500 ETF',
  exchange: 'NYSE',
  asset_type: 'etf',
  price: 685.28,
  change: 3.21,
  change_percent: 0.47,
  previous_close: 682.07,
  as_of: '2026-07-06T20:00:00Z',
  category: 'large_blend',
  fund_family: 'Vanguard',
  description: 'Tracks the S&P 500.',
  top_holdings: [{ ticker: 'NVDA', name: 'NVIDIA Corp', weight: 7.89 }],
  sector_weightings: [{ sector: 'technology', weight: 39.13 }],
  // The opt-in blocks the detail view requests (metrics/dividends/performance).
  metrics: { expense_ratio: 0.03, nav: 684.9, net_assets: 1_701_513_003_008 },
  dividends: { yield_percentage: 1.03 },
  performance: {
    '1w': null,
    '1m': null,
    '3m': null,
    '6m': null,
    ytd: 11.25,
    '1y': null,
    '3y': 20.41,
    '5y': 13.01,
  },
}

const candles = {
  symbol: 'X',
  timeframe: '1Day',
  count: 2,
  candles: [
    {
      time: 1,
      timestamp: '2026-06-17T00:00:00Z',
      open: 200,
      high: 210,
      low: 198,
      close: 205,
      volume: 1_000_000,
      direction: 'up',
    },
    {
      time: 2,
      timestamp: '2026-06-18T00:00:00Z',
      open: 205,
      high: 212,
      low: 204,
      close: 209,
      volume: 1_200_000,
      direction: 'up',
    },
  ],
}

const emptyQuarterly = {
  symbol: 'X',
  count: 0,
  reported_count: 0,
  upcoming_count: 0,
  quarters: [],
}
const emptyAnnual = {
  symbol: 'X',
  count: 0,
  reported_count: 0,
  upcoming_count: 0,
  years: [],
}
const analystInfo = {
  ticker: 'X',
  recommendations: {
    direction: 'unchanged',
    latest: null,
    price_targets: null,
    trends: [],
  },
  rating_changes: [],
}
const analysis = {
  symbol: 'X',
  recommendation: 'hold',
  confidence: 'medium',
  thesis: 'A balanced read on the stock.',
  strengths: ['Strong brand'],
  risks: ['Rich valuation'],
  disclaimer: 'Not financial advice.',
  model: 'claude-haiku-4-5',
  generated_at: '2026-07-08T00:00:00Z',
}

/** Route fetch by URL: the type classifier (derived from `card`), the ETF
 *  detail, candles, earnings, ratings, else the ticker card. Pass `etfDetail`
 *  only for an ETF symbol. */
function stubFetch(card: unknown, opts: { etfDetail?: unknown } = {}) {
  const c = card as { ticker: string; asset_type: string }
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string | URL) => {
      const u = String(url)
      const body = u.includes('/stocks/type/')
        ? { ticker: c.ticker, asset_type: c.asset_type }
        : u.includes('/stocks/etf/')
          ? (opts.etfDetail ?? { detail: 'not an ETF' })
          : u.includes('/candles')
            ? candles
            : u.includes('/analyst-info')
              ? analystInfo
              : u.includes('/earnings/quarterly')
                ? emptyQuarterly
                : u.includes('/earnings/annual')
                  ? emptyAnnual
                  : u.includes('/analysis')
                    ? analysis
                    : card
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(body),
      })
    }),
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('Search (unified)', () => {
  it('renders the stock detail inline for an equity ticker', async () => {
    stubFetch(stockCard)
    const { user } = renderWithProviders(<Search />)

    await user.type(screen.getByLabelText(/name or ticker/i), 'nvda')
    await user.click(screen.getByRole('button', { name: /search/i }))

    // The stock snapshot renders (heading, price, market cap, performance).
    expect(
      await screen.findByRole('heading', { name: 'NVDA' }),
    ).toBeInTheDocument()
    expect(screen.getByText('$209.97')).toBeInTheDocument()
    expect(screen.getByText('Mkt Cap')).toBeInTheDocument()
    expect(screen.getByText('Performance')).toBeInTheDocument()
    // Classified via the cheap type endpoint first...
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/stocks/type/NVDA'),
      expect.anything(),
    )
    // ...then the stock detail fetches the card with every block attached.
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(
        '/stocks/ticker/NVDA?include=dividend,performance,metrics,options_metrics',
      ),
      expect.anything(),
    )
    // The AI analysis card loads on its own and appears once the read lands.
    expect(await screen.findByText('AI Analysis')).toBeInTheDocument()
    // No ETF badge / holdings for a stock.
    expect(screen.queryByText('Top Holdings')).not.toBeInTheDocument()
  })

  it('renders the fund detail inline for an ETF ticker', async () => {
    stubFetch(etfCard, { etfDetail })
    renderWithProviders(<Search />, { initialEntries: ['/search?symbol=VOO'] })

    expect(
      await screen.findByRole('heading', { name: 'VOO' }),
    ).toBeInTheDocument()
    // Fund-specific surface: badge, AUM, holdings (linked to /search), sectors.
    expect(screen.getByText('ETF')).toBeInTheDocument()
    expect(screen.getByText('AUM')).toBeInTheDocument()
    expect(
      await screen.findByRole('heading', { name: 'Top Holdings' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'NVDA' })).toHaveAttribute(
      'href',
      '/search?symbol=NVDA',
    )
    // It fetched the full fund detail (holdings/sectors aren't on the card).
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/stocks/etf/VOO'),
      expect.anything(),
    )
    // Stock-only cards don't show for a fund.
    expect(screen.queryByText('Analyst Ratings')).not.toBeInTheDocument()
    expect(screen.queryByText('AI Analysis')).not.toBeInTheDocument()
  })

  it('suggests matches by company name or ticker as you type, stocks and ETFs', async () => {
    const stockHit = {
      ticker: 'NVDA',
      name: 'NVIDIA Corporation',
      sector: 'technology',
      industry: 'semiconductors',
      market_cap: 3_210_000_000_000,
      pe_ratio: 46.5,
      revenue_growth_yoy: 69.2,
      eps_growth_yoy: 80.5,
      in_sp500: true,
      in_nasdaq100: true,
    }
    const etfHit = {
      ticker: 'NVDL',
      name: 'GraniteShares 2x Long NVDA Daily ETF',
      exchange: 'NASDAQ',
      net_assets: 5_000_000_000,
      expense_ratio: 1.15,
      category: 'trading_leveraged_equity',
    }
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string | URL) => {
        const u = String(url)
        // The two universe searches (query string) vs. the per-ticker detail read.
        const body = u.includes('/stocks/ticker?')
          ? { total: 1, limit: 7, offset: 0, count: 1, results: [stockHit] }
          : u.includes('/stocks/etfs?')
            ? { total: 1, limit: 5, offset: 0, count: 1, results: [etfHit] }
            : u.includes('/stocks/type/')
              ? { ticker: 'NVDA', asset_type: 'equity' }
              : u.includes('/candles')
                ? candles
                : u.includes('/analyst-info')
                  ? analystInfo
                  : u.includes('/earnings/quarterly')
                    ? emptyQuarterly
                    : u.includes('/earnings/annual')
                      ? emptyAnnual
                      : u.includes('/analysis')
                        ? analysis
                        : stockCard
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(body),
        })
      }),
    )
    const { user } = renderWithProviders(<Search />)

    // Typing a partial name surfaces the company, not just an exact ticker.
    await user.type(screen.getByLabelText(/name or ticker/i), 'nv')
    expect(await screen.findByText('NVIDIA Corporation')).toBeInTheDocument()
    // The ETF universe is searched alongside stocks.
    expect(
      screen.getByText('GraniteShares 2x Long NVDA Daily ETF'),
    ).toBeInTheDocument()
    // The search hit by name/ticker substring, not the detail route.
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/stocks/ticker?q=nv'),
      expect.anything(),
    )

    // Picking a suggestion loads its detail inline.
    await user.click(screen.getByText('NVIDIA Corporation'))
    expect(
      await screen.findByRole('heading', { name: 'NVDA' }),
    ).toBeInTheDocument()
  })

  it('shows an error when the ticker is not found', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ detail: "No data for 'ZZZZ'." }),
      }),
    )
    const { user } = renderWithProviders(<Search />)

    await user.type(screen.getByLabelText(/name or ticker/i), 'ZZZZ')
    await user.click(screen.getByRole('button', { name: /search/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/no data for/i)
  })
})
