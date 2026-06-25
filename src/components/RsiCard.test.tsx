import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen } from '@/test/test-utils'
import RsiCard from '@/components/RsiCard'
import type { RsiSeries } from '@/lib/api'

const base: RsiSeries = {
  symbol: 'PL',
  timeframe: '1Day',
  period: 14,
  count: 1,
  latest: 50,
  signal: 'neutral',
  overbought: 70,
  oversold: 30,
  points: [{ time: 1782273600, timestamp: '2026-06-24T04:00:00Z', value: 50 }],
}

describe('RsiCard', () => {
  it('calls Buy when the latest reading is oversold', () => {
    renderWithProviders(
      <RsiCard rsi={{ ...base, latest: 22.81, signal: 'oversold' }} />,
    )
    expect(screen.getByText('22.8')).toBeInTheDocument()
    expect(screen.getByText('Oversold')).toBeInTheDocument()
    expect(screen.getByText('Buy')).toBeInTheDocument()
    expect(screen.getByText(/selling may be overdone/i)).toBeInTheDocument()
  })

  it('calls Sell when the latest reading is overbought', () => {
    renderWithProviders(
      <RsiCard rsi={{ ...base, latest: 81.2, signal: 'overbought' }} />,
    )
    expect(screen.getByText('81.2')).toBeInTheDocument()
    expect(screen.getByText('Sell')).toBeInTheDocument()
  })

  it('calls Hold when the latest reading sits in the neutral band', () => {
    renderWithProviders(<RsiCard rsi={{ ...base, latest: 51.08 }} />)
    expect(screen.getByText('51.1')).toBeInTheDocument()
    expect(screen.getByText('Neutral')).toBeInTheDocument()
    expect(screen.getByText('Hold')).toBeInTheDocument()
  })

  it('treats the thresholds themselves as Buy/Sell (inclusive)', () => {
    const { rerender } = renderWithProviders(
      <RsiCard rsi={{ ...base, latest: 30, signal: 'oversold' }} />,
    )
    expect(screen.getByText('Buy')).toBeInTheDocument()
    rerender(<RsiCard rsi={{ ...base, latest: 70, signal: 'overbought' }} />)
    expect(screen.getByText('Sell')).toBeInTheDocument()
  })

  it('shows a fallback and no recommendation when there is no reading', () => {
    renderWithProviders(<RsiCard rsi={{ ...base, latest: null, count: 0 }} />)
    expect(screen.getByText(/not enough price history/i)).toBeInTheDocument()
    expect(screen.queryByText('Buy')).not.toBeInTheDocument()
    expect(screen.queryByText('Hold')).not.toBeInTheDocument()
    expect(screen.queryByText('Sell')).not.toBeInTheDocument()
  })
})
