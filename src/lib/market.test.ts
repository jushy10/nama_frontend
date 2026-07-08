import { describe, expect, it } from 'vitest'
import {
  getMarketStatus,
  isMarketOpen,
  marketHoliday,
  marketTooltip,
} from '@/lib/market'

/**
 * Cases are UTC instants with their known ET wall-clock in the comment. July is
 * EDT (UTC-4), January EST (UTC-5) — the two 14:00Z cases (open in summer,
 * closed in winter) prove the check follows daylight saving, not a fixed offset.
 * 2026-07-08 is an ordinary Wednesday (no holiday, no half-day).
 */
describe('getMarketStatus — phases', () => {
  const phaseAt = (iso: string) => getMarketStatus(new Date(iso)).phase

  it('is regular mid-session', () => {
    expect(phaseAt('2026-07-08T14:00:00Z')).toBe('regular') // 10:00 EDT
  })

  it('opens the regular session at the 09:30 ET bell (inclusive)', () => {
    expect(phaseAt('2026-07-08T13:30:00Z')).toBe('regular') // 09:30 EDT
  })

  it('is regular a minute before the close', () => {
    expect(phaseAt('2026-07-08T19:59:00Z')).toBe('regular') // 15:59 EDT
  })

  it('flips to after-hours at 16:00 ET (exclusive close)', () => {
    expect(phaseAt('2026-07-08T20:00:00Z')).toBe('after') // 16:00 EDT
  })

  it('is pre-market between 04:00 and 09:30 ET', () => {
    expect(phaseAt('2026-07-08T12:00:00Z')).toBe('pre') // 08:00 EDT
  })

  it('opens pre-market at 04:00 ET (inclusive)', () => {
    expect(phaseAt('2026-07-08T08:00:00Z')).toBe('pre') // 04:00 EDT
  })

  it('is closed just before pre-market', () => {
    expect(phaseAt('2026-07-08T07:59:00Z')).toBe('closed') // 03:59 EDT
  })

  it('is closed after 20:00 ET', () => {
    expect(phaseAt('2026-07-09T00:30:00Z')).toBe('closed') // 20:30 EDT Jul 8
  })

  it('is closed on the weekend, all day', () => {
    expect(phaseAt('2026-07-11T15:00:00Z')).toBe('closed') // Sat 11:00 EDT
  })

  it('respects daylight saving: 14:00Z is pre-market in winter', () => {
    // Wed 2026-01-14 09:00 EST — same UTC hour that's regular in July.
    expect(phaseAt('2026-01-14T14:00:00Z')).toBe('pre')
  })

  it('is regular in winter once past the EST bell', () => {
    expect(phaseAt('2026-01-14T14:30:00Z')).toBe('regular') // 09:30 EST
  })

  it('reports the holiday name when shut for one', () => {
    // Fri 2026-12-25, 10:00 EST — Christmas.
    const status = getMarketStatus(new Date('2026-12-25T15:00:00Z'))
    expect(status.phase).toBe('closed')
    expect(status.holiday).toBe('Christmas')
  })
})

describe('isMarketOpen', () => {
  it('is true only in the regular session', () => {
    expect(isMarketOpen(new Date('2026-07-08T14:00:00Z'))).toBe(true) // regular
    expect(isMarketOpen(new Date('2026-07-08T12:00:00Z'))).toBe(false) // pre
    expect(isMarketOpen(new Date('2026-07-08T21:00:00Z'))).toBe(false) // after
  })

  it('is false on a holiday even at midday', () => {
    // Fri 2026-12-25 11:00 EST.
    expect(isMarketOpen(new Date('2026-12-25T16:00:00Z'))).toBe(false)
  })
})

describe('marketHoliday — 2026 calendar', () => {
  const cases: [number, number, string][] = [
    [1, 1, "New Year's Day"], // Thu
    [1, 19, 'Martin Luther King Jr. Day'], // 3rd Mon
    [2, 16, "Presidents' Day"], // 3rd Mon
    [4, 3, 'Good Friday'], // Easter Apr 5 − 2
    [5, 25, 'Memorial Day'], // last Mon
    [6, 19, 'Juneteenth'], // Fri
    [7, 3, 'Independence Day'], // Jul 4 is Sat → observed Fri
    [9, 7, 'Labor Day'], // 1st Mon
    [11, 26, 'Thanksgiving'], // 4th Thu
    [12, 25, 'Christmas'], // Fri
  ]
  it.each(cases)('%i/%i is %s', (month, day, name) => {
    expect(marketHoliday(2026, month, day)).toBe(name)
  })

  it('leaves an ordinary weekday unflagged', () => {
    expect(marketHoliday(2026, 7, 8)).toBeNull()
  })
})

describe('marketHoliday — observance shifts', () => {
  it('Sunday holiday observed the following Monday', () => {
    // Jan 1 2023 was a Sunday → New Year observed Mon Jan 2.
    expect(marketHoliday(2023, 1, 2)).toBe("New Year's Day")
    expect(marketHoliday(2023, 1, 1)).toBeNull()
  })

  it('Saturday holiday observed the preceding Friday', () => {
    // Dec 25 2021 was a Saturday → Christmas observed Fri Dec 24.
    expect(marketHoliday(2021, 12, 24)).toBe('Christmas')
  })
})

describe('early-close half-days', () => {
  it('runs after-hours from 13:00 ET on the Friday after Thanksgiving', () => {
    // Fri 2026-11-27 (Black Friday). EST = UTC-5.
    expect(getMarketStatus(new Date('2026-11-27T17:30:00Z')).phase).toBe(
      'regular',
    ) // 12:30 EST — still open
    const early = getMarketStatus(new Date('2026-11-27T18:30:00Z')) // 13:30 EST
    expect(early.phase).toBe('after') // past the 13:00 early close
    expect(early.halfDay).toBe(true)
  })

  it('a normal day is still regular at 13:30 ET', () => {
    const status = getMarketStatus(new Date('2026-07-08T17:30:00Z')) // 13:30 EDT
    expect(status.phase).toBe('regular')
    expect(status.halfDay).toBe(false)
  })
})

describe('marketTooltip', () => {
  const tip = (iso: string) => marketTooltip(new Date(iso))

  it('counts down to the regular close when open', () => {
    // Wed 10:00 EDT → 6h to the 16:00 close.
    expect(tip('2026-07-08T14:00:00Z')).toBe('Market Open · Closes in 6h')
  })

  it('formats hours and minutes together', () => {
    // Wed 14:15 EDT → 1h 45m to the close.
    expect(tip('2026-07-08T18:15:00Z')).toBe('Market Open · Closes in 1h 45m')
  })

  it('counts down to the open in pre-market', () => {
    // Wed 08:00 EDT → 1h 30m to the 09:30 open.
    expect(tip('2026-07-08T12:00:00Z')).toBe('Pre-Market · Opens in 1h 30m')
  })

  it('counts down to the after-hours close', () => {
    // Wed 16:30 EDT → 3h 30m to the 20:00 end.
    expect(tip('2026-07-08T20:30:00Z')).toBe('After-Hours · Ends in 3h 30m')
  })

  it('notes the early close on a half day', () => {
    // Fri 12:30 EST (Black Friday) → 30m to the 13:00 early close.
    expect(tip('2026-11-27T17:30:00Z')).toBe(
      'Market Open · Closes in 30m (Early Close)',
    )
  })

  it('gives the next open on the weekend', () => {
    // Sat → Monday.
    expect(tip('2026-07-11T15:00:00Z')).toBe(
      'Market Closed · Opens Monday at 9:30 AM ET',
    )
  })

  it('names the holiday and the next open', () => {
    // Christmas (Fri) → Monday.
    expect(tip('2026-12-25T15:00:00Z')).toBe(
      'Closed — Christmas · Opens Monday at 9:30 AM ET',
    )
  })

  it('says "Tomorrow" after the session ends on a weekday', () => {
    // Wed 21:00 EDT → Thu.
    expect(tip('2026-07-09T01:00:00Z')).toBe(
      'Market Closed · Opens Tomorrow at 9:30 AM ET',
    )
  })

  it('says "at 9:30" in the pre-dawn closed window', () => {
    // Wed 02:00 EDT → today's open still ahead.
    expect(tip('2026-07-08T06:00:00Z')).toBe(
      'Market Closed · Opens at 9:30 AM ET',
    )
  })
})
