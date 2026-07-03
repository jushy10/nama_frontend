import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen } from '@/test/test-utils'
import OptionsCard from '@/components/OptionsCard'
import type { OptionsMetrics } from '@/lib/api'

const FULL: OptionsMetrics = {
  implied_volatility: 30.01,
  expected_move_percent: 6.4,
  expected_move_by: '2026-07-31',
  insurance_cost_percent: 4.9,
  insurance_expires: '2026-09-18',
  put_call_ratio: 0.24,
}

describe('OptionsCard', () => {
  it('shows all four figures with their expiry context', () => {
    renderWithProviders(<OptionsCard metrics={FULL} />)
    expect(screen.getByText('Options Market')).toBeInTheDocument()
    expect(screen.getByText('30.0%')).toBeInTheDocument()
    expect(screen.getByText('±6.4%')).toBeInTheDocument()
    expect(screen.getByText('by Jul 31, 2026')).toBeInTheDocument()
    expect(screen.getByText('4.9%')).toBeInTheDocument()
    expect(screen.getByText('to hedge until Sep 18, 2026')).toBeInTheDocument()
    expect(screen.getByText('0.24')).toBeInTheDocument()
  })

  it('calls a call-heavy ratio Optimistic with its blurb', () => {
    renderWithProviders(<OptionsCard metrics={FULL} />)
    expect(screen.getByText('Optimistic')).toBeInTheDocument()
    expect(screen.getByText(/positioning for upside/i)).toBeInTheDocument()
  })

  it('calls a put-heavy ratio Protective', () => {
    renderWithProviders(
      <OptionsCard metrics={{ ...FULL, put_call_ratio: 1.42 }} />,
    )
    expect(screen.getByText('Protective')).toBeInTheDocument()
    expect(screen.getByText(/downside cover/i)).toBeInTheDocument()
  })

  it('calls a near-parity ratio Balanced', () => {
    renderWithProviders(
      <OptionsCard metrics={{ ...FULL, put_call_ratio: 1.0 }} />,
    )
    expect(screen.getByText('Balanced')).toBeInTheDocument()
  })

  it('dashes missing figures without dropping their neighbours', () => {
    renderWithProviders(
      <OptionsCard
        metrics={{
          ...FULL,
          implied_volatility: null,
          put_call_ratio: null,
        }}
      />,
    )
    expect(screen.getAllByText('—')).toHaveLength(2)
    expect(screen.getByText('±6.4%')).toBeInTheDocument()
    // No ratio → no positioning chip or blurb.
    expect(screen.queryByText('Positioning')).not.toBeInTheDocument()
    expect(screen.queryByText('Optimistic')).not.toBeInTheDocument()
  })

  it('shows a fallback when every figure is null', () => {
    renderWithProviders(
      <OptionsCard
        metrics={{
          implied_volatility: null,
          expected_move_percent: null,
          expected_move_by: null,
          insurance_cost_percent: null,
          insurance_expires: null,
          put_call_ratio: null,
        }}
      />,
    )
    expect(screen.getByText(/no options data/i)).toBeInTheDocument()
    expect(screen.queryByText('Implied volatility')).not.toBeInTheDocument()
  })
})
