import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen } from '@/test/test-utils'
import ProfitabilityCard from '@/components/ProfitabilityCard'

describe('ProfitabilityCard', () => {
  it('calls a fat margin Highly Profitable and shows the figure', () => {
    renderWithProviders(<ProfitabilityCard netMargin={25.3} />)
    expect(screen.getByText('25.3%')).toBeInTheDocument()
    expect(screen.getByText('net profit margin')).toBeInTheDocument()
    expect(screen.getByText('Highly Profitable')).toBeInTheDocument()
    expect(screen.getByText(/exceptional net margin/i)).toBeInTheDocument()
  })

  it('calls a double-digit margin Profitable', () => {
    renderWithProviders(<ProfitabilityCard netMargin={14.2} />)
    expect(screen.getByText('Profitable')).toBeInTheDocument()
  })

  it('calls a thin single-digit margin Marginally Profitable', () => {
    renderWithProviders(<ProfitabilityCard netMargin={3.5} />)
    expect(screen.getByText('Marginally Profitable')).toBeInTheDocument()
    expect(screen.getByText(/thin net margin/i)).toBeInTheDocument()
  })

  it('calls a loss Unprofitable and shows the negative margin', () => {
    renderWithProviders(<ProfitabilityCard netMargin={-8.7} />)
    expect(screen.getByText('-8.7%')).toBeInTheDocument()
    expect(screen.getByText('Unprofitable')).toBeInTheDocument()
    expect(screen.getByText(/spends more than it earns/i)).toBeInTheDocument()
  })

  it('treats the tier thresholds as inclusive', () => {
    const { rerender } = renderWithProviders(
      <ProfitabilityCard netMargin={10} />,
    )
    expect(screen.getByText('Profitable')).toBeInTheDocument()
    rerender(<ProfitabilityCard netMargin={20} />)
    expect(screen.getByText('Highly Profitable')).toBeInTheDocument()
  })

  it('shows a fallback and no verdict when there is no margin data', () => {
    renderWithProviders(<ProfitabilityCard netMargin={null} />)
    expect(screen.getByText(/no net-margin data/i)).toBeInTheDocument()
    expect(screen.queryByText('Profitable')).not.toBeInTheDocument()
    expect(screen.queryByText('Unprofitable')).not.toBeInTheDocument()
    // No net margin means no card body — the secondary margins don't show either.
    expect(screen.queryByText('Gross margin')).not.toBeInTheDocument()
  })

  it('breaks out the gross and operating margins beside the net headline', () => {
    renderWithProviders(
      <ProfitabilityCard
        netMargin={27.2}
        grossMargin={47.9}
        operatingMargin={32.6}
      />,
    )
    expect(screen.getByText('Gross margin')).toBeInTheDocument()
    expect(screen.getByText('47.9%')).toBeInTheDocument()
    expect(screen.getByText('Operating margin')).toBeInTheDocument()
    expect(screen.getByText('32.6%')).toBeInTheDocument()
  })

  it('dashes the secondary margins when the vendor does not cover them', () => {
    renderWithProviders(<ProfitabilityCard netMargin={27.2} />)
    expect(screen.getByText('Gross margin')).toBeInTheDocument()
    expect(screen.getByText('Operating margin')).toBeInTheDocument()
    // Both secondary tiles fall back to an em dash; the net headline still reads.
    expect(screen.getAllByText('—')).toHaveLength(2)
  })
})
