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
  })

  it('shows the trailing YoY growth strip with signed figures', () => {
    renderWithProviders(
      <ProfitabilityCard
        netMargin={27.2}
        revenueGrowth={16.2}
        epsGrowth={68}
      />,
    )
    expect(screen.getByText('Trailing growth · YoY')).toBeInTheDocument()
    expect(screen.getByText('Revenue')).toBeInTheDocument()
    expect(screen.getByText('EPS')).toBeInTheDocument()
    expect(screen.getByText('+16.2%')).toBeInTheDocument()
    expect(screen.getByText('+68.0%')).toBeInTheDocument()
  })

  it('signs a shrinking line negative', () => {
    renderWithProviders(
      <ProfitabilityCard netMargin={5} revenueGrowth={-4.3} epsGrowth={null} />,
    )
    expect(screen.getByText('-4.3%')).toBeInTheDocument()
    // A missing side still renders its cell, as an em dash.
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('renders growth even when the margin itself is missing', () => {
    renderWithProviders(
      <ProfitabilityCard netMargin={null} revenueGrowth={12} epsGrowth={9.5} />,
    )
    expect(screen.getByText(/no net-margin data/i)).toBeInTheDocument()
    expect(screen.getByText('Trailing growth · YoY')).toBeInTheDocument()
    expect(screen.getByText('+12.0%')).toBeInTheDocument()
  })

  it('hides the growth strip when neither rate is served', () => {
    renderWithProviders(<ProfitabilityCard netMargin={27.2} />)
    expect(screen.queryByText('Trailing growth · YoY')).not.toBeInTheDocument()
  })
})
