import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders, screen } from '@/test/test-utils'
import QuoteGrid from '@/components/QuoteGrid'

/** Minimal ticker card — only the fields the tiles read. */
function quote(ticker: string, price: number, change: number, pct: number) {
  return { ticker, name: ticker, price, change, change_percent: pct }
}

const BY_SYMBOL: Record<string, ReturnType<typeof quote>> = {
  AAPL: quote('AAPL', 254.43, 2.1, 0.83),
  SPY: quote('SPY', 731.88, -1.74, -0.24),
}

/**
 * Answers each /stocks/{ticker,etf}/SYMBOL request from BY_SYMBOL; 404s the rest.
 * Returns the mock so a test can assert which endpoint a tile was quoted from.
 */
function stubFetch() {
  const mock = vi.fn((url: string | URL) => {
    const symbol =
      String(url).match(/\/stocks\/(?:ticker|etf)\/([^/?]+)/)?.[1] ?? ''
    const data = BY_SYMBOL[symbol]
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

describe('QuoteGrid', () => {
  it('links each tile to its snapshot and shows the logo when linkToStock is set', async () => {
    stubFetch()
    renderWithProviders(
      <QuoteGrid items={[{ label: 'Apple', symbol: 'AAPL' }]} linkToStock />,
    )

    // The tile is a link deep-linking to the ticker's snapshot page.
    const link = await screen.findByRole('link', {
      name: /view apple \(aapl\) details/i,
    })
    expect(link).toHaveAttribute('href', '/search?symbol=AAPL')

    // The company logo is rendered from the logo endpoint.
    const logo = screen.getByRole('img', { name: /aapl logo/i })
    expect(logo).toHaveAttribute(
      'src',
      expect.stringContaining('/stocks/AAPL/logo'),
    )
  })

  it('renders plain, non-linked tiles without a logo by default', async () => {
    stubFetch()
    renderWithProviders(
      <QuoteGrid items={[{ label: 'S&P 500', symbol: 'SPY' }]} />,
    )

    // The price confirms the tile resolved before we assert the negatives.
    expect(await screen.findByText('$731.88')).toBeInTheDocument()
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('quotes tiles through the ETF endpoint when etf is set', async () => {
    const fetchMock = stubFetch()
    renderWithProviders(
      <QuoteGrid items={[{ label: 'S&P 500', symbol: 'SPY' }]} etf />,
    )

    // Same rendered price, but sourced from the ETF detail endpoint.
    expect(await screen.findByText('$731.88')).toBeInTheDocument()
    const urls = fetchMock.mock.calls.map((c) => String(c[0]))
    expect(urls.some((u) => /\/stocks\/etf\/SPY/.test(u))).toBe(true)
    expect(urls.some((u) => /\/stocks\/ticker\//.test(u))).toBe(false)
  })
})
