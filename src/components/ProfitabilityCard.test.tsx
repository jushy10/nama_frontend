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
    const { rerender } = renderWithProviders(<ProfitabilityCard netMargin={10} />)
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
})
