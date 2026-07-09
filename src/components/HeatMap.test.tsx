import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen } from '@/test/test-utils'
import HeatMap from '@/components/HeatMap'
import type { HeatMap as HeatMapData } from '@/lib/api'

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
            },
            {
              ticker: 'AVGO',
              name: 'Broadcom',
              market_cap: 1e12,
              change_percent: 3.27,
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
})
