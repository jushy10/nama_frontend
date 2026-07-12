import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen } from '@/test/test-utils'
import FinancialHealthCard from '@/components/FinancialHealthCard'
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

describe('FinancialHealthCard', () => {
  it('grades leverage low / moderate / high from debt-to-equity', () => {
    const { rerender } = renderWithProviders(
      <FinancialHealthCard metrics={metrics({ debt_to_equity: 0.8 })} />,
    )
    expect(screen.getByText('Financial Health')).toBeInTheDocument()
    expect(screen.getByText('Low Debt')).toBeInTheDocument()
    expect(screen.getByText('0.80×')).toBeInTheDocument() // the hero figure

    rerender(
      <FinancialHealthCard metrics={metrics({ debt_to_equity: 1.54 })} />,
    )
    expect(screen.getByText('Moderate Debt')).toBeInTheDocument()

    rerender(<FinancialHealthCard metrics={metrics({ debt_to_equity: 2.6 })} />)
    expect(screen.getByText('High Leverage')).toBeInTheDocument()
  })

  it('reads liquidity against the 1.0 line — a tight ratio is flagged', () => {
    renderWithProviders(
      <FinancialHealthCard
        metrics={metrics({ debt_to_equity: 1.0, current_ratio: 0.87 })}
      />,
    )
    expect(screen.getByText('0.87 current ratio')).toBeInTheDocument()
    expect(screen.getByText(/short-term bills outrun/i)).toBeInTheDocument()
  })

  it('shows beta as the market-volatility figure', () => {
    renderWithProviders(
      <FinancialHealthCard
        metrics={metrics({ debt_to_equity: 1.0, beta: 1.24 })}
      />,
    )
    expect(screen.getByText('Beta (volatility vs market)')).toBeInTheDocument()
    expect(screen.getByText('1.24')).toBeInTheDocument()
  })

  it('gives no leverage verdict for negative equity', () => {
    // A negative debt/equity (negative equity) isn't a clean high/low read — it's
    // explained rather than gauged, and the rest of the card still shows.
    renderWithProviders(
      <FinancialHealthCard
        metrics={metrics({ debt_to_equity: -3.0, beta: 1.1 })}
      />,
    )
    expect(screen.queryByText('Low Debt')).not.toBeInTheDocument()
    expect(screen.queryByText('High Leverage')).not.toBeInTheDocument()
    expect(screen.getByText(/equity is negative/i)).toBeInTheDocument()
    expect(screen.getByText('1.10')).toBeInTheDocument() // beta still shows
  })

  it('self-hides when leverage, liquidity and beta are all uncovered', () => {
    const { container } = renderWithProviders(
      <FinancialHealthCard metrics={metrics()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
