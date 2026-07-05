import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clampToRegularHours,
  getCandles,
  lastSessionOnly,
  optionsLevel,
  optionsSentiment,
  optionsSignal,
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

describe('optionsSentiment', () => {
  it('reads a call-heavy ratio as optimistic and a put-heavy one as protective', () => {
    expect(optionsSentiment(0.24)).toBe('optimistic')
    expect(optionsSentiment(0.94)).toBe('optimistic')
    expect(optionsSentiment(1.06)).toBe('protective')
    expect(optionsSentiment(1.8)).toBe('protective')
  })

  it('treats the narrow band around parity as balanced, edges inclusive', () => {
    expect(optionsSentiment(0.95)).toBe('balanced')
    expect(optionsSentiment(1)).toBe('balanced')
    expect(optionsSentiment(1.05)).toBe('balanced')
  })

  it('returns null when there is no ratio to judge', () => {
    expect(optionsSentiment(null)).toBeNull()
  })
})

describe('optionsLevel', () => {
  it('grades implied volatility: under 20 low, over 40 high, edges mid', () => {
    expect(optionsLevel('implied_volatility', 14)).toBe('low')
    expect(optionsLevel('implied_volatility', 20)).toBe('mid')
    expect(optionsLevel('implied_volatility', 40)).toBe('mid')
    expect(optionsLevel('implied_volatility', 40.1)).toBe('high')
  })

  it('grades the expected move on the 4/8 bands', () => {
    expect(optionsLevel('expected_move', 2.5)).toBe('low')
    expect(optionsLevel('expected_move', 6.4)).toBe('mid')
    expect(optionsLevel('expected_move', 12)).toBe('high')
  })

  it('grades the insurance cost on the 3/6 bands', () => {
    expect(optionsLevel('insurance_cost', 1.8)).toBe('low')
    expect(optionsLevel('insurance_cost', 4.9)).toBe('mid')
    expect(optionsLevel('insurance_cost', 7.5)).toBe('high')
  })

  it('returns null when there is no figure to judge', () => {
    expect(optionsLevel('implied_volatility', null)).toBeNull()
  })
})

describe('optionsSignal', () => {
  it('calls a decisive call tilt Go Long and a soft one Lean Long', () => {
    expect(optionsSignal(0.24)).toBe('Go Long')
    expect(optionsSignal(0.69)).toBe('Go Long')
    expect(optionsSignal(0.7)).toBe('Lean Long') // strong edge softens to Lean
    expect(optionsSignal(0.94)).toBe('Lean Long')
  })

  it('treats the balanced band around parity as Neutral, edges inclusive', () => {
    expect(optionsSignal(0.95)).toBe('Neutral')
    expect(optionsSignal(1)).toBe('Neutral')
    expect(optionsSignal(1.05)).toBe('Neutral')
  })

  it('calls a soft put tilt Lean Short and a decisive one Go Short', () => {
    expect(optionsSignal(1.06)).toBe('Lean Short')
    expect(optionsSignal(1.4)).toBe('Lean Short') // strong edge softens to Lean
    expect(optionsSignal(1.41)).toBe('Go Short')
    expect(optionsSignal(2.3)).toBe('Go Short')
  })

  it('returns null when there is no ratio to judge', () => {
    expect(optionsSignal(null)).toBeNull()
  })
})

// A midday-ET intraday bar on the given UTC day/hour — inside the 9:30–4:00
// session in July (EDT), so the regular-hours clamp keeps it.
const sessionBar = (day: number, hourUtc: number): Candle => {
  const time = Date.UTC(2026, 6, day, hourUtc) / 1000
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

const intradaySeries = (candles: Candle[]): CandleSeries => ({
  symbol: 'SPY',
  timeframe: '5Min',
  count: candles.length,
  candles,
})

describe('lastSessionOnly', () => {
  it('keeps only the final UTC day of bars', () => {
    const s = intradaySeries([
      sessionBar(1, 15),
      sessionBar(1, 16),
      sessionBar(2, 15),
      sessionBar(2, 16),
    ])
    const sliced = lastSessionOnly(s)
    expect(sliced.candles.map((c) => c.time)).toEqual([
      s.candles[2].time,
      s.candles[3].time,
    ])
    expect(sliced.count).toBe(2)
  })

  it('passes an empty series through untouched', () => {
    const s = intradaySeries([])
    expect(lastSessionOnly(s)).toBe(s)
  })
})

describe('getCandles 1D fallback', () => {
  afterEach(() => vi.unstubAllGlobals())

  /** 404s `range=1D` requests, answers `start=` requests with `series`. */
  function stubClosedMarket(series: CandleSeries | null) {
    const mock = vi.fn((url: string | URL) => {
      const closed = String(url).includes('range=1D')
      const ok = !closed && series != null
      return Promise.resolve({
        ok,
        status: ok ? 200 : 404,
        json: () =>
          Promise.resolve(
            ok ? series : { detail: "No stock data found for symbol 'SPY'." },
          ),
      })
    })
    vi.stubGlobal('fetch', mock)
    return mock
  }

  it('falls back to the most recent session when 1D 404s', async () => {
    const mock = stubClosedMarket(
      intradaySeries([
        sessionBar(1, 15),
        sessionBar(1, 16),
        sessionBar(2, 15),
        sessionBar(2, 16),
      ]),
    )

    const series = await getCandles('SPY', { range: '1D' })

    // The retry asks for a trailing window via `start`, not a range.
    const retryUrl = String(mock.mock.calls[1][0])
    expect(retryUrl).toContain('/stocks/SPY/candles')
    expect(retryUrl).toContain('timeframe=5Min')
    expect(retryUrl).toContain('start=')
    expect(retryUrl).not.toContain('range=')

    // Only the last session's bars survive.
    expect(series.count).toBe(2)
    expect(series.candles.map((c) => c.timestamp)).toEqual([
      '2026-07-02T15:00:00.000Z',
      '2026-07-02T16:00:00.000Z',
    ])
  })

  it('surfaces the API error when the fallback also has nothing', async () => {
    stubClosedMarket(null)
    await expect(getCandles('SPY', { range: '1D' })).rejects.toThrow(
      /No stock data found/,
    )
  })

  it('does not fall back for non-1D ranges', async () => {
    const mock = stubClosedMarket(intradaySeries([sessionBar(1, 15)]))
    // Make every request 404 so a 6M failure is observable.
    mock.mockImplementation(() =>
      Promise.resolve({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ detail: 'nope' }),
      }),
    )
    await expect(getCandles('SPY', { range: '6M' })).rejects.toThrow('nope')
    expect(mock).toHaveBeenCalledTimes(1)
  })
})

describe('getCandles 10Y window', () => {
  afterEach(() => vi.unstubAllGlobals())

  it("requests a monthly start-anchored window since the API's range enum stops at 5Y", async () => {
    let requestedUrl = ''
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string | URL) => {
        requestedUrl = String(url)
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(intradaySeries([])),
        })
      }),
    )

    await getCandles('SPY', { range: '10Y' })

    // 10Y is served via an explicit `start` (like MAX) rather than `range=10Y`,
    // which the backend would reject, on coarse monthly bars.
    expect(requestedUrl).toContain('/stocks/SPY/candles')
    expect(requestedUrl).toContain('timeframe=1Month')
    expect(requestedUrl).toContain('start=')
    expect(requestedUrl).not.toContain('range=')
  })
})
