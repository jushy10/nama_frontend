import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen } from '@/test/test-utils'
import StockHeader from '@/components/StockHeader'
import type { ExtendedHours, TickerCard } from '@/lib/api'

const baseCard: TickerCard = {
  ticker: 'AAPL',
  name: 'Apple Inc',
  exchange: 'NASDAQ',
  asset_type: 'equity',
  sector: 'technology',
  industry: 'consumer_electronics',
  price: 333.75,
  change: 0.65,
  change_percent: 0.2,
  extended_hours: null,
  market_cap: 4_894_708_203_520,
  dividend: null,
  performance: null,
  metrics: null,
  options_metrics: null,
}

// 16:33 ET (4:33 PM) Friday after-hours: the print is 0.52 above the 333.23 close,
// which itself sits 0.13 above the previous close (the day's move).
const afterHours: ExtendedHours = {
  session: 'after_hours',
  price: 333.75,
  change: 0.52,
  change_percent: 0.16,
  regular_price: 333.23,
  regular_change: 0.13,
  regular_change_percent: 0.04,
  as_of: '2026-07-17T20:33:00Z',
}

describe('StockHeader', () => {
  it('shows the live price and day move during the regular session', () => {
    renderWithProviders(<StockHeader stock={baseCard} />)
    expect(screen.getByText('$333.75')).toBeInTheDocument()
    expect(screen.getByText('+0.65 (+0.20%)')).toBeInTheDocument()
    // No extended line when the card carries no split.
    expect(screen.queryByText('After Hours')).not.toBeInTheDocument()
    expect(screen.queryByText('Pre-Market')).not.toBeInTheDocument()
  })

  it('splits into the regular close (primary) and the after-hours move (secondary)', () => {
    renderWithProviders(
      <StockHeader stock={{ ...baseCard, extended_hours: afterHours }} />,
    )
    // The primary number is the regular close with the *day* move, not the blended print.
    expect(screen.getByText('$333.23')).toBeInTheDocument()
    expect(screen.getByText('+0.13 (+0.04%)')).toBeInTheDocument()
    // The after-hours line carries the print and its move since that close.
    expect(screen.getByText('After Hours')).toBeInTheDocument()
    expect(screen.getByText('$333.75')).toBeInTheDocument()
    expect(screen.getByText('+0.16%')).toBeInTheDocument()
    // The print's timestamp reads in market time, flagged as a snapshot.
    expect(screen.getByText('As of 4:33 PM ET')).toBeInTheDocument()
  })

  it('labels a pre-market print with its own session name', () => {
    renderWithProviders(
      <StockHeader
        stock={{
          ...baseCard,
          extended_hours: { ...afterHours, session: 'pre_market' },
        }}
      />,
    )
    expect(screen.getByText('Pre-Market')).toBeInTheDocument()
    expect(screen.queryByText('After Hours')).not.toBeInTheDocument()
  })
})
