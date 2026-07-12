import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { renderWithProviders, screen } from '@/test/test-utils'
import HeatMap from '@/components/HeatMap'
import type { HeatMap as HeatMapData } from '@/lib/api'

const perf = (oneYear: number) => ({
  '1w': 1,
  '1m': 8,
  '3m': 15,
  '6m': 40,
  ytd: 30,
  '1y': oneYear,
})

const sample: HeatMapData = {
  scope: 'sp500',
  count: 3,
  sectors: [
    {
      sector: 'technology',
      market_cap: 6e12,
      industries: [
        {
          industry: 'semiconductors',
          market_cap: 4e12,
          stocks: [
            {
              ticker: 'NVDA',
              name: 'NVIDIA',
              market_cap: 3e12,
              change_percent: -0.99,
              performance: perf(155.5),
            },
            {
              ticker: 'AVGO',
              name: 'Broadcom',
              market_cap: 1e12,
              change_percent: 3.27,
              performance: perf(60),
            },
          ],
        },
      ],
    },
    {
      sector: 'financials',
      market_cap: 2e12,
      industries: [
        {
          industry: 'banks',
          market_cap: 2e12,
          stocks: [
            {
              ticker: 'JPM',
              name: 'JPMorgan',
              market_cap: 2e12,
              change_percent: 1.7,
              performance: perf(20),
            },
          ],
        },
      ],
    },
  ],
}

describe('HeatMap', () => {
  it('renders a tile per stock with its ticker label', () => {
    const { container } = renderWithProviders(<HeatMap data={sample} />)
    expect(screen.getByRole('img', { name: /heat map/i })).toBeInTheDocument()
    // Large tiles in a big viewBox -> every ticker label is drawn.
    expect(screen.getByText('NVDA')).toBeInTheDocument()
    expect(screen.getByText('AVGO')).toBeInTheDocument()
    expect(screen.getByText('JPM')).toBeInTheDocument()
    // One <rect> per stock tile (plus the canvas + sector borders), so at least 3.
    expect(container.querySelectorAll('rect').length).toBeGreaterThanOrEqual(3)
  })

  it('shows the sector name band', () => {
    renderWithProviders(<HeatMap data={sample} />)
    expect(screen.getByText('technology')).toBeInTheDocument()
    expect(screen.getByText('financials')).toBeInTheDocument()
  })

  it('labels each tile with the day move by default', () => {
    renderWithProviders(<HeatMap data={sample} />)
    // Big tiles in a big viewBox -> the percent stacks under every ticker.
    expect(screen.getByText('-0.99%')).toBeInTheDocument() // NVDA day move
    expect(screen.getByText('+1.70%')).toBeInTheDocument() // JPM day move
  })

  it('recolours and relabels tiles by the selected timeframe window', () => {
    renderWithProviders(<HeatMap data={sample} window="1y" />)
    // The 1Y window reads each tile's trailing performance, not the day move.
    expect(screen.getByText('+155.50%')).toBeInTheDocument() // NVDA 1y
    expect(screen.getByText('+20.00%')).toBeInTheDocument() // JPM 1y
    // ...and the day-move figure is no longer shown.
    expect(screen.queryByText('-0.99%')).not.toBeInTheDocument()
  })

  it('leaves a window with no performance data uncoloured (neutral, em-dash)', () => {
    // A board whose tiles carry no `performance` (e.g. before the backend ships it):
    // every non-day window has no value, so tiles read as an em-dash.
    const noPerf: HeatMapData = {
      ...sample,
      sectors: sample.sectors.map((s) => ({
        ...s,
        industries: s.industries.map((i) => ({
          ...i,
          stocks: i.stocks.map((st) => ({ ...st, performance: null })),
        })),
      })),
    }
    renderWithProviders(<HeatMap data={noPerf} window="1m" />)
    expect(screen.getByText('NVDA')).toBeInTheDocument()
    // No 1M value anywhere -> the tile prints the placeholder dash instead of a percent.
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1)
  })
})

describe('HeatMap on mobile', () => {
  // useMediaQuery reads matchMedia, which jsdom doesn't provide (so the component
  // renders its desktop board everywhere else). Force it true here to exercise the
  // mobile board and its tap-to-inspect sheet, then restore it for other suites.
  const realMatchMedia = window.matchMedia
  beforeEach(() => {
    window.matchMedia = ((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia
  })
  afterEach(() => {
    window.matchMedia = realMatchMedia
  })

  it('opens a tap-to-inspect sheet instead of navigating', async () => {
    const { user } = renderWithProviders(<HeatMap data={sample} />)

    const tile = screen.getByText('NVDA').closest('g')
    expect(tile).not.toBeNull()
    await user.click(tile as Element)

    // The sheet surfaces the details a hover tooltip can't reach on touch, plus a
    // clear button to actually open the stock.
    expect(
      await screen.findByRole('button', { name: /open nvda/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('NVIDIA')).toBeInTheDocument()
    expect(screen.getByText('Semiconductors')).toBeInTheDocument()
  })
})
