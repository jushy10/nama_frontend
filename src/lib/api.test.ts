import { describe, expect, it } from 'vitest'
import {
  clampToRegularHours,
  pegVerdict,
  profitabilityVerdict,
  rangeReturnPct,
  type Candle,
  type CandleSeries,
} from '@/lib/api'

describe('pegVerdict', () => {
  it('mirrors the under-1 / over-2 PEG bands, edges inclusive of the middle', () => {
    expect(pegVerdict(0.27)).toBe('Cheap for Its Growth')
    expect(pegVerdict(0.99)).toBe('Cheap for Its Growth')
    expect(pegVerdict(1)).toBe('Fairly Priced')
    expect(pegVerdict(2)).toBe('Fairly Priced')
    expect(pegVerdict(2.01)).toBe('Pricey for Its Growth')
  })

  it('labels a non-positive ratio Not Meaningful and passes null through', () => {
    expect(pegVerdict(0)).toBe('Not Meaningful')
    expect(pegVerdict(-1.2)).toBe('Not Meaningful')
    expect(pegVerdict(null)).toBeNull()
  })
})

describe('clampToRegularHours', () => {
  // A bar at the given UTC wall-clock time; only `time` matters to the clamp.
  const barAtUtc = (
    y: number,
    mo: number,
    d: number,
    h: number,
    mi: number,
  ): Candle => {
    const time = Date.UTC(y, mo - 1, d, h, mi) / 1000
    return {
      time,
      timestamp: new Date(time * 1000).toISOString(),
      open: 1,
      high: 2,
      low: 1,
      close: 2,
      volume: 100,
      direction: 'up',
    }
  }

  const series = (timeframe: string, candles: Candle[]): CandleSeries => ({
    symbol: 'TEST',
    timeframe,
    count: candles.length,
    candles,
  })

  it('keeps only 9:30–4:00 ET bars on intraday series (EDT: UTC-4)', () => {
    // July 1 is EDT, so 9:30 AM ET = 13:30 UTC and 4:00 PM ET = 20:00 UTC.
    const s = series('5Min', [
      barAtUtc(2026, 7, 1, 13, 25), // 9:25 AM ET — pre-market
      barAtUtc(2026, 7, 1, 13, 30), // 9:30 AM ET — first session bar
      barAtUtc(2026, 7, 1, 19, 55), // 3:55 PM ET — last session bar
      barAtUtc(2026, 7, 1, 20, 0), // 4:00 PM ET — after-hours window
      barAtUtc(2026, 7, 1, 20, 40), // 4:40 PM ET — after-hours
    ])
    const clamped = clampToRegularHours(s)
    expect(clamped.candles.map((c) => c.time)).toEqual([
      s.candles[1].time,
      s.candles[2].time,
    ])
    expect(clamped.count).toBe(2)
  })

  it('respects the ET offset in winter (EST: UTC-5)', () => {
    // January 15 is EST, so 9:30 AM ET = 14:30 UTC and 4:00 PM ET = 21:00 UTC.
    const s = series('5Min', [
      barAtUtc(2026, 1, 15, 13, 30), // 8:30 AM ET — pre-market in winter
      barAtUtc(2026, 1, 15, 14, 30), // 9:30 AM ET — first session bar
      barAtUtc(2026, 1, 15, 20, 55), // 3:55 PM ET — last session bar
      barAtUtc(2026, 1, 15, 21, 0), // 4:00 PM ET — after-hours window
    ])
    const clamped = clampToRegularHours(s)
    expect(clamped.candles.map((c) => c.time)).toEqual([
      s.candles[1].time,
      s.candles[2].time,
    ])
  })

  it('passes daily and coarser series through untouched', () => {
    // Daily bars are stamped at midnight/early-morning ET — a session filter
    // would wrongly empty them.
    const s = series('1Day', [
      barAtUtc(2026, 7, 1, 4, 0),
      barAtUtc(2026, 7, 2, 4, 0),
    ])
    expect(clampToRegularHours(s)).toBe(s)
  })
})

describe('rangeReturnPct', () => {
  // Only open/close feed the calculation; the rest is boilerplate.
  const bar = (open: number, close: number): Candle => ({
    time: 0,
    timestamp: '2026-07-01T00:00:00Z',
    open,
    high: Math.max(open, close),
    low: Math.min(open, close),
    close,
    volume: null,
    direction: close >= open ? 'up' : 'down',
  })

  it('measures first open to last close across the window', () => {
    // 200 → 250 over three bars, including the first bar's own move.
    expect(rangeReturnPct([bar(200, 210), bar(210, 220), bar(220, 250)])).toBe(
      25,
    )
    expect(rangeReturnPct([bar(200, 190), bar(190, 150)])).toBe(-25)
  })

  it('returns null for an empty series or a zero base price', () => {
    expect(rangeReturnPct([])).toBeNull()
    expect(rangeReturnPct([bar(0, 10)])).toBeNull()
  })
})

describe('profitabilityVerdict', () => {
  it('grades net margin: 20%+ exceptional, double-digit healthy, thin, or a loss', () => {
    expect(profitabilityVerdict(31.2)).toBe('Highly Profitable')
    expect(profitabilityVerdict(20)).toBe('Highly Profitable')
    expect(profitabilityVerdict(19.9)).toBe('Profitable')
    expect(profitabilityVerdict(10)).toBe('Profitable')
    expect(profitabilityVerdict(9.9)).toBe('Marginally Profitable')
    expect(profitabilityVerdict(0.1)).toBe('Marginally Profitable')
  })

  it('treats break-even and losses as Unprofitable', () => {
    expect(profitabilityVerdict(0)).toBe('Unprofitable')
    expect(profitabilityVerdict(-4.2)).toBe('Unprofitable')
  })

  it('returns null when there is no margin to judge', () => {
    expect(profitabilityVerdict(null)).toBeNull()
  })
})
