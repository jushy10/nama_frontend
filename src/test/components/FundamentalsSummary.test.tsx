import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen } from '@/test/test-utils'
import FundamentalsSummary from '@/components/FundamentalsSummary'

describe('FundamentalsSummary', () => {
  it('answers both questions and shows the contributing verdicts', () => {
    // Apple's shape: very profitable, thin free cash → Solid; above its own
    // history with no usable peer read → Premium.
    renderWithProviders(
      <FundamentalsSummary
        netMargin={27}
        fcfYield={2.1}
        industryStance={null}
        historyStance="above"
      />,
    )
    expect(screen.getByText('Is it a good business?')).toBeInTheDocument()
    expect(screen.getByText('Solid')).toBeInTheDocument()
    expect(screen.getByText('Highly Profitable')).toBeInTheDocument()
    expect(screen.getByText('Thin Free Cash')).toBeInTheDocument()

    expect(screen.getByText('Is the price fair?')).toBeInTheDocument()
    expect(screen.getByText('Premium')).toBeInTheDocument()
    expect(screen.getByText('Above its avg')).toBeInTheDocument()
  })

  it('labels the peer and own-history stances distinctly', () => {
    renderWithProviders(
      <FundamentalsSummary
        netMargin={30}
        fcfYield={8}
        industryStance="below"
        historyStance="in_line"
      />,
    )
    expect(screen.getByText('Strong')).toBeInTheDocument()
    // Cheap on one read, in its range on the other → a net discount.
    expect(screen.getByText('Cheap')).toBeInTheDocument()
    expect(screen.getByText('Below peers')).toBeInTheDocument()
    expect(screen.getByText('In its range')).toBeInTheDocument()
  })

  it('notes when there is no valuation data yet, without a stray answer', () => {
    renderWithProviders(
      <FundamentalsSummary
        netMargin={12}
        fcfYield={4}
        industryStance={null}
        historyStance={null}
      />,
    )
    expect(screen.getByText('Strong')).toBeInTheDocument()
    expect(
      screen.getByText(/not enough peer or history data/i),
    ).toBeInTheDocument()
  })

  it('renders nothing when neither question can be graded', () => {
    const { container } = renderWithProviders(
      <FundamentalsSummary
        netMargin={null}
        fcfYield={null}
        industryStance={null}
        historyStance={null}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
