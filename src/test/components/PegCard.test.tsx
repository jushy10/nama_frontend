import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen } from '@/test/test-utils'
import PegCard from '@/components/PegCard'

describe('PegCard', () => {
  it('calls a sub-1 PEG cheap and labels what the figure is', () => {
    renderWithProviders(<PegCard peg={0.77} />)
    expect(screen.getByText('0.77')).toBeInTheDocument()
    expect(screen.getByText('P/E per point of EPS growth')).toBeInTheDocument()
    expect(screen.getByText('Cheap for Its Growth')).toBeInTheDocument()
    expect(screen.getByText(/price looks cheap/i)).toBeInTheDocument()
    // The basis is disclosed: trailing reported growth, not forecasts.
    expect(screen.getByText(/not\s+analyst forecasts/i)).toBeInTheDocument()
  })

  it('calls the 1–2 middle Fairly Priced', () => {
    renderWithProviders(<PegCard peg={1.27} />)
    expect(screen.getByText('Fairly Priced')).toBeInTheDocument()
    expect(screen.getByText(/roughly keeping pace/i)).toBeInTheDocument()
  })

  it('calls an over-2 PEG pricey', () => {
    renderWithProviders(<PegCard peg={2.6} />)
    expect(screen.getByText('2.60')).toBeInTheDocument()
    expect(screen.getByText('Pricey for Its Growth')).toBeInTheDocument()
    expect(screen.getByText(/run well ahead/i)).toBeInTheDocument()
  })

  it('treats the band edges as Lynch does: 1 and 2 read Fairly Priced', () => {
    const { rerender } = renderWithProviders(<PegCard peg={1} />)
    expect(screen.getByText('Fairly Priced')).toBeInTheDocument()
    rerender(<PegCard peg={2} />)
    expect(screen.getByText('Fairly Priced')).toBeInTheDocument()
  })

  it('labels a non-positive ratio Not Meaningful', () => {
    renderWithProviders(<PegCard peg={-0.5} />)
    expect(screen.getByText('Not Meaningful')).toBeInTheDocument()
    expect(
      screen.getByText(/losses or shrinking earnings/i),
    ).toBeInTheDocument()
  })

  it('shows a plain fallback and no verdict when the ratio is not served', () => {
    renderWithProviders(<PegCard peg={null} />)
    expect(screen.getByText(/no PEG data/i)).toBeInTheDocument()
    expect(screen.queryByText('Verdict')).not.toBeInTheDocument()
  })
})
