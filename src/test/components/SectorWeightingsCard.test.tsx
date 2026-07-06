import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen } from '@/test/test-utils'
import SectorWeightingsCard from '@/components/SectorWeightingsCard'
import type { EtfSectorWeight } from '@/lib/api'

const weightings: EtfSectorWeight[] = [
  { sector: 'technology', weight: 39.13 },
  { sector: 'financial_services', weight: 10.92 },
  { sector: 'health_care', weight: 8.32 },
]

describe('SectorWeightingsCard', () => {
  it('lists sectors, humanized, with their weights', () => {
    renderWithProviders(<SectorWeightingsCard weightings={weightings} />)
    expect(
      screen.getByRole('heading', { name: 'Sector Weightings' }),
    ).toBeInTheDocument()
    // Slugs are humanized for display.
    expect(screen.getByText('Technology')).toBeInTheDocument()
    expect(screen.getByText('39.13%')).toBeInTheDocument()
    expect(screen.getByText('Financial Services')).toBeInTheDocument()
    expect(screen.getByText('10.92%')).toBeInTheDocument()
  })

  it('renders nothing when the breakdown is unavailable', () => {
    const { container } = renderWithProviders(
      <SectorWeightingsCard weightings={[]} />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
