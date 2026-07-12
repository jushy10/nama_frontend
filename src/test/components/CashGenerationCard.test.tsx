import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen } from '@/test/test-utils'
import CashGenerationCard from '@/components/CashGenerationCard'
import type { TickerMetrics } from '@/lib/api'

// A metrics block with only the cash-flow fields set; the profitability/growth
// fields the card doesn't read stay null. Override per test.
const metrics = (overrides: Partial<TickerMetrics> = {}): TickerMetrics => ({
  pe: null,
  pb: null,
  ps: null,
  peg: null,
  eps: null,
  forward_pe: null,
  forward_ps: null,
  price_to_fcf: null,
  fcf_yield: null,
  ocf_yield: null,
  gross_margin: null,
  operating_margin: null,
  net_margin: null,
  roe: null,
  current_ratio: null,
  debt_to_equity: null,
  beta: null,
  revenue_growth_yoy: null,
  eps_growth_yoy: null,
  fcf_growth_yoy: null,
  forward_revenue_growth_yoy: null,
  forward_eps_growth_yoy: null,
  ...overrides,
})

describe('CashGenerationCard', () => {
  it('calls a rich FCF yield Cash Rich and shows the headline figure', () => {
    renderWithProviders(
      <CashGenerationCard metrics={metrics({ fcf_yield: 7 })} />,
    )
    expect(screen.getByText('free cash flow yield')).toBeInTheDocument()
    expect(screen.getByText('Cash Rich')).toBeInTheDocument()
    expect(screen.getByText(/bond-like cash yield/i)).toBeInTheDocument()
  })

  it('calls a mid FCF yield Cash Generative', () => {
    renderWithProviders(
      <CashGenerationCard metrics={metrics({ fcf_yield: 4.2 })} />,
    )
    expect(screen.getByText('Cash Generative')).toBeInTheDocument()
  })

  it('calls a thin FCF yield Thin Free Cash', () => {
    renderWithProviders(
      <CashGenerationCard metrics={metrics({ fcf_yield: 2.1 })} />,
    )
    expect(screen.getByText('Thin Free Cash')).toBeInTheDocument()
    expect(screen.getByText(/little cash cushion/i)).toBeInTheDocument()
  })

  it('calls a negative FCF yield Cash Burning and shows the negative headline', () => {
    renderWithProviders(
      <CashGenerationCard metrics={metrics({ fcf_yield: -1.5 })} />,
    )
    expect(screen.getByText('-1.5%')).toBeInTheDocument()
    expect(screen.getByText('Cash Burning')).toBeInTheDocument()
    expect(
      screen.getByText(/spends more cash than it brings in/i),
    ).toBeInTheDocument()
  })

  it('treats the tier thresholds as inclusive', () => {
    const { rerender } = renderWithProviders(
      <CashGenerationCard metrics={metrics({ fcf_yield: 3 })} />,
    )
    expect(screen.getByText('Cash Generative')).toBeInTheDocument()
    rerender(<CashGenerationCard metrics={metrics({ fcf_yield: 6 })} />)
    expect(screen.getByText('Cash Rich')).toBeInTheDocument()
  })

  it('shows the supporting cash figures as tiles', () => {
    renderWithProviders(
      <CashGenerationCard
        metrics={metrics({
          fcf_yield: 7,
          ocf_yield: 9,
          price_to_fcf: 14.3,
          fcf_growth_yoy: 12.5,
        })}
      />,
    )
    expect(screen.getByText('Price / FCF')).toBeInTheDocument()
    expect(screen.getByText('14.3×')).toBeInTheDocument()
    expect(screen.getByText('Operating CF yield')).toBeInTheDocument()
    expect(screen.getByText('9.0%')).toBeInTheDocument()
    expect(screen.getByText('FCF growth (YoY)')).toBeInTheDocument()
    expect(screen.getByText('+12.5%')).toBeInTheDocument()
  })

  it('splits operating cash into free cash and capex in the conversion bar', () => {
    renderWithProviders(
      <CashGenerationCard metrics={metrics({ fcf_yield: 6, ocf_yield: 9 })} />,
    )
    expect(screen.getByText('Free cash')).toBeInTheDocument()
    expect(screen.getByText('Reinvested (capex)')).toBeInTheDocument()
    // Capex drag is the gap between operating (9%) and free (6%) cash yield.
    expect(screen.getByText('3.0%')).toBeInTheDocument()
  })

  it('marks a non-meaningful Price/FCF (negative free cash) as n/m', () => {
    renderWithProviders(
      <CashGenerationCard
        metrics={metrics({ fcf_yield: -1.5, price_to_fcf: -20 })}
      />,
    )
    expect(screen.getByText('n/m')).toBeInTheDocument()
  })

  it('renders nothing when the whole cash-flow block is uncovered', () => {
    const { container } = renderWithProviders(
      <CashGenerationCard metrics={metrics()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
