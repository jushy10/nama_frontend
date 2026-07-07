import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen } from '@/test/test-utils'
import CandleChart from '@/components/CandleChart'
import type { Candle, SupportLevel } from '@/lib/api'

// Three flat daily candles (low 100, high 120) — so the chart's padded visible
// range works out to ~[99, 121]. Support tags render prices via a 2-decimal
// format, and none of these OHLC values are 110/90/130, so a "110.00" in the
// DOM can only be a support tag, never the OHLC legend or an axis label.
function candle(day: number): Candle {
  return {
    time: Date.UTC(2026, 5, day) / 1000,
    timestamp: `2026-06-0${day}T00:00:00.000Z`,
    open: 105,
    high: 120,
    low: 100,
    close: 115,
    volume: 1000,
    direction: 'up',
  }
}

const CANDLES: Candle[] = [candle(1), candle(2), candle(3)]

function level(
  price: number,
  strength: SupportLevel['strength'],
): SupportLevel {
  return {
    price,
    touches: strength === 'strong' ? 3 : strength === 'moderate' ? 2 : 1,
    last_touched: '2026-05-14',
    strength,
    distance_percent: -5,
  }
}

describe('CandleChart support levels', () => {
  it('draws only the levels inside the visible price range', () => {
    renderWithProviders(
      <CandleChart
        candles={CANDLES}
        timeframe="1Day"
        supportLevels={[
          level(110, 'strong'), // inside [99, 121] → drawn
          level(90, 'moderate'), // below the floor → skipped
          level(130, 'weak'), // above the ceiling → skipped
        ]}
      />,
    )
    // The in-range level's price tag renders; the out-of-range ones don't.
    expect(screen.getByText('110.00')).toBeInTheDocument()
    expect(screen.queryByText('90.00')).not.toBeInTheDocument()
    expect(screen.queryByText('130.00')).not.toBeInTheDocument()
  })

  it('draws no support tags when none are supplied', () => {
    renderWithProviders(<CandleChart candles={CANDLES} timeframe="1Day" />)
    expect(screen.queryByText('110.00')).not.toBeInTheDocument()
  })

  it('starts each line at its last-touched candle, not the left edge', () => {
    const { container } = renderWithProviders(
      <CandleChart
        candles={CANDLES} // daily candles on Jun 1–3, 2026
        timeframe="1Day"
        supportLevels={[
          // Last touched mid-window → its line begins at that candle, not far left.
          {
            price: 110,
            touches: 2,
            last_touched: '2026-06-02',
            strength: 'moderate',
            distance_percent: -4,
          },
          // Last touched before the window → its line still spans from the left edge.
          {
            price: 105,
            touches: 1,
            last_touched: '2026-05-14',
            strength: 'weak',
            distance_percent: -8,
          },
        ]}
      />,
    )
    // Support lines are the dashed "5 4" ones (the hover crosshair is "3 3").
    const lines = container.querySelectorAll('line[stroke-dasharray="5 4"]')
    expect(lines).toHaveLength(2)
    const x1 = (el: Element) => Number(el.getAttribute('x1'))
    // The mid-window level starts well right of the plot's left padding (10)…
    expect(x1(lines[0])).toBeGreaterThan(300)
    // …while a level last touched before the window still starts at the edge.
    expect(x1(lines[1])).toBe(10)
  })
})
