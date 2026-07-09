/** US stock-market session status, for the menu-bar phase hint. */

/**
 * Which part of the trading day it is, in US Eastern Time:
 * - `pre` — pre-market, 04:00–09:30
 * - `regular` — the regular session, 09:30–16:00 (13:00 on early-close days)
 * - `after` — after-hours, 16:00–20:00 (13:00–17:00 on early-close days)
 * - `closed` — overnight, weekends, and holidays
 */
export type MarketPhase = 'pre' | 'regular' | 'after' | 'closed'

export interface MarketStatus {
  phase: MarketPhase
  /** Holiday name when the market is shut for a US holiday, else null. */
  holiday: string | null
  /** True on early-close (½) trading days — the session ends 13:00 ET. */
  halfDay: boolean
}

// Session bounds as minutes-since-ET-midnight.
const PRE_OPEN = 4 * 60 // 04:00
const REG_OPEN = 9 * 60 + 30 // 09:30
const REG_CLOSE = 16 * 60 // 16:00
const REG_CLOSE_HALF = 13 * 60 // 13:00 (early close)
const AFTER_CLOSE = 20 * 60 // 20:00
const AFTER_CLOSE_HALF = 17 * 60 // 17:00 (early close)

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

/**
 * Reads a Date's wall-clock in America/New_York — so the answer is right no
 * matter the viewer's own timezone, and US daylight saving is handled for us.
 */
const ET_PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  weekday: 'short',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

interface EtFields {
  weekday: string // 'Mon'…'Sun'
  year: number
  month: number // 1–12
  day: number
  minutes: number // minutes since ET midnight
}

/** A Date's Eastern-Time calendar/clock fields, pulled in one pass. */
function etFields(now: Date): EtFields {
  const parts = ET_PARTS.formatToParts(now)
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? ''
  let hour = Number(value('hour'))
  if (hour === 24) hour = 0 // some engines emit '24' for midnight
  return {
    weekday: value('weekday'),
    year: Number(value('year')),
    month: Number(value('month')),
    day: Number(value('day')),
    minutes: hour * 60 + Number(value('minute')),
  }
}

/** Day-of-week (0=Sun…6=Sat) of a civil date, timezone-independent (UTC math). */
function dayOfWeek(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

function isWeekday(dow: number): boolean {
  return dow >= 1 && dow <= 5
}

/** Day-of-month of the `n`-th `weekday` (0=Sun) in a month. */
function nthWeekday(
  year: number,
  month: number,
  weekday: number,
  n: number,
): number {
  const firstDow = dayOfWeek(year, month, 1)
  return 1 + ((weekday - firstDow + 7) % 7) + (n - 1) * 7
}

/** Day-of-month of the last `weekday` (0=Sun) in a month. */
function lastWeekday(year: number, month: number, weekday: number): number {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const lastDow = dayOfWeek(year, month, daysInMonth)
  return daysInMonth - ((lastDow - weekday + 7) % 7)
}

/**
 * Easter Sunday (Gregorian) via the Anonymous algorithm — the anchor for Good
 * Friday, the one moveable-date market holiday.
 */
function easter(year: number): { month: number; day: number } {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) // 3=Mar, 4=Apr
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return { month, day }
}

/** Cached per year — the holiday calendar only changes once a year. */
const holidayCache = new Map<number, Map<string, string>>()

/** Builds the `${month}-${day}` → name map of full market closures for a year. */
function computeHolidays(year: number): Map<string, string> {
  const map = new Map<string, string>()

  /** Store a holiday at a civil date, normalizing month/day overflow via UTC. */
  const set = (month: number, day: number, name: string) => {
    const dt = new Date(Date.UTC(year, month - 1, day))
    map.set(`${dt.getUTCMonth() + 1}-${dt.getUTCDate()}`, name)
  }

  /**
   * Fixed-date holiday with NYSE observance: falls on Sunday → observed Monday;
   * on Saturday → observed the preceding Friday, EXCEPT New Year's (its Friday
   * would land in the prior year, which the exchange doesn't observe).
   */
  const fixed = (month: number, day: number, name: string, newYear = false) => {
    const dow = dayOfWeek(year, month, day)
    if (dow === 0) set(month, day + 1, name)
    else if (dow === 6 && !newYear) set(month, day - 1, name)
    else set(month, day, name)
  }

  fixed(1, 1, "New Year's Day", true)
  fixed(6, 19, 'Juneteenth')
  fixed(7, 4, 'Independence Day')
  fixed(12, 25, 'Christmas')

  set(1, nthWeekday(year, 1, 1, 3), 'Martin Luther King Jr. Day') // 3rd Mon Jan
  set(2, nthWeekday(year, 2, 1, 3), "Presidents' Day") // 3rd Mon Feb
  set(5, lastWeekday(year, 5, 1), 'Memorial Day') // last Mon May
  set(9, nthWeekday(year, 9, 1, 1), 'Labor Day') // 1st Mon Sep
  set(11, nthWeekday(year, 11, 4, 4), 'Thanksgiving') // 4th Thu Nov

  const { month: em, day: ed } = easter(year)
  const gf = new Date(Date.UTC(year, em - 1, ed - 2)) // Good Friday = Easter − 2
  set(gf.getUTCMonth() + 1, gf.getUTCDate(), 'Good Friday')

  return map
}

/** Holiday name if the ET civil date is a full market closure, else null. */
export function marketHoliday(
  year: number,
  month: number,
  day: number,
): string | null {
  let map = holidayCache.get(year)
  if (!map) {
    map = computeHolidays(year)
    holidayCache.set(year, map)
  }
  return map.get(`${month}-${day}`) ?? null
}

/** Whether the ET civil date is a regular trading day (weekday, not a holiday). */
function isTradingDay(year: number, month: number, day: number): boolean {
  return (
    isWeekday(dayOfWeek(year, month, day)) && !marketHoliday(year, month, day)
  )
}

/**
 * Whether the ET civil date is an NYSE early-close (½) day: July 3 (when the
 * 3rd and 4th are both weekdays), the Friday after Thanksgiving, and Christmas
 * Eve (when the 24th is a weekday and Christmas a weekday). On the years these
 * roll into a weekend they become full closures instead, handled above.
 */
function isHalfDay(year: number, month: number, day: number): boolean {
  if (month === 7 && day === 3) {
    return isWeekday(dayOfWeek(year, 7, 3)) && isWeekday(dayOfWeek(year, 7, 4))
  }
  if (month === 11 && day === nthWeekday(year, 11, 4, 4) + 1) return true
  if (month === 12 && day === 24) {
    const dec25 = dayOfWeek(year, 12, 25)
    return isWeekday(dayOfWeek(year, 12, 24)) && dec25 >= 2 && dec25 <= 5
  }
  return false
}

/**
 * The market's trading phase at `now`, in US Eastern Time. Covers pre-market,
 * the regular session, after-hours and closed, and knows US market holidays
 * (computed, so it never goes stale) and early-close half-days.
 *
 * One simplification: it assumes the standard extended-hours window (04:00 pre,
 * 20:00 after) — brokers vary at the edges — so treat the extended phases as an
 * at-a-glance hint, not the exact tradable window.
 */
export function getMarketStatus(now: Date): MarketStatus {
  const { weekday, year, month, day, minutes } = etFields(now)

  if (weekday === 'Sat' || weekday === 'Sun') {
    return { phase: 'closed', holiday: null, halfDay: false }
  }

  const holiday = marketHoliday(year, month, day)
  if (holiday) return { phase: 'closed', holiday, halfDay: false }

  const halfDay = isHalfDay(year, month, day)
  const regClose = halfDay ? REG_CLOSE_HALF : REG_CLOSE
  const afterClose = halfDay ? AFTER_CLOSE_HALF : AFTER_CLOSE

  let phase: MarketPhase
  if (minutes >= REG_OPEN && minutes < regClose) phase = 'regular'
  else if (minutes >= PRE_OPEN && minutes < REG_OPEN) phase = 'pre'
  else if (minutes >= regClose && minutes < afterClose) phase = 'after'
  else phase = 'closed'

  return { phase, holiday: null, halfDay }
}

/** Convenience: is the regular session open at `now`? */
export function isMarketOpen(now: Date): boolean {
  return getMarketStatus(now).phase === 'regular'
}

/** A minutes duration as a compact "2h 14m" / "45m" countdown. */
function countdown(mins: number): string {
  const clamped = Math.max(1, mins)
  const h = Math.floor(clamped / 60)
  const m = clamped % 60
  if (h && m) return `${h}h ${m}m`
  return h ? `${h}h` : `${m}m`
}

/** When the next regular session opens, phrased relative to `now` (ET). */
function nextOpenLabel(now: Date): string {
  const { year, month, day, minutes } = etFields(now)
  // Today's 09:30 is only still ahead in the pre-dawn "closed" window; past
  // that (after-hours over, weekend, holiday) the next open is a later day.
  const todayOpenAhead = isTradingDay(year, month, day) && minutes < REG_OPEN

  for (let k = todayOpenAhead ? 0 : 1; k <= 8; k++) {
    const dt = new Date(Date.UTC(year, month - 1, day + k))
    const cy = dt.getUTCFullYear()
    const cm = dt.getUTCMonth() + 1
    const cd = dt.getUTCDate()
    if (!isTradingDay(cy, cm, cd)) continue
    if (k === 0) return 'at 9:30 AM ET'
    if (k === 1) return 'Tomorrow at 9:30 AM ET'
    return `${DAY_NAMES[dt.getUTCDay()]} at 9:30 AM ET`
  }
  return 'soon' // unreachable — a trading day always lands within 8 days
}

/**
 * The current phase as a short, always-visible menu-bar label — the at-a-glance
 * status shown beside the icon (the tooltip carries the fuller countdown).
 * E.g. "Market Open", "Pre-Market", "After Hours", "Market Closed".
 */
export function marketLabel(now: Date): string {
  switch (getMarketStatus(now).phase) {
    case 'regular':
      return 'Market Open'
    case 'pre':
      return 'Pre-Market'
    case 'after':
      return 'After Hours'
    case 'closed':
      return 'Market Closed'
  }
}

/**
 * A one-line, human summary of where the market is now and when it next flips —
 * the menu-bar hover text. E.g. "Market Open · Closes in 2h 14m",
 * "Pre-Market · Opens in 45m", "Market Closed · Opens Monday at 9:30 AM ET".
 */
export function marketTooltip(now: Date): string {
  const { phase, holiday, halfDay } = getMarketStatus(now)
  const { minutes } = etFields(now)
  const regClose = halfDay ? REG_CLOSE_HALF : REG_CLOSE
  const afterClose = halfDay ? AFTER_CLOSE_HALF : AFTER_CLOSE

  switch (phase) {
    case 'regular': {
      const early = halfDay ? ' (Early Close)' : ''
      return `Market Open · Closes in ${countdown(regClose - minutes)}${early}`
    }
    case 'pre':
      return `Pre-Market · Opens in ${countdown(REG_OPEN - minutes)}`
    case 'after':
      return `After-Hours · Ends in ${countdown(afterClose - minutes)}`
    case 'closed': {
      const head = holiday ? `Closed — ${holiday}` : 'Market Closed'
      return `${head} · Opens ${nextOpenLabel(now)}`
    }
  }
}
