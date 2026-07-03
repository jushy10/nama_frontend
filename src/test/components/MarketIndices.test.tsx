import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders, screen } from '@/test/test-utils'
import MarketIndices from '@/components/MarketIndices'

/** Minimal snapshot — only the fields the index tiles read. */
function quote(symbol: string, price: number, change: number, pct: number) {
  return {
    symbol,
    name: symbol,
    price,
    change,
    change_percent: pct,
  }
}

const BY_SYMBOL: Record<string, ReturnType<typeof quote>> = {
  SPY: quote('SPY', 731.88, -1.74, -0.24),
  QQQ: quote('QQQ', 706.47, 7.11, 1.0),
}

/** Answers each /stocks/SYMBOL request from BY_SYMBOL; 404s the rest. */
function stubFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string | URL) => {
      const symbol = String(url).split('/stocks/')[1]?.split(/[/?]/)[0] ?? ''
      const data = BY_SYMBOL[symbol]
      return Promise.resolve({
        ok: data != null,
        status: data != null ? 200 : 404,
        json: () =>
          Promise.resolve(data ?? { detail: `No data for ${symbol}.` }),
      })
    }),
  )
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
})
