import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen } from '@/test/test-utils'
import TrendCard from '@/components/TrendCard'
import type { StockTrend, TrendDirection } from '@/lib/api'

function leg(direction: TrendDirection, overrides = {}) {
  return {
    period: direction === 'up' ? 50 : 20,
    lookback: 50,
    direction,
    slope_percent: direction === 'up' ? 0.22 : direction === 'down' ? -0.18 : 0.0,
    change_percent: direction === 'up' ? 11.4 : direction === 'down' ? -3.9 : 0.2,
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
    long_term: leg('up'),
    short_term: leg('up', { period: 20 }),
    ...overrides,
  }
}

describe('TrendCard', () => {
  it('shows the combined reading and its plain-language blurb', () => {
    renderWithProviders(
      <TrendCard
        trend={trend({
          reading: 'uptrend_pullback',
          long_term: leg('up'),
          short_term: leg('down', { period: 20 }),
        })}
      />,
    )
    expect(screen.getByText('Uptrend · pulling back')).toBeInTheDocument()
    expect(screen.getByText(/pullback within an uptrend/i)).toBeInTheDocument()
  })

  it('renders both horizons with their direction word and EMA', () => {
    renderWithProviders(
      <TrendCard
        trend={trend({
          reading: 'uptrend_pullback',
          long_term: leg('up'),
          short_term: leg('down', { period: 20 }),
        })}
      />,
    )
    expect(screen.getByText('Long-term')).toBeInTheDocument()
    expect(screen.getByText('Short-term')).toBeInTheDocument()
    expect(screen.getByText('Rising')).toBeInTheDocument()
    expect(screen.getByText('Falling')).toBeInTheDocument()
    expect(screen.getByText('50-day EMA')).toBeInTheDocument()
    expect(screen.getByText('20-day EMA')).toBeInTheDocument()
    // The EMA move renders as a signed percent.
    expect(screen.getByText(/\+11\.4%/)).toBeInTheDocument()
    expect(screen.getByText(/-3\.9%/)).toBeInTheDocument()
  })

  it('shows the reference price the read was taken at', () => {
    renderWithProviders(<TrendCard trend={trend()} />)
    expect(screen.getByText(/at \$214\.30/)).toBeInTheDocument()
  })

  it('reads "Flat" for a sideways horizon', () => {
    renderWithProviders(
      <TrendCard
        trend={trend({
          reading: 'range_bound',
          long_term: leg('sideways'),
          short_term: leg('sideways', { period: 20 }),
        })}
      />,
    )
    expect(screen.getByText('Range-bound')).toBeInTheDocument()
    expect(screen.getAllByText('Flat')).toHaveLength(2)
  })

  it('handles an unknown reading and a missing horizon gracefully', () => {
    renderWithProviders(
      <TrendCard
        trend={trend({
          reading: 'unknown',
          long_term: null,
          short_term: leg('up', { period: 20 }),
        })}
      />,
    )
    // The pill AND the missing long-horizon tile both read "Not enough history".
    expect(
      screen.getAllByText('Not enough history').length,
    ).toBeGreaterThanOrEqual(2)
    // The present short horizon still renders.
    expect(screen.getByText('Rising')).toBeInTheDocument()
  })
})
