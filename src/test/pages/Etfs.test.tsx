import { afterEach, describe, expect, it, vi } from 'vitest'
import { Route, Routes, useSearchParams } from 'react-router-dom'
import { renderWithProviders, screen } from '@/test/test-utils'
import Etfs from '@/pages/Etfs'

const voo = {
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
  net_assets: 1_701_513_003_008,
  expense_ratio: 0.03,
  nav: 684.9,
  dividend_yield: 1.03,
  ytd_return: 11.25,
  three_year_return: 20.41,
  five_year_return: 13.01,
  description: 'The fund tracks the S&P 500 through a full-replication index.',
  top_holdings: [
    { ticker: 'NVDA', name: 'NVIDIA Corp', weight: 7.89 },
    { ticker: 'AAPL', name: 'Apple Inc', weight: 7.04 },
  ],
  sector_weightings: [
    { sector: 'technology', weight: 39.13 },
    { sector: 'financial_services', weight: 10.92 },
  ],
}

const candlesSample = {
  symbol: 'VOO',
  timeframe: '1Day',
  count: 2,
  candles: [
    {
      time: 1718668800,
      timestamp: '2026-06-17T00:00:00Z',
      open: 670,
      high: 686,
      low: 668,
      close: 680,
      volume: 1_000_000,
      direction: 'up',
    },
    {
      time: 1718755200,
      timestamp: '2026-06-18T00:00:00Z',
      open: 680,
      high: 690,
      low: 679,
      close: 685.28,
      volume: 1_200_000,
      direction: 'up',
    },
  ],
}

/** A fetch stub that answers the ETF detail and its candles apart. */
function stubFetch(detail: unknown, candles: unknown = candlesSample) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string | URL) => {
      const u = String(url)
      const body = u.includes('/candles') ? candles : detail
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(body),
      })
    }),
  )
}

/** Minimal stand-in for the stocks page that echoes the ?symbol= it received. */
function StockStub() {
  const [params] = useSearchParams()
  return <div>stock page: {params.get('symbol')}</div>
}

afterEach(() => vi.unstubAllGlobals())

describe('Etfs (fund detail)', () => {
  it('deep-links to a fund snapshot from the ?symbol= query param', async () => {
    stubFetch(voo)
    renderWithProviders(<Etfs />, { initialEntries: ['/etfs?symbol=VOO'] })

    // Identity + the ETF badge that tells it apart from a stock.
    expect(
      await screen.findByRole('heading', { name: 'VOO' }),
    ).toBeInTheDocument()
    expect(screen.getByText('ETF')).toBeInTheDocument()
    expect(screen.getByText('$685.28')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/stocks/etf/VOO'),
      expect.anything(),
    )

    // Fund-defining stats.
    expect(screen.getByText('AUM')).toBeInTheDocument()
    expect(screen.getByText('$1.7T')).toBeInTheDocument()
    expect(screen.getByText('Expense Ratio')).toBeInTheDocument()

    // Fund-style returns, not the 1W–1Y stock strip.
    expect(screen.getByRole('heading', { name: 'Returns' })).toBeInTheDocument()
    expect(screen.getByText('+11.25%')).toBeInTheDocument()

    // Holdings (each linked to its stock page) and sector mix.
    expect(
      screen.getByRole('heading', { name: 'Top Holdings' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'NVDA' })).toHaveAttribute(
      'href',
      '/stocks?symbol=NVDA',
    )
    expect(
      screen.getByRole('heading', { name: 'Sector Weightings' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Technology')).toBeInTheDocument()

    // The About blurb and the reused price chart.
    expect(screen.getByRole('heading', { name: 'About' })).toBeInTheDocument()
    expect(
      await screen.findByRole('heading', { name: /price chart/i }),
    ).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/stocks/VOO/candles'),
      expect.anything(),
    )
  })

  it('bounces a non-ETF ticker (404) over to the stock page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: () =>
          Promise.resolve({ detail: "'AAPL' is not a screened ETF." }),
      }),
    )
    renderWithProviders(
      <Routes>
        <Route path="/etfs" element={<Etfs />} />
        <Route path="/stocks" element={<StockStub />} />
      </Routes>,
      { initialEntries: ['/etfs?symbol=AAPL'] },
    )

    // The fund page never shows a "not found" error — it redirects, carrying
    // the symbol, so the stock page picks the ticker up.
    expect(await screen.findByText('stock page: AAPL')).toBeInTheDocument()
  })
})
