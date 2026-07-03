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
  it('shows all four figures under their plain-question labels', () => {
    renderWithProviders(<OptionsCard metrics={FULL} />)
    expect(screen.getByText('Options Market')).toBeInTheDocument()
    expect(screen.getByText('How jumpy?')).toBeInTheDocument()
    expect(screen.getByText('30.0%')).toBeInTheDocument()
    expect(screen.getByText('Possible swing')).toBeInTheDocument()
    expect(screen.getByText('±6.4%')).toBeInTheDocument()
    expect(
      screen.getByText('up or down by Jul 31, 2026 (expected move)'),
    ).toBeInTheDocument()
    expect(screen.getByText('Cost to protect')).toBeInTheDocument()
    expect(screen.getByText('4.9%')).toBeInTheDocument()
    expect(
      screen.getByText('to insure your shares until Sep 18, 2026 (put option)'),
    ).toBeInTheDocument()
    expect(screen.getByText('Up or down bets?')).toBeInTheDocument()
    expect(screen.getByText('0.24')).toBeInTheDocument()
  })

  it('grades each figure with its one-word call', () => {
    renderWithProviders(<OptionsCard metrics={FULL} />)
    expect(screen.getByText('Normal')).toBeInTheDocument() // IV 30 mid
    expect(screen.getByText('Medium')).toBeInTheDocument() // move 6.4 mid
    expect(screen.getByText('Fair')).toBeInTheDocument() // insurance 4.9 mid
    expect(screen.getByText('Betting up')).toBeInTheDocument() // PCR 0.24
  })

  it('uses the low-end words for a calm, cheap symbol', () => {
    renderWithProviders(
      <OptionsCard
        metrics={{
          ...FULL,
          implied_volatility: 14,
          expected_move_percent: 2.5,
          insurance_cost_percent: 1.8,
        }}
      />,
    )
    expect(screen.getByText('Calm')).toBeInTheDocument()
    expect(screen.getByText('Small')).toBeInTheDocument()
    expect(screen.getByText('Cheap')).toBeInTheDocument()
  })

  it('uses the high-end words for a turbulent, pricey symbol', () => {
    renderWithProviders(
      <OptionsCard
        metrics={{
          ...FULL,
          implied_volatility: 55,
          expected_move_percent: 12,
          insurance_cost_percent: 7.5,
        }}
      />,
    )
    expect(screen.getByText('Wild')).toBeInTheDocument()
    expect(screen.getByText('Big')).toBeInTheDocument()
    expect(screen.getByText('Pricey')).toBeInTheDocument()
  })

  it('calls a call-heavy ratio Optimistic with its blurb', () => {
    renderWithProviders(<OptionsCard metrics={FULL} />)
    expect(screen.getByText('Optimistic')).toBeInTheDocument()
    expect(screen.getByText(/betting the price goes up/i)).toBeInTheDocument()
  })

  it('calls a put-heavy ratio Protective and Betting down', () => {
    renderWithProviders(
      <OptionsCard metrics={{ ...FULL, put_call_ratio: 1.42 }} />,
    )
    expect(screen.getByText('Protective')).toBeInTheDocument()
    expect(screen.getByText('Betting down')).toBeInTheDocument()
    expect(screen.getByText(/protecting against a fall/i)).toBeInTheDocument()
  })

  it('calls a near-parity ratio Balanced and Split', () => {
    renderWithProviders(
      <OptionsCard metrics={{ ...FULL, put_call_ratio: 1.0 }} />,
    )
    expect(screen.getByText('Balanced')).toBeInTheDocument()
    expect(screen.getByText('Split')).toBeInTheDocument()
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
    // No graded figure → no one-word call beside the dash.
    expect(screen.queryByText('Calm')).not.toBeInTheDocument()
    expect(screen.queryByText('Normal')).not.toBeInTheDocument()
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
    expect(screen.queryByText('How jumpy?')).not.toBeInTheDocument()
  })
})
