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
      pe_ratio: 33.36,
      revenue_growth_yoy: 61.6,
      eps_growth_yoy: 587.4,
      forward_revenue_growth_yoy: 45.2,
      forward_eps_growth_yoy: 52.8,
      in_sp500: true,
      in_nasdaq100: true,
    },
    {
      ticker: 'XOM',
      name: 'Exxon Mobil',
      sector: 'energy',
      industry: 'oil_gas_integrated',
      market_cap: 5.0e11,
      pe_ratio: null,
      revenue_growth_yoy: -2.0,
      eps_growth_yoy: 3.1,
      forward_revenue_growth_yoy: null,
      forward_eps_growth_yoy: 4.0,
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

type Interp = {
  query: string | null
  sectors: string[]
  industries: string[]
  in_sp500: boolean | null
  in_nasdaq100: boolean | null
  market_cap_tiers: string[]
  sort: string | null
  direction: string
  limit: number | null
}

/**
 * Like `stubApi`, but also answers /stocks/ai-search with an AiScreenResponse
 * carrying the given interpreted filters (the search page rides along as its
 * `results`). Everything else routes as in `stubApi`.
 */
function stubApiWithAi(interpreted: Interp) {
  const calls: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string | URL) => {
      const u = String(url)
      calls.push(u)
      const body = u.includes('/stocks/ai-search')
        ? { interpreted } // the endpoint returns only the interpreted filters
        : u.includes('/stocks/classifications')
          ? CLASSIFICATIONS
          : SEARCH_PAGE
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(body),
      })
    }),
  )
  return calls
}

const NEUTRAL_INTERP: Interp = {
  query: null,
  sectors: [],
  industries: [],
  in_sp500: null,
  in_nasdaq100: null,
  market_cap_tiers: [],
  sort: null,
  direction: 'desc',
  limit: null,
}

afterEach(() => vi.unstubAllGlobals())

describe('Screener', () => {
  it('lists the screened universe with market cap, valuation and growth', async () => {
    stubApi()
    renderWithProviders(<Screener />)

    expect(await screen.findByText('NVDA')).toBeInTheDocument()
    expect(screen.getByText('Nvidia')).toBeInTheDocument()
    expect(screen.getByText('XOM')).toBeInTheDocument()
    // Compact market cap, the P/E multiple, signed trailing growth, and the
    // total-count summary.
    expect(screen.getByText('$3.2T')).toBeInTheDocument()
    expect(screen.getByText('33.36')).toBeInTheDocument()
    expect(screen.getByText('+61.6%')).toBeInTheDocument()
    expect(screen.getByText(/2 stocks/)).toBeInTheDocument()
    // The forward-growth columns render their own FY1→FY2 consensus figures.
    expect(screen.getByText('Fwd Rev')).toBeInTheDocument()
    expect(screen.getByText('Fwd EPS')).toBeInTheDocument()
    expect(screen.getByText('+45.2%')).toBeInTheDocument()
    expect(screen.getByText('+52.8%')).toBeInTheDocument()
  })

  it('sorts by market cap (largest first) by default', async () => {
    const calls = stubApi()
    renderWithProviders(<Screener />)
    await screen.findByText('NVDA')

    const url = lastSearchUrl(calls)
    expect(url).toMatch(/[?&]sort=market_cap(&|$)/)
    expect(url).toMatch(/[?&]order=desc(&|$)/)
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

  it('filters by several sectors at once (repeated sector params)', async () => {
    const calls = stubApi()
    const { user } = renderWithProviders(<Screener />)
    await screen.findByText('NVDA')

    // The multi-select stays open across picks, so both sectors land in one go
    // and ride out as repeated `sector` params (an OR set).
    await user.click(screen.getByRole('combobox', { name: /sector/i }))
    await user.click(await screen.findByRole('option', { name: 'Technology' }))
    await user.click(await screen.findByRole('option', { name: 'Energy' }))

    await waitFor(() => {
      const url = lastSearchUrl(calls)
      expect(url).toMatch(/sector=technology/)
      expect(url).toMatch(/sector=energy/)
    })
  })

  it('filters by index membership', async () => {
    const calls = stubApi()
    const { user } = renderWithProviders(<Screener />)
    await screen.findByText('NVDA')

    // Exact name: the AI-screen box also offers an example chip mentioning
    // "S&P 500", so a loose regex would match two buttons.
    await user.click(screen.getByRole('button', { name: 'S&P 500' }))

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

  it('sorts by P/E when its column header is clicked', async () => {
    const calls = stubApi()
    const { user } = renderWithProviders(<Screener />)
    await screen.findByText('NVDA')

    await user.click(screen.getByText('P/E'))

    await waitFor(() => expect(lastSearchUrl(calls)).toMatch(/sort=pe(&|$)/))
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

    // A sort is active on landing (market cap, descending), so the direction
    // toggle is live immediately; its label names the action it performs.
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

  it('sorts by forward revenue growth via its column header', async () => {
    const calls = stubApi()
    const { user } = renderWithProviders(<Screener />)
    await screen.findByText('NVDA')

    await user.click(screen.getByText('Fwd Rev'))

    await waitFor(() =>
      expect(lastSearchUrl(calls)).toMatch(/sort=forward_revenue_growth/),
    )
    expect(lastSearchUrl(calls)).toMatch(/order=desc/)
  })

  it('sorts by the forward growth blend from the "Sort by" menu', async () => {
    const calls = stubApi()
    const { user } = renderWithProviders(<Screener />)
    await screen.findByText('NVDA')

    await user.click(screen.getByRole('combobox', { name: /sort by/i }))
    await user.click(
      await screen.findByRole('option', { name: 'Forward growth (EPS + Rev)' }),
    )

    await waitFor(() =>
      expect(lastSearchUrl(calls)).toMatch(/sort=forward_growth/),
    )
  })

  it('clears an active sort back to none via the "None" option', async () => {
    const calls = stubApi()
    const { user } = renderWithProviders(<Screener />)
    await screen.findByText('NVDA')

    // Sort by something, then pick "None" to return to the unsorted default.
    await user.click(screen.getByText('EPS Growth'))
    await waitFor(() => expect(lastSearchUrl(calls)).toMatch(/sort=eps_growth/))

    await user.click(screen.getByRole('combobox', { name: /sort by/i }))
    await user.click(await screen.findByRole('option', { name: 'None' }))

    await waitFor(() => {
      const url = lastSearchUrl(calls)
      expect(url).not.toMatch(/[?&]sort=/)
      expect(url).not.toMatch(/[?&]order=/)
    })
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
        <Route path="/search" element={<StockStub />} />
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

  it('applies the AI-interpreted filters to the manual search', async () => {
    const calls = stubApiWithAi({
      ...NEUTRAL_INTERP,
      sectors: ['technology'],
      market_cap_tiers: ['mega'],
      sort: 'market_cap',
      direction: 'desc',
    })
    const { user } = renderWithProviders(<Screener />)
    await screen.findByText('NVDA')

    await user.type(
      screen.getByRole('textbox', { name: /describe the stocks/i }),
      'big tech',
    )
    await user.click(screen.getByRole('button', { name: /^screen$/i }))

    // The request went to the AI endpoint, and its interpreted filters then flow
    // into the ordinary /stocks/ticker search.
    await waitFor(() =>
      expect(calls.some((u) => u.includes('/stocks/ai-search'))).toBe(true),
    )
    await waitFor(() => {
      const url = lastSearchUrl(calls)
      expect(url).toMatch(/[?&]sector=technology(&|$)/)
      expect(url).toMatch(/[?&]market_cap=mega(&|$)/)
    })
    // The applied filters surface as removable chips (the interpretation is visible
    // and editable, not a black box).
    expect(screen.getByText('Mega-cap')).toBeInTheDocument()
  })

  it('runs an example prompt in one tap', async () => {
    const calls = stubApiWithAi({
      ...NEUTRAL_INTERP,
      in_sp500: true,
      sort: 'revenue_growth',
    })
    const { user } = renderWithProviders(<Screener />)
    await screen.findByText('NVDA')

    await user.click(
      screen.getByRole('button', {
        name: 'Top S&P 500 names by revenue growth',
      }),
    )

    await waitFor(() => {
      const url = lastSearchUrl(calls)
      expect(url).toMatch(/[?&]in_sp500=true(&|$)/)
      expect(url).toMatch(/[?&]sort=revenue_growth(&|$)/)
    })
  })

  it('surfaces an AI translation failure without breaking the list', async () => {
    const calls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string | URL) => {
        const u = String(url)
        calls.push(u)
        if (u.includes('/stocks/ai-search')) {
          return Promise.resolve({
            ok: false,
            status: 502,
            json: () =>
              Promise.resolve({
                detail: 'AI stock screening is temporarily unavailable.',
              }),
          })
        }
        const body = u.includes('/stocks/classifications')
          ? CLASSIFICATIONS
          : SEARCH_PAGE
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(body),
        })
      }),
    )
    const { user } = renderWithProviders(<Screener />)
    await screen.findByText('NVDA')

    await user.type(
      screen.getByRole('textbox', { name: /describe the stocks/i }),
      'something',
    )
    await user.click(screen.getByRole('button', { name: /^screen$/i }))

    // The error shows in the AI box; the list stays intact.
    expect(
      await screen.findByText(/AI stock screening is temporarily unavailable/i),
    ).toBeInTheDocument()
    expect(screen.getByText('NVDA')).toBeInTheDocument()
  })
})
