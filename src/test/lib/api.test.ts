import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  beatConsistency,
  clampToRegularHours,
  defaultTimeframe,
  getCandles,
  getEma,
  getEtfAnalysis,
  getIndustryValuation,
  getPeHistory,
  getRatingsAnalysis,
  getStockAnalysis,
  getStockTrend,
  getSupportLevels,
  humanizeClassification,
  industryPeStance,
  lastSessionOnly,
  optionsLevel,
  optionsSentiment,
  optionsSignal,
  profitabilityVerdict,
  cashFlowVerdict,
  rangeReturnPct,
  type Candle,
  type CandleSeries,
} from '@/lib/api'

describe('humanizeClassification', () => {
  it('title-cases a snake_case slug into a display label', () => {
    expect(humanizeClassification('consumer_electronics')).toBe(
      'Consumer Electronics',
    )
    expect(humanizeClassification('technology')).toBe('Technology')
  })

  it('drops empty segments from stray or repeated underscores', () => {
    expect(humanizeClassification('oil_gas__e_p')).toBe('Oil Gas E P')
    expect(humanizeClassification('_reit_')).toBe('Reit')
    expect(humanizeClassification('')).toBe('')
  })

  it('aliases non-underscore vendor slugs (Yahoo fund sectors)', () => {
    // Without the alias the generic title-case yields "Realestate".
    expect(humanizeClassification('realestate')).toBe('Real Estate')
  })
})

describe('industryPeStance', () => {
  it('grades against the median with a ±10% dead-band', () => {
    // 30 vs a 20 median → +50%, clearly above.
    expect(industryPeStance(30, 20)).toBe('above')
    // 12 vs 20 → -40%, clearly below.
    expect(industryPeStance(12, 20)).toBe('below')
    // Inside ±10% of the median reads in line.
    expect(industryPeStance(21, 20)).toBe('in_line')
    expect(industryPeStance(19, 20)).toBe('in_line')
  })

  it('treats the band edges as in line (0.9× and 1.1×)', () => {
    expect(industryPeStance(18, 20)).toBe('below') // 0.9× exactly → below (<=)
    expect(industryPeStance(22, 20)).toBe('above') // 1.1× exactly → above (>=)
    expect(industryPeStance(18.2, 20)).toBe('in_line')
    expect(industryPeStance(21.8, 20)).toBe('in_line')
  })

  it('is null without two positive multiples to compare', () => {
    expect(industryPeStance(null, 20)).toBeNull()
    expect(industryPeStance(25, null)).toBeNull()
    expect(industryPeStance(-4, 20)).toBeNull() // a loss-maker has no gradeable P/E
    expect(industryPeStance(25, 0)).toBeNull()
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

  it('keeps a 4-hour bar whose window overlaps the session, not just its opener', () => {
    // Alpaca grids 4H bars to 8:00 / 12:00 / 16:00 ET (12:00 / 16:00 / 20:00 UTC
    // in summer). The 8:00 bar opens pre-market but still covers 9:30–noon, so
    // it survives; the 16:00 bar is wholly after-hours, so it's dropped. We keep
    // the morning and afternoon bars, not a lone afternoon candle.
    const s = series('4Hour', [
      barAtUtc(2026, 7, 1, 8, 0), // 4:00 AM ET — overnight, no overlap
      barAtUtc(2026, 7, 1, 12, 0), // 8:00 AM ET — covers 9:30–noon
      barAtUtc(2026, 7, 1, 16, 0), // 12:00 PM ET — the afternoon
      barAtUtc(2026, 7, 1, 20, 0), // 4:00 PM ET — after-hours
    ])
    const clamped = clampToRegularHours(s)
    expect(clamped.candles.map((c) => c.time)).toEqual([
      s.candles[1].time,
      s.candles[2].time,
    ])
    expect(clamped.count).toBe(2)
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

describe('defaultTimeframe', () => {
  it('maps each range to a granularity that keeps the bar count readable', () => {
    expect(defaultTimeframe('1D')).toBe('5Min')
    expect(defaultTimeframe('7D')).toBe('15Min')
    expect(defaultTimeframe('1M')).toBe('4Hour')
    expect(defaultTimeframe('3M')).toBe('1Day')
    expect(defaultTimeframe('6M')).toBe('1Day')
    expect(defaultTimeframe('1Y')).toBe('1Day')
    expect(defaultTimeframe('YTD')).toBe('1Day')
    expect(defaultTimeframe('2Y')).toBe('1Week')
    expect(defaultTimeframe('5Y')).toBe('1Week')
    expect(defaultTimeframe('10Y')).toBe('1Week')
    expect(defaultTimeframe('MAX')).toBe('1Month')
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

describe('cashFlowVerdict', () => {
  it('grades FCF yield: 6%+ rich, 3–6% generative, thin, or a burn', () => {
    expect(cashFlowVerdict(8.1)).toBe('Cash Rich')
    expect(cashFlowVerdict(6)).toBe('Cash Rich')
    expect(cashFlowVerdict(5.9)).toBe('Cash Generative')
    expect(cashFlowVerdict(3)).toBe('Cash Generative')
    expect(cashFlowVerdict(2.9)).toBe('Thin Free Cash')
    expect(cashFlowVerdict(0.1)).toBe('Thin Free Cash')
  })

  it('treats break-even and negative yields as Cash Burning', () => {
    expect(cashFlowVerdict(0)).toBe('Cash Burning')
    expect(cashFlowVerdict(-2.4)).toBe('Cash Burning')
  })

  it('returns null when there is no yield to judge', () => {
    expect(cashFlowVerdict(null)).toBeNull()
  })
})

describe('beatConsistency', () => {
  it('grades a beat rate: 60%+ reliable, 40–60% mixed, below shaky', () => {
    expect(beatConsistency(100)).toBe('reliable')
    expect(beatConsistency(60)).toBe('reliable')
    expect(beatConsistency(59.9)).toBe('mixed')
    expect(beatConsistency(40)).toBe('mixed')
    expect(beatConsistency(39.9)).toBe('shaky')
    expect(beatConsistency(0)).toBe('shaky')
  })

  it('returns null when no quarter could be scored', () => {
    expect(beatConsistency(null)).toBeNull()
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
    expect(retryUrl).toContain('/stocks/ticker/SPY/candles')
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

  it("requests a weekly start-anchored window since the API's range enum stops at 5Y", async () => {
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
    // which the backend would reject, on weekly bars.
    expect(requestedUrl).toContain('/stocks/ticker/SPY/candles')
    expect(requestedUrl).toContain('timeframe=1Week')
    expect(requestedUrl).toContain('start=')
    expect(requestedUrl).not.toContain('range=')
  })
})

describe('getSupportLevels', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('requests a fixed 1Y daily scan and returns the parsed levels', async () => {
    let requestedUrl = ''
    const body = {
      symbol: 'AAPL',
      timeframe: '1Day',
      reference_price: 208.4,
      count: 2,
      levels: [
        {
          price: 195.2,
          touches: 3,
          last_touched: '2026-05-14',
          strength: 'strong',
          distance_percent: -6.33,
        },
        {
          price: 172.5,
          touches: 2,
          last_touched: '2026-02-03',
          strength: 'moderate',
          distance_percent: -17.23,
        },
      ],
    }
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string | URL) => {
        requestedUrl = String(url)
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(body),
        })
      }),
    )

    const result = await getSupportLevels('AAPL')

    // A fixed 1Y daily window, independent of any chart range.
    expect(requestedUrl).toContain('/stocks/ticker/AAPL/support-levels')
    expect(requestedUrl).toContain('timeframe=1Day')
    expect(requestedUrl).toContain('range=1Y')
    expect(result.reference_price).toBe(208.4)
    expect(result.levels.map((l) => l.strength)).toEqual(['strong', 'moderate'])
  })

  it('throws an ApiError carrying the server detail on a non-2xx', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 404,
          json: () =>
            Promise.resolve({
              detail: "No stock data found for symbol 'ZZZZ'.",
            }),
        }),
      ),
    )
    await expect(getSupportLevels('ZZZZ')).rejects.toThrow(
      /No stock data found/,
    )
  })
})

describe('getStockTrend', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('requests a fixed 1Y daily read and returns the parsed trend', async () => {
    let requestedUrl = ''
    const body = {
      symbol: 'AAPL',
      timeframe: '1Day',
      reference_price: 214.3,
      reading: 'uptrend_pullback',
      long_term: {
        period: 200,
        lookback: 200,
        direction: 'up',
        slope_percent: 0.22,
        change_percent: 11.4,
        price_vs_ema_percent: 6.5,
        ema: 201.2,
      },
      medium_term: {
        period: 50,
        lookback: 50,
        direction: 'up',
        slope_percent: 0.14,
        change_percent: 5.1,
        price_vs_ema_percent: 3.2,
        ema: 209.4,
      },
      short_term: {
        period: 20,
        lookback: 20,
        direction: 'down',
        slope_percent: -0.18,
        change_percent: -3.9,
        price_vs_ema_percent: -1.2,
        ema: 216.9,
      },
    }
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string | URL) => {
        requestedUrl = String(url)
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(body),
        })
      }),
    )

    const result = await getStockTrend('AAPL')

    expect(requestedUrl).toContain('/stocks/ticker/AAPL/trend')
    expect(requestedUrl).toContain('timeframe=1Day')
    expect(requestedUrl).toContain('range=1Y')
    expect(result.reading).toBe('uptrend_pullback')
    expect(result.long_term?.direction).toBe('up')
    expect(result.medium_term?.direction).toBe('up')
    expect(result.short_term?.direction).toBe('down')
  })

  it('forwards custom horizons as query params', async () => {
    let requestedUrl = ''
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string | URL) => {
        requestedUrl = String(url)
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              symbol: 'AAPL',
              timeframe: '1Day',
              reference_price: 214.3,
              reading: 'unknown',
              long_term: null,
              medium_term: null,
              short_term: null,
            }),
        })
      }),
    )

    await getStockTrend('AAPL', {
      shortPeriod: 10,
      mediumPeriod: 50,
      longPeriod: 200,
    })
    expect(requestedUrl).toContain('short_period=10')
    expect(requestedUrl).toContain('medium_period=50')
    expect(requestedUrl).toContain('long_period=200')
  })

  it('throws an ApiError carrying the server detail on a non-2xx', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 404,
          json: () =>
            Promise.resolve({
              detail: "No stock data found for symbol 'ZZZZ'.",
            }),
        }),
      ),
    )
    await expect(getStockTrend('ZZZZ')).rejects.toThrow(/No stock data found/)
  })
})

describe('getEma', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('requests the default 9/21/50/200 periods over the chart range', async () => {
    let requestedUrl = ''
    const body = {
      symbol: 'AAPL',
      timeframe: '1Day',
      lines: [
        { period: 9, count: 1, latest: 201.1, points: [] },
        { period: 21, count: 1, latest: 195.4, points: [] },
        { period: 50, count: 1, latest: 190.2, points: [] },
        { period: 200, count: 1, latest: 180.7, points: [] },
      ],
    }
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string | URL) => {
        requestedUrl = String(url)
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(body),
        })
      }),
    )

    const result = await getEma('AAPL', { range: '6M' })

    expect(requestedUrl).toContain('/stocks/ticker/AAPL/ema')
    // Same window handling as getCandles so the points share the candles' bars.
    expect(requestedUrl).toContain('timeframe=1Day')
    expect(requestedUrl).toContain('range=6M')
    // One repeated `period` param per requested line.
    expect(requestedUrl).toContain('period=9')
    expect(requestedUrl).toContain('period=21')
    expect(requestedUrl).toContain('period=50')
    expect(requestedUrl).toContain('period=200')
    expect(result.lines.map((l) => l.period)).toEqual([9, 21, 50, 200])
  })

  it('throws an ApiError carrying the server detail on a non-2xx', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 404,
          json: () =>
            Promise.resolve({
              detail: "No stock data found for symbol 'ZZZZ'.",
            }),
        }),
      ),
    )
    await expect(getEma('ZZZZ')).rejects.toThrow(/No stock data found/)
  })
})

describe('getStockAnalysis', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('requests the analysis endpoint and returns the parsed read', async () => {
    let requestedUrl = ''
    const body = {
      symbol: 'AAPL',
      recommendation: 'buy',
      confidence: 'high',
      thesis: 'Solid profits at a fair price.',
      sections: [
        {
          key: 'business_quality',
          title: 'Business quality',
          stance: 'positive',
          label: 'Strong',
          summary: 'Highly profitable.',
          metrics: [{ label: 'Net margin', value: '25.00%' }],
        },
      ],
      disclaimer: 'Not financial advice.',
      model: 'claude-haiku-4-5',
      generated_at: '2026-07-08T00:00:00Z',
    }
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string | URL) => {
        requestedUrl = String(url)
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(body),
        })
      }),
    )

    const result = await getStockAnalysis('AAPL')

    expect(requestedUrl).toContain('/stocks/AAPL/analysis')
    expect(result.recommendation).toBe('buy')
    expect(result.sections).toHaveLength(1)
    expect(result.sections[0].key).toBe('business_quality')
    expect(result.sections[0].metrics[0]).toEqual({
      label: 'Net margin',
      value: '25.00%',
    })
  })

  it('throws an ApiError carrying the server detail on a non-2xx', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 502,
          json: () => Promise.resolve({ detail: 'analysis model call failed' }),
        }),
      ),
    )
    await expect(getStockAnalysis('AAPL')).rejects.toThrow(
      /analysis model call failed/,
    )
  })
})

describe('getRatingsAnalysis', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('requests the ratings-review endpoint and returns the parsed read', async () => {
    let requestedUrl = ''
    const body = {
      symbol: 'NVDA',
      verdict: 'bullish',
      confidence: 'high',
      summary: 'Analysts are overwhelmingly positive.',
      findings: ['95% rate it buy or better'],
      disclaimer: 'Not financial advice.',
      model: 'claude-haiku-4-5',
      generated_at: '2026-07-09T00:00:00Z',
    }
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string | URL) => {
        requestedUrl = String(url)
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(body),
        })
      }),
    )

    const result = await getRatingsAnalysis('NVDA')

    expect(requestedUrl).toContain('/stocks/ticker/NVDA/analyst-info/analysis')
    expect(result.verdict).toBe('bullish')
    expect(result.findings).toEqual(['95% rate it buy or better'])
  })

  it('throws an ApiError carrying the server detail on a non-2xx', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 502,
          json: () =>
            Promise.resolve({ detail: 'no analyst coverage to analyse' }),
        }),
      ),
    )
    await expect(getRatingsAnalysis('NVDA')).rejects.toThrow(
      /no analyst coverage/,
    )
  })
})

describe('getEtfAnalysis', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('requests the fund analysis endpoint and returns the parsed read', async () => {
    let requestedUrl = ''
    const body = {
      ticker: 'VOO',
      asset_type: 'etf',
      recommendation: 'buy',
      confidence: 'high',
      thesis: 'A cheap, broad way to own the whole market.',
      strengths: ['Very low yearly cost'],
      risks: ['Concentrated in a few big tech names'],
      disclaimer: 'Not financial advice.',
      model: 'claude-haiku-4-5',
      generated_at: '2026-07-08T00:00:00Z',
    }
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string | URL) => {
        requestedUrl = String(url)
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(body),
        })
      }),
    )

    const result = await getEtfAnalysis('VOO')

    expect(requestedUrl).toContain('/stocks/etf/VOO/analysis')
    expect(result.recommendation).toBe('buy')
    expect(result.strengths).toEqual(['Very low yearly cost'])
    expect(result.risks).toEqual(['Concentrated in a few big tech names'])
  })

  it('throws an ApiError carrying the server detail on a non-2xx', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 502,
          json: () => Promise.resolve({ detail: 'analysis model call failed' }),
        }),
      ),
    )
    await expect(getEtfAnalysis('VOO')).rejects.toThrow(
      /analysis model call failed/,
    )
  })
})

describe('getIndustryValuation', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('requests the industry endpoint and returns the parsed benchmark', async () => {
    let requestedUrl = ''
    const body = {
      industry: 'semiconductors',
      count: 34,
      median_pe: 21,
      p25_pe: 15.5,
      p75_pe: 30.2,
    }
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string | URL) => {
        requestedUrl = String(url)
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(body),
        })
      }),
    )

    const result = await getIndustryValuation('semiconductors')

    expect(requestedUrl).toContain('/stocks/industries/semiconductors/pe')
    expect(result.median_pe).toBe(21)
    expect(result.count).toBe(34)
  })

  it('returns a 200 with count 0 and null stats for an uncovered industry', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              industry: 'nonesuch',
              count: 0,
              median_pe: null,
              p25_pe: null,
              p75_pe: null,
            }),
        }),
      ),
    )
    const result = await getIndustryValuation('nonesuch')
    expect(result.count).toBe(0)
    expect(result.median_pe).toBeNull()
  })
})

describe('getPeHistory', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('requests the pe-history endpoint and returns the parsed series', async () => {
    let requestedUrl = ''
    const body = {
      ticker: 'AAPL',
      count: 2,
      points: [
        { date: '2024-02-01', price: 185.12, ttm_eps: 6.43, pe: 28.78 },
        { date: '2024-05-01', price: 190.0, ttm_eps: 6.5, pe: 29.23 },
      ],
    }
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string | URL) => {
        requestedUrl = String(url)
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(body),
        })
      }),
    )

    const result = await getPeHistory('aapl')

    expect(requestedUrl).toContain('/stocks/ticker/aapl/pe-history')
    expect(result.count).toBe(2)
    expect(result.points[0].pe).toBe(28.78)
  })

  it('returns a 200 with an empty series for an uncovered symbol', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ ticker: 'ZZZZ', count: 0, points: [] }),
        }),
      ),
    )
    const result = await getPeHistory('ZZZZ')
    expect(result.count).toBe(0)
    expect(result.points).toEqual([])
  })
})
