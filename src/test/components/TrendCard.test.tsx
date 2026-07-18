import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen } from '@/test/test-utils'
import TrendCard from '@/components/TrendCard'
import type { StockTrend, TrendDirection } from '@/lib/api'

/** A horizon whose line slope and effective read agree — the ordinary case. Pass
 *  `effective_direction` in the overrides to build a divergent one. */
function leg(direction: TrendDirection, overrides = {}) {
  return {
    period: direction === 'up' ? 50 : 20,
    lookback: 50,
    direction,
    effective_direction: direction,
    slope_percent:
      direction === 'up' ? 0.22 : direction === 'down' ? -0.18 : 0.0,
    change_percent:
      direction === 'up' ? 11.4 : direction === 'down' ? -3.9 : 0.2,
    price_vs_ema_percent: direction === 'up' ? 6.5 : -1.2,
    ema: 201.2,
    ...overrides,
  }
}

function trend(overrides: Partial<StockTrend> = {}): StockTrend {
  return {
    symbol: 'AAPL',
    timeframe: '1Day',
    reference_price: 214.3,
    reading: 'uptrend',
    long_term: leg('up', { period: 200 }),
    medium_term: leg('up', { period: 50 }),
    short_term: leg('up', { period: 20 }),
    ...overrides,
  }
}

describe('TrendCard', () => {
  it('shows the combined reading and its plain-language blurb', () => {
    renderWithProviders(
      <TrendCard
        trend={trend({
          reading: 'uptrend_weakening',
          long_term: leg('up', { period: 200 }),
          medium_term: leg('down', { period: 50 }),
          short_term: leg('down', { period: 20 }),
        })}
      />,
    )
    expect(screen.getByText('Uptrend · weakening')).toBeInTheDocument()
    expect(
      screen.getByText(/intermediate trend has rolled over/i),
    ).toBeInTheDocument()
  })

  it('renders all three horizons with their direction word and EMA', () => {
    renderWithProviders(
      <TrendCard
        trend={trend({
          reading: 'uptrend_pullback',
          long_term: leg('up', { period: 200 }),
          medium_term: leg('sideways', { period: 50 }),
          short_term: leg('down', { period: 20 }),
        })}
      />,
    )
    expect(screen.getByText('Long-term')).toBeInTheDocument()
    expect(screen.getByText('Medium-term')).toBeInTheDocument()
    expect(screen.getByText('Short-term')).toBeInTheDocument()
    expect(screen.getByText('Rising')).toBeInTheDocument()
    expect(screen.getByText('Flat')).toBeInTheDocument()
    expect(screen.getByText('Falling')).toBeInTheDocument()
    expect(screen.getByText(/the 200-day line/)).toBeInTheDocument()
    expect(screen.getByText(/the 50-day line/)).toBeInTheDocument()
    expect(screen.getByText(/the 20-day line/)).toBeInTheDocument()
    // The line's own move renders as a signed percent.
    expect(screen.getByText(/\+11\.4%/)).toBeInTheDocument()
    expect(screen.getByText(/-3\.9%/)).toBeInTheDocument()
  })

  it('leads with the effective direction, not the line slope', () => {
    // The case the card used to get wrong: a 20-day line still sloping up while
    // price has broken 4.2% below it. The tile must read "Falling" — the word the
    // backend's effective_direction gives — with the line's own +11.4% shown as
    // the labelled detail underneath, not as the headline.
    renderWithProviders(
      <TrendCard
        trend={trend({
          reading: 'uptrend_weakening',
          long_term: leg('up', { period: 200 }),
          medium_term: leg('up', {
            period: 50,
            effective_direction: 'down',
            price_vs_ema_percent: -2.1,
          }),
          short_term: leg('up', {
            period: 20,
            effective_direction: 'down',
            price_vs_ema_percent: -4.2,
          }),
        })}
      />,
    )
    // Two horizons diverge from their slope and read as falling; the long one,
    // whose price is still above its line, keeps rising.
    expect(screen.getAllByText('Falling')).toHaveLength(2)
    expect(screen.getByText('Rising')).toBeInTheDocument()
    // The driver of that word is stated on the tile.
    expect(screen.getByText(/4\.2%\s*below/)).toBeInTheDocument()
    // And the line's own upward move is still shown, labelled as the line.
    expect(screen.getAllByText(/\+11\.4%/).length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText(/Line/).length).toBeGreaterThanOrEqual(2)
  })

  it('shows the reference price the read was taken at', () => {
    renderWithProviders(<TrendCard trend={trend()} />)
    expect(screen.getByText(/at \$214\.30/)).toBeInTheDocument()
  })

  it('reads "Flat" for every sideways horizon', () => {
    renderWithProviders(
      <TrendCard
        trend={trend({
          reading: 'range_bound',
          long_term: leg('sideways', { period: 200 }),
          medium_term: leg('sideways', { period: 50 }),
          short_term: leg('sideways', { period: 20 }),
        })}
      />,
    )
    expect(screen.getByText('Range-bound')).toBeInTheDocument()
    expect(screen.getAllByText('Flat')).toHaveLength(3)
  })

  it('handles an unknown reading and missing horizons gracefully', () => {
    renderWithProviders(
      <TrendCard
        trend={trend({
          reading: 'unknown',
          long_term: null,
          medium_term: null,
          short_term: leg('up', { period: 20 }),
        })}
      />,
    )
    // The pill AND each missing horizon tile read "Not enough history".
    expect(
      screen.getAllByText('Not enough history').length,
    ).toBeGreaterThanOrEqual(3)
    // The present short horizon still renders.
    expect(screen.getByText('Rising')).toBeInTheDocument()
  })
})
