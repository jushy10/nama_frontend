import { afterEach, describe, expect, it, vi } from 'vitest'
import { Route, Routes, useSearchParams } from 'react-router-dom'
import { renderWithProviders, screen } from '@/test/test-utils'
import Sectors from '@/pages/Sectors'

/** Minimal stand-in for the stocks page that echoes the ?symbol= it received. */
function StockStub() {
  const [params] = useSearchParams()
  return <div>stock page: {params.get('symbol')}</div>
}

const sectorsSample = {
  count: 3,
  sectors: [
    {
      sector: 'Technology',
      symbol: 'XLK',
      price: 182.99,
      change: -1.17,
      change_percent: -0.64,
      previous_close: 184.16,
      as_of: '2026-06-24T18:31:33.886477Z',
      performance: {
        '1w': -1.41,
        '1m': 1.53,
        '3m': 33.88,
        '6m': 25.13,
        ytd: 27.19,
        '1y': -25.95,
      },
    },
    {
      sector: 'Industrials',
      symbol: 'XLI',
      price: 180.45,
      change: 2.31,
      change_percent: 1.3,
      previous_close: 178.14,
      as_of: '2026-06-24T18:31:06.395507Z',
      performance: {
        '1w': 0.5,
        '1m': 5.11,
        '3m': 9.32,
        '6m': 14.62,
        ytd: 16.37,
        '1y': 24.41,
      },
    },
    {
      sector: 'Energy',
      symbol: 'XLE',
      price: 53.4,
      change: -1.05,
      change_percent: -1.93,
      previous_close: 54.45,
      as_of: '2026-06-24T18:30:32.085662Z',
      performance: {
        '1w': -2.36,
        '1m': -10.18,
        '3m': -11.85,
        '6m': 20.37,
        ytd: 19.41,
        '1y': -37.1,
      },
    },
  ],
}

function stubFetch(payload: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(payload),
      }),
    ),
  )
}

/** Routes `/sectors` to the sample and `/stocks/ticker/{ticker}` to a per-ticker stub. */
function stubRoutedFetch(
  sectors: unknown,
  stockBySymbol: Record<string, unknown>,
) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      const u = String(url)
      const m = u.match(/\/stocks\/ticker\/([^/?]+)/)
      const payload = m
        ? (stockBySymbol[decodeURIComponent(m[1])] ?? {
            ticker: decodeURIComponent(m[1]),
            name: null,
            price: 0,
            change: null,
            change_percent: null,
          })
        : sectors
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(payload),
      })
    }),
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('Sectors page', () => {
  it('lists every sector with its day move and the selected timeframe', async () => {
    stubFetch(sectorsSample)
    renderWithProviders(<Sectors />)

    expect(await screen.findByText('Technology')).toBeInTheDocument()
    expect(screen.getByText('Industrials')).toBeInTheDocument()
    expect(screen.getByText('Energy')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/sectors'),
      expect.anything(),
    )

    // The day's move is always shown (Technology is down -0.64% today). With the
    // 1D default the hero return mirrors that move, so the value can appear twice.
    expect(screen.getAllByText('today').length).toBe(3)
    expect(screen.getAllByText('-0.64%').length).toBeGreaterThanOrEqual(1)

    // Default timeframe is 1D; the hero label reflects it.
    expect(screen.getAllByText(/1d return/i).length).toBe(3)
  })

  it('re-sorts by the chosen timeframe, best first', async () => {
    stubFetch(sectorsSample)
    const { user } = renderWithProviders(<Sectors />)

    await screen.findByText('Technology')

    // Switch to YTD: Technology (27.19) > Energy (19.41) > Industrials (16.37).
    await user.click(screen.getByRole('button', { name: 'YTD' }))
    const ytdOrder = screen
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent)
    expect(ytdOrder).toEqual(['Technology', 'Energy', 'Industrials'])

    // Switch to 3M: Technology (33.88) > Industrials (9.32) > Energy (-11.85).
    await user.click(screen.getByRole('button', { name: '3M' }))
    const m3Order = screen
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent)
    expect(m3Order).toEqual(['Technology', 'Industrials', 'Energy'])
    expect(screen.getAllByText(/3m return/i).length).toBe(3)
  })

  it('sorts by the day move when 1D is selected', async () => {
    stubFetch(sectorsSample)
    const { user } = renderWithProviders(<Sectors />)

    await screen.findByText('Technology')

    // 1D order by change_percent: Industrials (1.3) > Technology (-0.64) > Energy (-1.93).
    await user.click(screen.getByRole('button', { name: '1D' }))
    const order = screen
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent)
    expect(order).toEqual(['Industrials', 'Technology', 'Energy'])
    expect(screen.getAllByText(/1d return/i).length).toBe(3)
  })

  it('opens the holdings dialog with the sector top stocks on click', async () => {
    stubRoutedFetch(sectorsSample, {
      AAPL: {
        ticker: 'AAPL',
        name: 'Apple Inc.',
        price: 200.5,
        change: 2.1,
        change_percent: 1.06,
      },
    })
    const { user } = renderWithProviders(<Sectors />)

    await screen.findByText('Technology')
    await user.click(
      screen.getByRole('button', { name: /view top holdings in technology/i }),
    )

    expect(await screen.findByText('Apple Inc.')).toBeInTheDocument()
    expect(screen.getByText('AAPL')).toBeInTheDocument()
    expect(screen.getByText('Top holdings by index weight')).toBeInTheDocument()
  })

  it('navigates to the stock page when a holding is clicked', async () => {
    stubRoutedFetch(sectorsSample, {
      AAPL: {
        ticker: 'AAPL',
        name: 'Apple Inc.',
        price: 200.5,
        change: 2.1,
        change_percent: 1.06,
      },
    })
    const { user } = renderWithProviders(
      <Routes>
        <Route path="/sectors" element={<Sectors />} />
        <Route path="/stocks" element={<StockStub />} />
      </Routes>,
      { initialEntries: ['/sectors'] },
    )

    await screen.findByText('Technology')
    await user.click(
      screen.getByRole('button', { name: /view top holdings in technology/i }),
    )

    const link = await screen.findByRole('link', { name: /view AAPL details/i })
    await user.click(link)

    expect(await screen.findByText(/stock page: AAPL/i)).toBeInTheDocument()
  })

  it('shows an error message when the request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () =>
          Promise.resolve({ detail: 'Upstream sector feed unavailable.' }),
      }),
    )
    renderWithProviders(<Sectors />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /upstream sector feed/i,
    )
  })
})
