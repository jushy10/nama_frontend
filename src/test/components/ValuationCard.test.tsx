import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen } from '@/test/test-utils'
import ValuationCard from '@/components/ValuationCard'
import type { TickerMetrics } from '@/lib/api'

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

describe('ValuationCard', () => {
  it('leads with the trailing P/E and its forward re-rate', () => {
    renderWithProviders(
      <ValuationCard metrics={metrics({ pe: 28.53, forward_pe: 24.0 })} />,
    )
    expect(screen.getByText('Valuation')).toBeInTheDocument()
    // Trailing P/E appears as the hero and again on the slope's "Now" legend.
    expect(screen.getAllByText('28.5×').length).toBeGreaterThan(0)
    expect(screen.getByText('trailing P/E')).toBeInTheDocument()
    // The slope legend names the now and next-year multiples.
    expect(screen.getByText('Now')).toBeInTheDocument()
    expect(screen.getByText('Next year')).toBeInTheDocument()
    expect(screen.getByText('24.0×')).toBeInTheDocument()
  })

  it('grades the PEG cheap / fair / rich for the growth behind it', () => {
    const { rerender } = renderWithProviders(
      <ValuationCard metrics={metrics({ pe: 20, peg: 0.8 })} />,
    )
    expect(screen.getByText('Cheap for Growth')).toBeInTheDocument()

    rerender(<ValuationCard metrics={metrics({ pe: 20, peg: 1.5 })} />)
    expect(screen.getByText('Fairly Priced')).toBeInTheDocument()

    rerender(<ValuationCard metrics={metrics({ pe: 20, peg: 2.6 })} />)
    expect(screen.getByText('Priced for Growth')).toBeInTheDocument()
  })

  it('shows P/S with its forward figure, P/B and EPS as supporting stats', () => {
    renderWithProviders(
      <ValuationCard
        metrics={metrics({
          pe: 20,
          ps: 7.1,
          forward_ps: 6.4,
          pb: 15.2,
          eps: 6.1,
        })}
      />,
    )
    expect(screen.getByText('7.1×')).toBeInTheDocument()
    expect(screen.getByText('→ 6.4×')).toBeInTheDocument() // forward P/S beside it
    expect(screen.getByText('15.2×')).toBeInTheDocument()
    expect(screen.getByText('$6.10')).toBeInTheDocument()
  })

  it('explains a trailing loss instead of a meaningless P/E', () => {
    renderWithProviders(
      <ValuationCard metrics={metrics({ pe: null, ps: 7.1 })} />,
    )
    expect(screen.getByText(/ran at a loss/i)).toBeInTheDocument()
    expect(screen.getByText('7.1×')).toBeInTheDocument() // the covered stat still shows
  })

  it('self-hides when no valuation figure is covered', () => {
    const { container } = renderWithProviders(
      <ValuationCard metrics={metrics()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
