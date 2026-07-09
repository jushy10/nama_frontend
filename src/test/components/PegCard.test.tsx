import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen } from '@/test/test-utils'
import PegCard from '@/components/PegCard'

describe('PegCard', () => {
  it('calls a sub-1 PEG cheap and labels the trailing reading', () => {
    renderWithProviders(<PegCard peg={0.77} />)
    expect(screen.getByText('0.77')).toBeInTheDocument()
    expect(screen.getByText('Trailing')).toBeInTheDocument()
    expect(
      screen.getByText(/last year's reported EPS growth/i),
    ).toBeInTheDocument()
    expect(screen.getByText('Cheap for Its Growth')).toBeInTheDocument()
    expect(screen.getByText(/price looks cheap/i)).toBeInTheDocument()
    // The bases are disclosed on the readings themselves: reported growth
    // trailing, expected EPS growth forward.
    expect(screen.getByText(/expected EPS growth/i)).toBeInTheDocument()
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

  it('shows a plain fallback and no verdict when neither ratio is served', () => {
    renderWithProviders(<PegCard peg={null} forwardPeg={null} />)
    expect(screen.getByText(/no PEG data/i)).toBeInTheDocument()
    expect(screen.queryByText('Verdict')).not.toBeInTheDocument()
  })

  it('shows trailing and forward readings side by side with gauge markers', () => {
    renderWithProviders(<PegCard peg={1.85} forwardPeg={1.1} />)
    expect(screen.getByText('Trailing')).toBeInTheDocument()
    expect(screen.getByText('1.85')).toBeInTheDocument()
    expect(screen.getByText('Forward')).toBeInTheDocument()
    expect(screen.getByText('1.10')).toBeInTheDocument()
    // Both markers land on the gauge, labelled by basis.
    expect(screen.getByText('TTM')).toBeInTheDocument()
    expect(screen.getByText('FWD')).toBeInTheDocument()
    // Forward < trailing → the expectations story is spelled out.
    expect(screen.getByText(/forward reading is lower/i)).toBeInTheDocument()
    // The verdict still grades the trailing ratio (1.85 → Fairly Priced).
    expect(screen.getByText('Verdict')).toBeInTheDocument()
    expect(screen.getByText('Fairly Priced')).toBeInTheDocument()
  })

  it('flags a forward reading above the trailing one as expected slowing', () => {
    renderWithProviders(<PegCard peg={1.2} forwardPeg={2.4} />)
    expect(screen.getByText(/forward reading is higher/i)).toBeInTheDocument()
  })

  it('shows an em dash and no FWD marker when only the trailing ratio is served', () => {
    renderWithProviders(<PegCard peg={1.85} />)
    expect(screen.getByText('1.85')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(
      screen.getByText(/needs a forward P\/E and expected EPS growth/i),
    ).toBeInTheDocument()
    expect(screen.getByText('TTM')).toBeInTheDocument()
    expect(screen.queryByText('FWD')).not.toBeInTheDocument()
    // No comparison line without a second reading.
    expect(screen.queryByText(/forward reading is/i)).not.toBeInTheDocument()
  })

  it('falls back to grading the forward ratio when trailing is not served', () => {
    renderWithProviders(<PegCard peg={null} forwardPeg={0.8} />)
    expect(screen.getByText('0.80')).toBeInTheDocument()
    expect(screen.getByText('Fwd verdict')).toBeInTheDocument()
    expect(screen.getByText('Cheap for Its Growth')).toBeInTheDocument()
    expect(
      screen.getByText(/needs a profitable, growing trailing year/i),
    ).toBeInTheDocument()
    expect(screen.getByText('FWD')).toBeInTheDocument()
    expect(screen.queryByText('TTM')).not.toBeInTheDocument()
  })
})
