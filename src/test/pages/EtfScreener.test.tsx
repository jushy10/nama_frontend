import { afterEach, describe, expect, it, vi } from 'vitest'
import { Route, Routes, useSearchParams } from 'react-router-dom'
import { renderWithProviders, screen, waitFor } from '@/test/test-utils'
import EtfScreener from '@/pages/EtfScreener'

/** Minimal stand-in for the fund page that echoes the ?symbol= it received. */
function EtfStub() {
  const [params] = useSearchParams()
  return <div>fund page: {params.get('symbol')}</div>
}

const SEARCH_PAGE = {
  total: 2,
  limit: 25,
  offset: 0,
  count: 2,
  results: [
    {
      ticker: 'VTI',
      name: 'Vanguard Total Stock Market ETF',
      exchange: 'NYSE',
      net_assets: 2.3e12,
      expense_ratio: 0.03,
      category: 'large_blend',
      dividend_yield: 1.23,
    },
    {
      ticker: 'GLD',
      name: 'SPDR Gold Shares',
      exchange: 'ARCA',
      net_assets: 7.8e10,
      expense_ratio: 0.4,
      category: 'commodities_focused',
      dividend_yield: null, // a non-distributing fund — renders "—"
    },
  ],
}

const CATEGORIES = {
  categories: ['commodities_focused', 'large_blend'],
}

/**
 * Route fetch by URL: /stocks/etfs/categories → the filter menu, the /stocks/etfs
 * search → the given page. Returns the list of called URLs so a test can assert
 * the query params the page sent. (The categories URL is checked first since it's
 * a prefix-extension of the search path.)
 */
function stubApi(searchPayload: unknown = SEARCH_PAGE) {
  const calls: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string | URL) => {
      const u = String(url)
      calls.push(u)
      const body = u.includes('/stocks/etfs/categories')
        ? CATEGORIES
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

/** The most recent /stocks/etfs (search) request URL. */
const lastSearchUrl = (calls: string[]) =>
  [...calls].reverse().find((u) => u.includes('/stocks/etfs?')) ?? ''

type Interp = {
  query: string | null
  categories: string[]
  sort: string | null
  direction: string
  limit: number | null
}

const NEUTRAL_INTERP: Interp = {
  query: null,
  categories: [],
  sort: null,
  direction: 'desc',
  limit: null,
}

/**
 * Like `stubApi`, but also answers /stocks/etfs/ai-search with an AiEtfScreenResponse
 * carrying the given interpreted filters. Everything else routes as in `stubApi`
 * (the ai-search path is checked first — it's a prefix-extension of the search path).
 */
function stubApiWithAi(interpreted: Interp) {
  const calls: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string | URL) => {
      const u = String(url)
      calls.push(u)
      const body = u.includes('/stocks/etfs/ai-search')
        ? { interpreted } // the endpoint returns only the interpreted filters
        : u.includes('/stocks/etfs/categories')
          ? CATEGORIES
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

afterEach(() => vi.unstubAllGlobals())

describe('EtfScreener', () => {
  it('lists the screened ETF universe with net assets, expense ratio and yield', async () => {
    stubApi()
    renderWithProviders(<EtfScreener />)

    expect(await screen.findByText('VTI')).toBeInTheDocument()
    expect(
      screen.getByText('Vanguard Total Stock Market ETF'),
    ).toBeInTheDocument()
    expect(screen.getByText('GLD')).toBeInTheDocument()
    // Compact net assets, the expense-ratio percent, the distribution yield, and
    // the total-count summary.
    expect(screen.getByText('$2.3T')).toBeInTheDocument()
    expect(screen.getByText('0.03%')).toBeInTheDocument()
    expect(screen.getByText('1.23%')).toBeInTheDocument()
    expect(screen.getByText('Div Yield')).toBeInTheDocument()
    expect(screen.getByText(/2 ETFs/)).toBeInTheDocument()
  })

  it('searches by name or ticker (debounced) via the q param', async () => {
    const calls = stubApi()
    const { user } = renderWithProviders(<EtfScreener />)
    await screen.findByText('VTI')

    await user.type(
      screen.getByRole('textbox', { name: /search name or ticker/i }),
      'gold',
    )

    await waitFor(() => expect(lastSearchUrl(calls)).toMatch(/[?&]q=gold(&|$)/))
  })

  it('filters by a category chosen from the categories menu', async () => {
    const calls = stubApi()
    const { user } = renderWithProviders(<EtfScreener />)
    await screen.findByText('VTI')

    // The menu options come from /stocks/etfs/categories, humanized.
    await user.click(screen.getByRole('combobox', { name: /category/i }))
    await user.click(await screen.findByRole('option', { name: 'Large Blend' }))

    await waitFor(() =>
      expect(lastSearchUrl(calls)).toMatch(/category=large_blend/),
    )
  })

  it('filters by several categories at once (repeated category params)', async () => {
    const calls = stubApi()
    const { user } = renderWithProviders(<EtfScreener />)
    await screen.findByText('VTI')

    // The multi-select stays open across picks, so two categories land in one go
    // and both ride out as repeated `category` params (an OR set).
    await user.click(screen.getByRole('combobox', { name: /category/i }))
    await user.click(await screen.findByRole('option', { name: 'Large Blend' }))
    await user.click(
      await screen.findByRole('option', { name: 'Commodities Focused' }),
    )

    await waitFor(() => {
      const url = lastSearchUrl(calls)
      expect(url).toMatch(/category=large_blend/)
      expect(url).toMatch(/category=commodities_focused/)
    })
  })

  it('sorts by a metric column when its header is clicked', async () => {
    const calls = stubApi()
    const { user } = renderWithProviders(<EtfScreener />)
    await screen.findByText('VTI')

    await user.click(screen.getByText('Expense Ratio'))

    await waitFor(() =>
      expect(lastSearchUrl(calls)).toMatch(/sort=expense_ratio/),
    )
    expect(lastSearchUrl(calls)).toMatch(/order=desc/)
  })

  it('sorts by dividend yield via its column header', async () => {
    const calls = stubApi()
    const { user } = renderWithProviders(<EtfScreener />)
    await screen.findByText('VTI')

    await user.click(screen.getByText('Div Yield'))

    await waitFor(() =>
      expect(lastSearchUrl(calls)).toMatch(/sort=dividend_yield/),
    )
    expect(lastSearchUrl(calls)).toMatch(/order=desc/)
  })

  it('sorts by a metric chosen from the mobile "Sort by" menu', async () => {
    const calls = stubApi()
    const { user } = renderWithProviders(<EtfScreener />)
    await screen.findByText('VTI')

    // The header sort labels are hidden on phones, so the dropdown is the way to
    // reach every metric regardless of viewport.
    await user.click(screen.getByRole('combobox', { name: /sort by/i }))
    await user.click(
      await screen.findByRole('option', { name: 'Expense ratio' }),
    )

    await waitFor(() =>
      expect(lastSearchUrl(calls)).toMatch(/sort=expense_ratio/),
    )
  })

  it('flips the sort direction with the direction toggle', async () => {
    const calls = stubApi()
    const { user } = renderWithProviders(<EtfScreener />)
    await screen.findByText('VTI')

    // Default is descending; the toggle's label names the action it performs.
    await user.click(screen.getByRole('button', { name: /sort ascending/i }))

    await waitFor(() => expect(lastSearchUrl(calls)).toMatch(/order=asc/))
  })

  it('pages through results via the offset param', async () => {
    const calls = stubApi({ ...SEARCH_PAGE, total: 60 })
    const { user } = renderWithProviders(<EtfScreener />)
    await screen.findByText('VTI')

    await user.click(screen.getByRole('button', { name: /go to next page/i }))

    await waitFor(() => expect(lastSearchUrl(calls)).toMatch(/offset=25/))
  })

  it('navigates to the fund page when a row is clicked', async () => {
    stubApi()
    const { user } = renderWithProviders(
      <Routes>
        <Route path="/" element={<EtfScreener />} />
        <Route path="/search" element={<EtfStub />} />
      </Routes>,
    )

    await user.click(
      await screen.findByRole('link', { name: /view VTI details/i }),
    )

    expect(await screen.findByText(/fund page: VTI/i)).toBeInTheDocument()
  })

  it('surfaces an error when the first load fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string | URL) => {
        const u = String(url)
        if (u.includes('/stocks/etfs/categories')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(CATEGORIES),
          })
        }
        return Promise.resolve({
          ok: false,
          status: 502,
          json: () => Promise.resolve({ detail: 'Upstream is down.' }),
        })
      }),
    )
    renderWithProviders(<EtfScreener />)

    expect(await screen.findByText('Upstream is down.')).toBeInTheDocument()
  })

  it('applies the AI-interpreted filters to the manual search', async () => {
    const calls = stubApiWithAi({
      ...NEUTRAL_INTERP,
      categories: ['large_blend'],
      sort: 'expense_ratio',
      direction: 'asc',
    })
    const { user } = renderWithProviders(<EtfScreener />)
    await screen.findByText('VTI')

    await user.type(
      screen.getByRole('textbox', { name: /describe the etfs/i }),
      'cheap index funds',
    )
    await user.click(screen.getByRole('button', { name: /^screen$/i }))

    // The request went to the AI endpoint, and its interpreted filters then flow
    // into the ordinary /stocks/etfs search.
    await waitFor(() =>
      expect(calls.some((u) => u.includes('/stocks/etfs/ai-search'))).toBe(
        true,
      ),
    )
    await waitFor(() => {
      const url = lastSearchUrl(calls)
      expect(url).toMatch(/[?&]category=large_blend(&|$)/)
      expect(url).toMatch(/[?&]sort=expense_ratio(&|$)/)
      expect(url).toMatch(/[?&]order=asc(&|$)/)
    })
    // The applied category surfaces as a removable chip (the interpretation is
    // visible and editable, not a black box) — so "Large Blend" now shows twice:
    // once in VTI's Category cell, once as the active-filter chip.
    expect(screen.getAllByText('Large Blend').length).toBeGreaterThanOrEqual(2)
  })

  it('runs an example prompt in one tap', async () => {
    const calls = stubApiWithAi({ ...NEUTRAL_INTERP, sort: 'dividend_yield' })
    const { user } = renderWithProviders(<EtfScreener />)
    await screen.findByText('VTI')

    await user.click(
      screen.getByRole('button', { name: 'High-yield dividend ETFs' }),
    )

    await waitFor(() =>
      expect(lastSearchUrl(calls)).toMatch(/[?&]sort=dividend_yield(&|$)/),
    )
  })

  it('surfaces an AI translation failure without breaking the list', async () => {
    const calls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string | URL) => {
        const u = String(url)
        calls.push(u)
        if (u.includes('/stocks/etfs/ai-search')) {
          return Promise.resolve({
            ok: false,
            status: 502,
            json: () =>
              Promise.resolve({
                detail: 'AI ETF screening is temporarily unavailable.',
              }),
          })
        }
        const body = u.includes('/stocks/etfs/categories')
          ? CATEGORIES
          : SEARCH_PAGE
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(body),
        })
      }),
    )
    const { user } = renderWithProviders(<EtfScreener />)
    await screen.findByText('VTI')

    await user.type(
      screen.getByRole('textbox', { name: /describe the etfs/i }),
      'something',
    )
    await user.click(screen.getByRole('button', { name: /^screen$/i }))

    // The error shows in the AI box; the list stays intact.
    expect(
      await screen.findByText(/AI ETF screening is temporarily unavailable/i),
    ).toBeInTheDocument()
    expect(screen.getByText('VTI')).toBeInTheDocument()
  })
})
