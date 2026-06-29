import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen } from '@/test/test-utils'
import DcaCard from '@/components/DcaCard'

describe('DcaCard', () => {
  it('calls Buy on a 10–20% drawdown and shows the depth', () => {
    renderWithProviders(<DcaCard drawdown={-18.88} />)
    expect(screen.getByText('18.9%')).toBeInTheDocument()
    expect(screen.getByText('below all-time high')).toBeInTheDocument()
    expect(screen.getByText('Buy')).toBeInTheDocument()
    expect(
      screen.getByText(/reasonable spot to start averaging in/i),
    ).toBeInTheDocument()
  })

  it('calls Moderate Buy on a 20–30% drawdown', () => {
    renderWithProviders(<DcaCard drawdown={-24.5} />)
    expect(screen.getByText('Moderate Buy')).toBeInTheDocument()
  })

  it('calls Strong Buy on a 30%+ drawdown', () => {
    renderWithProviders(<DcaCard drawdown={-42.1} />)
    expect(screen.getByText('Strong Buy')).toBeInTheDocument()
  })

  it('treats the tier thresholds as inclusive', () => {
    const { rerender } = renderWithProviders(<DcaCard drawdown={-10} />)
    expect(screen.getByText('Buy')).toBeInTheDocument()
    rerender(<DcaCard drawdown={-20} />)
    expect(screen.getByText('Moderate Buy')).toBeInTheDocument()
    rerender(<DcaCard drawdown={-30} />)
    expect(screen.getByText('Strong Buy')).toBeInTheDocument()
  })

  it('holds when the stock sits near its high', () => {
    renderWithProviders(<DcaCard drawdown={-4.2} />)
    expect(screen.getByText('Hold')).toBeInTheDocument()
    expect(screen.queryByText('Buy')).not.toBeInTheDocument()
  })

  it('shows a fallback and no recommendation when there is no drawdown', () => {
    renderWithProviders(<DcaCard drawdown={null} />)
    expect(screen.getByText(/no all-time-high data/i)).toBeInTheDocument()
    expect(screen.queryByText('Buy')).not.toBeInTheDocument()
    expect(screen.queryByText('Hold')).not.toBeInTheDocument()
  })
})
