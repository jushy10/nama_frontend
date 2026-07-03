import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen } from '@/test/test-utils'
import PegCard from '@/components/PegCard'

describe('PegCard', () => {
  it('calls a sub-1 PEG cheap and spells out the ratio math', () => {
    renderWithProviders(<PegCard peg={0.77} pe={22.9} epsGrowth={29.75} />)
    expect(screen.getByText('0.77')).toBeInTheDocument()
    expect(screen.getByText('22.9 P/E ÷ 29.8% EPS growth')).toBeInTheDocument()
    expect(screen.getByText('Cheap for Its Growth')).toBeInTheDocument()
    expect(screen.getByText(/price looks cheap/i)).toBeInTheDocument()
    // The basis is disclosed: trailing reported growth, not forecasts.
    expect(screen.getByText(/not\s+analyst forecasts/i)).toBeInTheDocument()
  })

  it('calls the 1–2 middle Fairly Priced', () => {
    renderWithProviders(<PegCard peg={1.27} pe={36.9} epsGrowth={29.0} />)
    expect(screen.getByText('Fairly Priced')).toBeInTheDocument()
    expect(screen.getByText(/roughly keeping pace/i)).toBeInTheDocument()
  })

  it('calls an over-2 PEG pricey', () => {
    renderWithProviders(<PegCard peg={2.6} pe={52.0} epsGrowth={20.0} />)
    expect(screen.getByText('2.60')).toBeInTheDocument()
    expect(screen.getByText('Pricey for Its Growth')).toBeInTheDocument()
    expect(screen.getByText(/run well ahead/i)).toBeInTheDocument()
  })

  it('treats the band edges as Lynch does: 1 and 2 read Fairly Priced', () => {
    const { rerender } = renderWithProviders(
      <PegCard peg={1} pe={30} epsGrowth={30} />,
    )
    expect(screen.getByText('Fairly Priced')).toBeInTheDocument()
    rerender(<PegCard peg={2} pe={40} epsGrowth={20} />)
    expect(screen.getByText('Fairly Priced')).toBeInTheDocument()
  })

  it('labels a non-positive ratio Not Meaningful', () => {
    renderWithProviders(<PegCard peg={-0.5} pe={12} epsGrowth={-24} />)
    expect(screen.getByText('Not Meaningful')).toBeInTheDocument()
    expect(
      screen.getByText(/losses or shrinking earnings/i),
    ).toBeInTheDocument()
  })

  it('falls back to a generic figure label when the inputs are uncovered', () => {
    renderWithProviders(<PegCard peg={1.5} pe={null} epsGrowth={null} />)
    expect(screen.getByText('1.50')).toBeInTheDocument()
    expect(screen.getByText('P/E per point of EPS growth')).toBeInTheDocument()
  })

  it('explains a null PEG by the shrinking EPS behind it', () => {
    renderWithProviders(<PegCard peg={null} pe={18.2} epsGrowth={-12.4} />)
    expect(screen.getByText(/EPS fell over the past year/i)).toBeInTheDocument()
    expect(screen.queryByText('Fairly Priced')).not.toBeInTheDocument()
  })

  it('shows a plain fallback and no verdict when there is no data at all', () => {
    renderWithProviders(<PegCard peg={null} pe={null} epsGrowth={null} />)
    expect(screen.getByText(/no PEG data/i)).toBeInTheDocument()
    expect(screen.queryByText('Verdict')).not.toBeInTheDocument()
  })
})
