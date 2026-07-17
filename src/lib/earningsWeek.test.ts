import { describe, expect, it } from 'vitest'
import {
  addDays,
  buildForwardWeeks,
  buildWeek,
  dayOfWeek,
  dayRelativeLabel,
  firstForwardMonday,
  forwardWindow,
  longDate,
  mondayOf,
  spanLabel,
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

describe('spanLabel', () => {
  it('collapses a single day to one date', () => {
    expect(spanLabel('2026-07-17', '2026-07-17')).toBe('Jul 17, 2026')
  })

  it('collapses a same-month span', () => {
    expect(spanLabel('2026-07-20', '2026-07-24')).toBe('Jul 20 – 24, 2026')
  })

  it('spells both months across a month boundary', () => {
    expect(spanLabel('2026-06-29', '2026-07-03')).toBe('Jun 29 – Jul 3, 2026')
  })

  it('spells both years across New Year', () => {
    expect(spanLabel('2026-12-28', '2027-01-01')).toBe(
      'Dec 28, 2026 – Jan 1, 2027',
    )
  })
})

describe('firstForwardMonday', () => {
  it("is this week's Monday on a weekday", () => {
    expect(firstForwardMonday('2026-07-13')).toBe('2026-07-13') // Monday
    expect(firstForwardMonday('2026-07-17')).toBe('2026-07-13') // Friday
  })

  it('rolls to next Monday on a weekend (no trading days left)', () => {
    expect(firstForwardMonday('2026-07-18')).toBe('2026-07-20') // Saturday
    expect(firstForwardMonday('2026-07-19')).toBe('2026-07-20') // Sunday
  })
})

describe('forwardWindow', () => {
  it('spans from today through the Friday of the last shown week', () => {
    expect(forwardWindow('2026-07-17', 2)).toEqual({
      from: '2026-07-17',
      to: '2026-07-24', // Friday of next week
    })
  })

  it('counts weeks from next week when today is a weekend', () => {
    expect(forwardWindow('2026-07-18', 2)).toEqual({
      from: '2026-07-18', // Saturday
      to: '2026-07-31', // last Friday of the two forward weeks (07-20, 07-27)
    })
  })

  it('opens a paged-forward window on its own Monday, never before today', () => {
    // Friday 07-17, two weeks paged two weeks ahead → weeks of 07-27 and 08-03.
    expect(forwardWindow('2026-07-17', 2, 2)).toEqual({
      from: '2026-07-27',
      to: '2026-08-07',
    })
  })
})

describe('dayRelativeLabel', () => {
  it('names today and tomorrow, nothing else', () => {
    expect(dayRelativeLabel('2026-07-17', '2026-07-17')).toBe('Today')
    expect(dayRelativeLabel('2026-07-18', '2026-07-17')).toBe('Tomorrow')
    expect(dayRelativeLabel('2026-07-20', '2026-07-17')).toBeNull()
  })
})

describe('buildForwardWeeks — forward-only week sections from today', () => {
  it("shows only the current week's remaining days, then full weeks ahead", () => {
    const today = '2026-07-17' // Friday
    const groups = buildForwardWeeks(today, 2, [
      day('2026-07-17', [item('AAPL', '2026-07-17')]),
      day('2026-07-21', [
        item('MSFT', '2026-07-21'),
        item('NVDA', '2026-07-21'),
      ]),
    ])

    expect(groups).toHaveLength(2)

    expect(groups[0].heading).toBe('This week')
    expect(groups[0].rangeLabel).toBe('Jul 17, 2026')
    expect(groups[0].slots.map((s) => s.date)).toEqual(['2026-07-17'])
    expect(groups[0].count).toBe(1)

    expect(groups[1].heading).toBe('Next week')
    expect(groups[1].slots.map((s) => s.date)).toEqual([
      '2026-07-20',
      '2026-07-21',
      '2026-07-22',
      '2026-07-23',
      '2026-07-24',
    ])
    expect(groups[1].slots[1].items.map((i) => i.ticker)).toEqual([
      'MSFT',
      'NVDA',
    ])
    expect(groups[1].count).toBe(2)
  })

  it('never carries a day before today', () => {
    const today = '2026-07-17' // Friday; Mon–Thu are already past
    const groups = buildForwardWeeks(today, 1, [
      day('2026-07-15', [item('PAST', '2026-07-15')]), // Wednesday — passed
      day('2026-07-17', [item('NOW', '2026-07-17')]),
    ])
    const dates = groups.flatMap((g) => g.slots.map((s) => s.date))
    expect(dates.every((d) => d >= today)).toBe(true)
    expect(dates).not.toContain('2026-07-15')
  })

  it('labels the first shown week "Next week" when viewed on a weekend', () => {
    const groups = buildForwardWeeks('2026-07-18', 2, []) // Saturday
    expect(groups[0].heading).toBe('Next week')
    expect(groups[0].monday).toBe('2026-07-20')
  })

  it('pages forward by the offset, showing only future full weeks', () => {
    const today = '2026-07-17' // Friday
    const groups = buildForwardWeeks(
      today,
      2,
      [day('2026-07-28', [item('AAPL', '2026-07-28')])],
      2, // skip this week + next week
    )
    expect(groups.map((g) => g.monday)).toEqual(['2026-07-27', '2026-08-03'])
    // A paged-ahead week is neither "this" nor "next", so it's labelled by range only.
    expect(groups[0].heading).toBe('')
    expect(groups[0].slots).toHaveLength(5)
    expect(groups[0].count).toBe(1)
  })
})
