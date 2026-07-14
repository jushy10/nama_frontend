/**
 * Week-grouping helpers for the earnings calendar.
 *
 * The API returns earnings grouped by day, each day an ISO date string
 * (`YYYY-MM-DD`). The week view renders a Monday–Friday agenda, so this maps the
 * API's (sparse) days onto the five fixed weekday slots — filling the quiet days —
 * and provides the date arithmetic and labels the page needs.
 *
 * All date math is done on the *civil* date via UTC (`Date.UTC`), never on a
 * local/parsed `Date`. An ISO date like `2026-07-14` parsed with `new Date(...)`
 * is UTC midnight, which renders as the *previous* day for any viewer west of
 * UTC — the classic off-by-one. Working in UTC throughout keeps a date the same
 * date for everyone, matching the discipline in `lib/market.ts`.
 */

import type { EarningsCalendarDay, EarningsCalendarItem } from '@/lib/api'

/** An ISO civil date, `YYYY-MM-DD`. */
export type IsoDate = string

const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface Civil {
  y: number
  m: number // 1–12
  d: number
}

/** Parse `YYYY-MM-DD` into its civil fields (no timezone involved). */
export function parseIso(iso: IsoDate): Civil {
  const [y, m, d] = iso.split('-').map(Number)
  return { y, m, d }
}

/** Format civil fields back to a zero-padded `YYYY-MM-DD`. */
function toIso({ y, m, d }: Civil): IsoDate {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${y}-${pad(m)}-${pad(d)}`
}

/** The civil date as a UTC `Date` — the safe anchor for weekday/arithmetic. */
function utc({ y, m, d }: Civil): Date {
  return new Date(Date.UTC(y, m - 1, d))
}

/** Day of week (0=Sun … 6=Sat) of a civil date, timezone-independent. */
export function dayOfWeek(iso: IsoDate): number {
  return utc(parseIso(iso)).getUTCDay()
}

/** `iso` shifted by `n` days (may be negative), normalized via UTC overflow. */
export function addDays(iso: IsoDate, n: number): IsoDate {
  const dt = utc(parseIso(iso))
  dt.setUTCDate(dt.getUTCDate() + n)
  return toIso({
    y: dt.getUTCFullYear(),
    m: dt.getUTCMonth() + 1,
    d: dt.getUTCDate(),
  })
}

/** The Monday (ISO week start) of the week containing `iso`. */
export function mondayOf(iso: IsoDate): IsoDate {
  const dow = dayOfWeek(iso) // 0=Sun … 6=Sat
  // Days back to Monday: Sun (0) is 6 back; Mon (1) is 0; … Sat (6) is 5.
  const back = (dow + 6) % 7
  return addDays(iso, -back)
}

/** The five weekday ISO dates (Mon…Fri) of the week starting at `monday`. */
export function weekdays(monday: IsoDate): IsoDate[] {
  return [0, 1, 2, 3, 4].map((n) => addDays(monday, n))
}

/** Today's civil date (the viewer's local day), as an ISO string. */
export function todayIso(now: Date = new Date()): IsoDate {
  return toIso({
    y: now.getFullYear(),
    m: now.getMonth() + 1,
    d: now.getDate(),
  })
}

/** Short weekday label for a date, e.g. `Mon`. */
export function weekdayShort(iso: IsoDate): string {
  return WEEKDAYS_SHORT[dayOfWeek(iso)]
}

/** Short month label for a date, e.g. `Jul`. */
export function monthShort(iso: IsoDate): string {
  return MONTHS_SHORT[parseIso(iso).m - 1]
}

/** Day-of-month for a date, e.g. `14`. */
export function dayOfMonth(iso: IsoDate): number {
  return parseIso(iso).d
}

/** A full, human date, e.g. `Tuesday, July 14, 2026` — used for the brief masthead. */
export function longDate(iso: IsoDate): string {
  const dow = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ][dayOfWeek(iso)]
  const { m, d, y } = parseIso(iso)
  const month = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ][m - 1]
  return `${dow}, ${month} ${d}, ${y}`
}

/**
 * A compact label for the Mon–Fri span, e.g. `Jul 14 – 18, 2026` — collapsing the
 * shared month/year, and widening to `Jun 29 – Jul 3, 2026` when the week straddles
 * a month (or a year) boundary.
 */
export function weekRangeLabel(monday: IsoDate): string {
  const friday = addDays(monday, 4)
  const a = parseIso(monday)
  const b = parseIso(friday)
  const start = `${MONTHS_SHORT[a.m - 1]} ${a.d}`
  if (a.y !== b.y) {
    return `${start}, ${a.y} – ${MONTHS_SHORT[b.m - 1]} ${b.d}, ${b.y}`
  }
  const end = a.m === b.m ? `${b.d}` : `${MONTHS_SHORT[b.m - 1]} ${b.d}`
  return `${start} – ${end}, ${b.y}`
}

/** One day column of the week grid: its date and the reports scheduled that day. */
export interface DaySlot {
  date: IsoDate
  weekday: string
  dayOfMonth: number
  monthShort: string
  items: EarningsCalendarItem[]
}

/**
 * Fold the API's grouped days onto the five fixed weekday slots (Mon–Fri) of the
 * week starting at `monday`, so quiet days still render as empty columns. Any API
 * day outside that Mon–Fri span is ignored — the page fetches exactly Mon–Fri, so
 * there is nothing to drop in practice, but the guard keeps the grid to five
 * columns regardless of what it's handed.
 */
export function buildWeek(
  monday: IsoDate,
  days: EarningsCalendarDay[],
): DaySlot[] {
  const itemsByDate = new Map<IsoDate, EarningsCalendarItem[]>()
  for (const day of days) itemsByDate.set(day.date, day.items)
  return weekdays(monday).map((date) => ({
    date,
    weekday: weekdayShort(date),
    dayOfMonth: dayOfMonth(date),
    monthShort: monthShort(date),
    items: itemsByDate.get(date) ?? [],
  }))
}
