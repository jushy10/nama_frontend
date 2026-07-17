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
 * A compact label for an inclusive `[from, to]` date span. A single date collapses to
 * `Jul 17, 2026`; a same-month span to `Jul 20 – 24, 2026`; a month straddle widens to
 * `Jun 29 – Jul 3, 2026`; a year straddle spells both years. Used for the week-section
 * ranges (where the current week starts *today*, not Monday), with `weekRangeLabel`
 * delegating here for the fixed Mon–Fri case.
 */
export function spanLabel(fromIso: IsoDate, toIso: IsoDate): string {
  const a = parseIso(fromIso)
  const b = parseIso(toIso)
  const start = `${MONTHS_SHORT[a.m - 1]} ${a.d}`
  if (fromIso === toIso) return `${start}, ${a.y}`
  if (a.y !== b.y) {
    return `${start}, ${a.y} – ${MONTHS_SHORT[b.m - 1]} ${b.d}, ${b.y}`
  }
  const end = a.m === b.m ? `${b.d}` : `${MONTHS_SHORT[b.m - 1]} ${b.d}`
  return `${start} – ${end}, ${b.y}`
}

/**
 * A compact label for the Mon–Fri span, e.g. `Jul 14 – 18, 2026` — collapsing the
 * shared month/year, and widening to `Jun 29 – Jul 3, 2026` when the week straddles
 * a month (or a year) boundary.
 */
export function weekRangeLabel(monday: IsoDate): string {
  return spanLabel(monday, addDays(monday, 4))
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

/** Whether an ISO date is a weekend day (Sat/Sun) — no US company reports then. */
function isWeekend(iso: IsoDate): boolean {
  const dow = dayOfWeek(iso)
  return dow === 0 || dow === 6
}

/**
 * The Monday of the first week the *forward* calendar shows: this week's Monday on a
 * weekday (so today's remaining days lead the view), or next week's Monday on a weekend
 * (this week has no trading days left to show).
 */
export function firstForwardMonday(today: IsoDate): IsoDate {
  const thisMonday = mondayOf(today)
  return isWeekend(today) ? addDays(thisMonday, 7) : thisMonday
}

/**
 * The inclusive `[from, to]` window the forward calendar fetches: from **today** through
 * the Friday of the last shown week (`weeks` counted from the first forward week). This
 * is what bounds the API read — starting at today means the response never carries a
 * report that has already happened.
 */
export function forwardWindow(
  today: IsoDate,
  weeks: number,
): { from: IsoDate; to: IsoDate } {
  const firstMonday = firstForwardMonday(today)
  const lastFriday = addDays(firstMonday, (Math.max(1, weeks) - 1) * 7 + 4)
  return { from: today, to: lastFriday }
}

/** How a shown week relates to now — drives its `This week` / `Next week` heading. */
export type WeekRelation = 'this' | 'next' | 'later'

const RELATION_HEADING: Record<WeekRelation, string> = {
  this: 'This week',
  next: 'Next week',
  later: '',
}

function weekRelation(monday: IsoDate, today: IsoDate): WeekRelation {
  const thisMonday = mondayOf(today)
  if (monday === thisMonday) return 'this'
  if (monday === addDays(thisMonday, 7)) return 'next'
  return 'later'
}

/** One week section of the forward calendar: its heading, the date span actually shown
 *  (the current week starts today, so it can be a single day), the forward day slots,
 *  and the total reports across them. */
export interface WeekGroup {
  monday: IsoDate
  relation: WeekRelation
  /** `This week`, `Next week`, or `''` for weeks further out (labelled by range only). */
  heading: string
  /** The span actually shown, e.g. `Jul 17, 2026` (a lone Friday) or `Jul 20 – 24, 2026`. */
  rangeLabel: string
  slots: DaySlot[]
  count: number
}

/**
 * Build the forward calendar as a list of week sections starting today, dropping every
 * day already past. `weeks` sections are produced from the first forward week onward;
 * each carries only its today-or-later weekday slots — so the current week shows just its
 * remaining days (on a Friday, only Friday). A week with no forward weekday is omitted
 * (e.g. the fully-past current week when viewed on a weekend). ISO date strings compare
 * lexicographically, so `date >= today` is a correct "not in the past" test.
 */
export function buildForwardWeeks(
  today: IsoDate,
  weeks: number,
  days: EarningsCalendarDay[],
): WeekGroup[] {
  const firstMonday = firstForwardMonday(today)
  const groups: WeekGroup[] = []
  for (let i = 0; i < Math.max(1, weeks); i++) {
    const monday = addDays(firstMonday, i * 7)
    const slots = buildWeek(monday, days).filter((s) => s.date >= today)
    if (slots.length === 0) continue
    const relation = weekRelation(monday, today)
    groups.push({
      monday,
      relation,
      heading: RELATION_HEADING[relation],
      rangeLabel: spanLabel(slots[0].date, slots[slots.length - 1].date),
      slots,
      count: slots.reduce((n, s) => n + s.items.length, 0),
    })
  }
  return groups
}

/** A friendly relative label for a day header — `Today`, `Tomorrow`, or `null` for any
 *  other day (which shows its weekday/date instead). */
export function dayRelativeLabel(iso: IsoDate, today: IsoDate): string | null {
  if (iso === today) return 'Today'
  if (iso === addDays(today, 1)) return 'Tomorrow'
  return null
}
