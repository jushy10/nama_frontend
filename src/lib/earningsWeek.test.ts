import { describe, expect, it } from 'vitest'
import {
  addDays,
  buildWeek,
  dayOfWeek,
  longDate,
  mondayOf,
  todayIso,
  weekRangeLabel,
  weekdays,
} from '@/lib/earningsWeek'
import type { EarningsCalendarDay, EarningsCalendarItem } from '@/lib/api'

// Anchor: 2026-07-08 is an ordinary Wednesday (see lib/market.test.ts), so
// 2026-07-13 is the Monday of that week and 2026-07-14 a Tuesday.

const item = (
  ticker: string,
  when: string,
  sector: string | null = 'technology',
): EarningsCalendarItem => ({ ticker, name: `${ticker} Inc`, sector, when })

const day = (
  date: string,
  items: EarningsCalendarItem[],
): EarningsCalendarDay => ({
  date,
  count: items.length,
  items,
})

describe('dayOfWeek — timezone-independent', () => {
  it('reads the civil date, not a shifted local instant', () => {
    expect(dayOfWeek('2026-07-13')).toBe(1) // Monday
    expect(dayOfWeek('2026-07-14')).toBe(2) // Tuesday
    expect(dayOfWeek('2026-07-19')).toBe(0) // Sunday
  })
})

describe('addDays', () => {
  it('steps forward and back', () => {
    expect(addDays('2026-07-14', 1)).toBe('2026-07-15')
    expect(addDays('2026-07-14', -1)).toBe('2026-07-13')
  })

  it('rolls over a month boundary', () => {
    expect(addDays('2026-07-31', 1)).toBe('2026-08-01')
    expect(addDays('2026-08-01', -1)).toBe('2026-07-31')
  })

  it('rolls over a year boundary', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })
})

describe('mondayOf', () => {
  it('returns the same Monday for any day in the week', () => {
    expect(mondayOf('2026-07-13')).toBe('2026-07-13') // Monday → itself
    expect(mondayOf('2026-07-14')).toBe('2026-07-13') // Tuesday
    expect(mondayOf('2026-07-17')).toBe('2026-07-13') // Friday
  })

  it('maps Sunday back to the week that started Monday (ISO week)', () => {
    expect(mondayOf('2026-07-19')).toBe('2026-07-13') // Sunday
  })
})

describe('weekdays', () => {
  it('is the five Mon–Fri dates of the week', () => {
    expect(weekdays('2026-07-13')).toEqual([
      '2026-07-13',
      '2026-07-14',
      '2026-07-15',
      '2026-07-16',
      '2026-07-17',
    ])
  })
})

describe('weekRangeLabel', () => {
  it('collapses a same-month week', () => {
    expect(weekRangeLabel('2026-07-13')).toBe('Jul 13 – 17, 2026')
  })

  it('spells both months when the week straddles a month', () => {
    expect(weekRangeLabel('2026-06-29')).toBe('Jun 29 – Jul 3, 2026')
  })

  it('spells both years when the week straddles New Year', () => {
    expect(weekRangeLabel('2026-12-28')).toBe('Dec 28, 2026 – Jan 1, 2027')
  })
})

describe('longDate', () => {
  it('is a full, unshifted human date', () => {
    expect(longDate('2026-07-14')).toBe('Tuesday, July 14, 2026')
  })
})

describe('todayIso', () => {
  it('reads the local civil date, zero-padded', () => {
    expect(todayIso(new Date(2026, 6, 4))).toBe('2026-07-04') // month is 0-based here
  })
})

describe('buildWeek — grouping the API days onto Mon–Fri slots', () => {
  const monday = '2026-07-13'

  it('places each API day on its weekday and fills the quiet days empty', () => {
    const slots = buildWeek(monday, [
      day('2026-07-14', [
        item('AAPL', '2026-07-14'),
        item('MSFT', '2026-07-14'),
      ]),
      day('2026-07-16', [item('NVDA', '2026-07-16')]),
    ])

    expect(slots.map((s) => s.date)).toEqual([
      '2026-07-13',
      '2026-07-14',
      '2026-07-15',
      '2026-07-16',
      '2026-07-17',
    ])
    expect(slots[0].items).toEqual([]) // Mon — quiet
    expect(slots[1].items.map((i) => i.ticker)).toEqual(['AAPL', 'MSFT']) // Tue
    expect(slots[2].items).toEqual([]) // Wed — quiet
    expect(slots[3].items.map((i) => i.ticker)).toEqual(['NVDA']) // Thu
    expect(slots[4].items).toEqual([]) // Fri
  })

  it('carries the display fields for each slot', () => {
    const slots = buildWeek(monday, [])
    expect(slots[0]).toMatchObject({
      weekday: 'Mon',
      dayOfMonth: 13,
      monthShort: 'Jul',
    })
    expect(slots[4]).toMatchObject({
      weekday: 'Fri',
      dayOfMonth: 17,
      monthShort: 'Jul',
    })
  })

  it('ignores an API day outside the Mon–Fri span (never a sixth column)', () => {
    const slots = buildWeek(monday, [
      day('2026-07-18', [item('SAT', '2026-07-18')]), // Saturday — out of the work week
      day('2026-07-20', [item('NEXT', '2026-07-20')]), // next Monday
    ])
    expect(slots).toHaveLength(5)
    expect(slots.every((s) => s.items.length === 0)).toBe(true)
  })
})
