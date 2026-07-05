import { afterEach, describe, expect, it, vi } from 'vitest'
import { Route, Routes, useSearchParams } from 'react-router-dom'
import { renderWithProviders, screen, waitFor } from '@/test/test-utils'
import Screener from '@/pages/Screener'

/** Minimal stand-in for the stocks page that echoes the ?symbol= it received. */
function StockStub() {
  const [params] = useSearchParams()
  return <div>stock page: {params.get('symbol')}</div>
}

const SEARCH_PAGE = {
  total: 2,
  limit: 25,
  offset: 0,
  count: 2,
  results: [
    {
      ticker: 'NVDA',
      name: 'Nvidia',
      sector: 'technology',
      industry: 'semiconductors',
      market_cap: 3.2e12,
      revenue_growth_yoy: 61.6,
      eps_growth_yoy: 587.4,
      in_sp500: true,
      in_nasdaq100: true,
    },
    {
      ticker: 'XOM',
      name: 'Exxon Mobil',
      sector: 'energy',
      industry: 'oil_gas_integrated',
      market_cap: 5.0e11,
      revenue_growth_yoy: -2.0,
      eps_growth_yoy: 3.1,
      in_sp500: true,
      in_nasdaq100: false,
    },
  ],
}

const CLASSIFICATIONS = {
  sectors: ['energy', 'technology'],
  industries: ['oil_gas_integrated', 'semiconductors'],
}

/**
 * Route fetch by URL: /stocks/classifications → the filter menus, everything
 * else (the /stocks/ticker search) → the given page. Returns the list of called
 * URLs so a test can assert the query params the page sent.
 */
function stubApi(searchPayload: unknown = SEARCH_PAGE) {
  const calls: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string | URL) => {
      const u = String(url)
      calls.push(u)
      const body = u.includes('/stocks/classifications')
        ? CLASSIFICATIONS
        : searchPayload
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(body),
      })
    }),
  )
  return calls
}

/** The most recent /stocks/ticker (search) request URL. */
const lastSearchUrl = (calls: string[]) =>
  [...calls].reverse().find((u) => u.includes('/stocks/ticker')) ?? ''

afterEach(() => vi.unstubAllGlobals())

describe('Screener', () => {
  it('lists the screened universe with market cap and growth', async () => {
    stubApi()
    renderWithProviders(<Screener />)

    expect(await screen.findByText('NVDA')).toBeInTheDocument()
    expect(screen.getByText('Nvidia')).toBeInTheDocument()
    expect(screen.getByText('XOM')).toBeInTheDocument()
    // Compact market cap, signed growth, and the total-count summary.
    expect(screen.getByText('$3.2T')).toBeInTheDocument()
    expect(screen.getByText('+61.6%')).toBeInTheDocument()
    expect(screen.getByText(/2 stocks/)).toBeInTheDocument()
  })

  it('searches by name or ticker (debounced) via the q param', async () => {
    const calls = stubApi()
    const { user } = renderWithProviders(<Screener />)
    await screen.findByText('NVDA')

    await user.type(
      screen.getByRole('textbox', { name: /search name or ticker/i }),
      'NV',
    )

    await waitFor(() => expect(lastSearchUrl(calls)).toMatch(/[?&]q=NV(&|$)/))
  })

  it('filters by a sector chosen from the classifications menu', async () => {
    const calls = stubApi()
    const { user } = renderWithProviders(<Screener />)
    await screen.findByText('NVDA')

    // The menu options come from /stocks/classifications, humanized.
    await user.click(screen.getByRole('combobox', { name: /sector/i }))
    await user.click(await screen.findByRole('option', { name: 'Technology' }))

    await waitFor(() =>
      expect(lastSearchUrl(calls)).toMatch(/sector=technology/),
    )
  })

  it('filters by index membership', async () => {
    const calls = stubApi()
    const { user } = renderWithProviders(<Screener />)
    await screen.findByText('NVDA')

    await user.click(screen.getByRole('button', { name: /s&p 500/i }))

    await waitFor(() => expect(lastSearchUrl(calls)).toMatch(/in_sp500=true/))
  })

  it('sorts by a metric column when its header is clicked', async () => {
    const calls = stubApi()
    const { user } = renderWithProviders(<Screener />)
    await screen.findByText('NVDA')

    await user.click(screen.getByText('EPS Growth'))

    await waitFor(() => expect(lastSearchUrl(calls)).toMatch(/sort=eps_growth/))
    expect(lastSearchUrl(calls)).toMatch(/order=desc/)
  })

  it('sorts by a metric chosen from the mobile "Sort by" menu', async () => {
    const calls = stubApi()
    const { user } = renderWithProviders(<Screener />)
    await screen.findByText('NVDA')

    // The header sort labels are hidden on phones, so the dropdown is the way
    // to reach every metric (here revenue growth) regardless of viewport.
    await user.click(screen.getByRole('combobox', { name: /sort by/i }))
    await user.click(
      await screen.findByRole('option', { name: 'Revenue growth' }),
    )

    await waitFor(() =>
      expect(lastSearchUrl(calls)).toMatch(/sort=revenue_growth/),
    )
  })

  it('flips the sort direction with the direction toggle', async () => {
    const calls = stubApi()
    const { user } = renderWithProviders(<Screener />)
    await screen.findByText('NVDA')

    // Default is descending; the toggle's label names the action it performs.
    await user.click(screen.getByRole('button', { name: /sort ascending/i }))

    await waitFor(() => expect(lastSearchUrl(calls)).toMatch(/order=asc/))
  })

  it('sorts by the combined EPS + revenue growth blend', async () => {
    const calls = stubApi()
    const { user } = renderWithProviders(<Screener />)
    await screen.findByText('NVDA')

    await user.click(screen.getByRole('combobox', { name: /sort by/i }))
    await user.click(
      await screen.findByRole('option', { name: 'Growth (EPS + Rev)' }),
    )

    await waitFor(() => expect(lastSearchUrl(calls)).toMatch(/sort=growth/))
  })

  it('filters by a market-cap tier via the market_cap param', async () => {
    const calls = stubApi()
    const { user } = renderWithProviders(<Screener />)
    await screen.findByText('NVDA')

    await user.click(screen.getByRole('combobox', { name: /market cap/i }))
    await user.click(await screen.findByRole('option', { name: /large-cap/i }))

    await waitFor(() =>
      expect(lastSearchUrl(calls)).toMatch(/market_cap=large/),
    )
  })

  it('pages through results via the offset param', async () => {
    const calls = stubApi({ ...SEARCH_PAGE, total: 60 })
    const { user } = renderWithProviders(<Screener />)
    await screen.findByText('NVDA')

    await user.click(screen.getByRole('button', { name: /go to next page/i }))

    await waitFor(() => expect(lastSearchUrl(calls)).toMatch(/offset=25/))
  })

  it('navigates to the stock page when a row is clicked', async () => {
    stubApi()
    const { user } = renderWithProviders(
      <Routes>
        <Route path="/" element={<Screener />} />
        <Route path="/stocks" element={<StockStub />} />
      </Routes>,
    )

    await user.click(
      await screen.findByRole('link', { name: /view NVDA details/i }),
    )

    expect(await screen.findByText(/stock page: NVDA/i)).toBeInTheDocument()
  })

  it('surfaces an error when the first load fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string | URL) => {
        const u = String(url)
        if (u.includes('/stocks/classifications')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(CLASSIFICATIONS),
          })
        }
        return Promise.resolve({
          ok: false,
          status: 502,
          json: () => Promise.resolve({ detail: 'Upstream is down.' }),
        })
      }),
    )
    renderWithProviders(<Screener />)

    expect(await screen.findByText('Upstream is down.')).toBeInTheDocument()
  })
})
