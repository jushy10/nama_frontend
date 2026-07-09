import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders, screen, waitFor } from '@/test/test-utils'
import MegaCapGrowthLeaders from '@/components/MegaCapGrowthLeaders'

// A screened row carries stored facts (no live price); the trailing and forward
// growth pairs are what the two lists surface.
const row = (over: Record<string, unknown>) => ({
  ticker: 'NVDA',
  name: 'NVIDIA Corporation',
  sector: 'technology',
  industry: 'semiconductors',
  market_cap: 3.4e12,
  pe_ratio: 55,
  revenue_growth_yoy: 94.5,
  eps_growth_yoy: 120.2,
  forward_revenue_growth_yoy: 42.1,
  forward_eps_growth_yoy: 38.7,
  in_sp500: true,
  in_nasdaq100: true,
  ...over,
})

const page = {
  total: 2,
  limit: 10,
  offset: 0,
  count: 2,
  results: [row({}), row({ ticker: 'META', name: 'Meta Platforms, Inc.' })],
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

afterEach(() => vi.unstubAllGlobals())

describe('MegaCapGrowthLeaders', () => {
  it('renders both mega-cap lists with their trailing and forward figures', async () => {
    stubFetch(page)
    renderWithProviders(<MegaCapGrowthLeaders />)

    expect(
      screen.getByRole('heading', { name: /mega-cap growth leaders/i }),
    ).toBeInTheDocument()

    // Both lists render, each keyed off its own blend sort.
    expect(await screen.findByText('Trailing growth')).toBeInTheDocument()
    expect(screen.getByText('Forward growth')).toBeInTheDocument()

    // The same leader appears once per card (both lists share the stubbed page).
    // Each list is its own query, so wait until both have settled.
    await waitFor(() => expect(screen.getAllByText('NVDA')).toHaveLength(2))

    // Trailing figures come from the *_yoy pair, forward from forward_*_yoy.
    expect(screen.getAllByText('+94.5%').length).toBeGreaterThan(0)
    expect(screen.getAllByText('+42.1%').length).toBeGreaterThan(0)

    // Each list is filtered to mega caps and sorted by its own server-side blend.
    const urls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => String(c[0]),
    )
    expect(urls.some((u) => u.includes('/stocks/ticker'))).toBe(true)
    expect(urls.every((u) => u.includes('market_cap=mega'))).toBe(true)
    expect(urls.some((u) => u.includes('sort=growth'))).toBe(true)
    expect(urls.some((u) => u.includes('sort=forward_growth'))).toBe(true)
  })

  it('rows open the stock detail page', async () => {
    stubFetch(page)
    renderWithProviders(<MegaCapGrowthLeaders />)

    await waitFor(() =>
      expect(
        screen.getAllByRole('link', { name: /view nvda details/i }),
      ).toHaveLength(2),
    )
  })
})
