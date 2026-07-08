import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen } from '@/test/test-utils'
import IndustryPeCard from '@/components/IndustryPeCard'
import type { IndustryValuation } from '@/lib/api'

const valuation = (
  overrides: Partial<IndustryValuation> = {},
): IndustryValuation => ({
  industry: 'semiconductors',
  count: 34,
  median_pe: 20,
  p25_pe: 15,
  p75_pe: 30,
  ...overrides,
})

describe('IndustryPeCard', () => {
  it('grades a rich multiple Above Peers with the humanized industry', () => {
    renderWithProviders(<IndustryPeCard stockPe={30} valuation={valuation()} />)
    expect(screen.getByText('Industry P/E')).toBeInTheDocument()
    expect(screen.getByText(/vs\. Semiconductors peers/i)).toBeInTheDocument()
    expect(screen.getByText('Above Peers')).toBeInTheDocument()
    // 30 vs a 20 median → about 50% above, spelled out in plain words.
    expect(screen.getByText(/about 50% above/i)).toBeInTheDocument()
    // The stock's own P/E lands on the peer-range bar.
    expect(screen.getByText('This stock')).toBeInTheDocument()
  })

  it('grades a cheap multiple Below Peers', () => {
    renderWithProviders(<IndustryPeCard stockPe={12} valuation={valuation()} />)
    expect(screen.getByText('Below Peers')).toBeInTheDocument()
    expect(screen.getByText(/about 40% below/i)).toBeInTheDocument()
  })

  it('calls a multiple within ±10% In Line, with no percentage', () => {
    renderWithProviders(<IndustryPeCard stockPe={21} valuation={valuation()} />)
    expect(screen.getByText('In Line')).toBeInTheDocument()
    expect(screen.getByText(/roughly in line/i)).toBeInTheDocument()
  })

  it('drops the verdict and marker when the stock has no trailing P/E', () => {
    renderWithProviders(
      <IndustryPeCard stockPe={null} valuation={valuation()} />,
    )
    // No stance → no verdict chip, no on-bar marker for the stock.
    expect(screen.queryByText('Above Peers')).not.toBeInTheDocument()
    expect(screen.queryByText('Below Peers')).not.toBeInTheDocument()
    expect(screen.queryByText('This stock')).not.toBeInTheDocument()
    // The peer benchmark still reads, and the em dash marks the missing P/E.
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(
      screen.getByText(/typical Semiconductors stock trades around a P\/E/i),
    ).toBeInTheDocument()
  })

  it('renders nothing when the benchmark has no valued peers', () => {
    const { container } = renderWithProviders(
      <IndustryPeCard
        stockPe={25}
        valuation={valuation({
          count: 0,
          median_pe: null,
          p25_pe: null,
          p75_pe: null,
        })}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('omits the range bar when the industry has a single valued peer', () => {
    renderWithProviders(
      <IndustryPeCard
        stockPe={25}
        valuation={valuation({ count: 1, p25_pe: null, p75_pe: null })}
      />,
    )
    // Median still reads and the stance is graded, but there's no IQR band.
    expect(screen.getByText('Above Peers')).toBeInTheDocument()
    expect(screen.queryByText('25th')).not.toBeInTheDocument()
    expect(screen.queryByText('75th')).not.toBeInTheDocument()
    // The footnote singularizes the peer count.
    expect(screen.getByText(/across 1 peer with/i)).toBeInTheDocument()
  })
})
