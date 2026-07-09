import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from 'react'
import {
  Box,
  Card,
  CardContent,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useTheme,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import type { SxProps, Theme } from '@mui/material/styles'
import { annualReported, annualUpcoming, beatConsistency } from '@/lib/api'
import type {
  AnnualEarnings,
  BeatConsistency,
  EarningsHistory,
  EarningsSurprise,
  NextEarnings,
  QuarterlyEarnings,
} from '@/lib/api'
import BarChartIcon from '@mui/icons-material/BarChart'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import { ForwardPeSection } from '@/components/ForwardPeSection'
import { heroWash } from '@/components/heroWash'

// The plot's viewBox WIDTH tracks the measured container width (so 1 unit ≈ 1px
// and text stays legible at any size — crucial on mobile), while the height is
// fixed at H. `W_FALLBACK` is used until the container is measured and in jsdom
// (where there's no layout), keeping tests on stable desktop geometry.
const W_FALLBACK = 820
const H = 300
// `right` leaves room for the value-axis labels — wide enough for compact
// revenue ("$120.0B"), not just EPS ("$3.27").
const PAD = { top: 30, right: 56, bottom: 46, left: 12 }

const fmtEps = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(n).toFixed(2)}`
const fmtPct = (n: number) => `${n >= 0 ? '+' : '-'}${Math.abs(n).toFixed(1)}%`
/** Compact signed percent ("+33%") for the growth row on narrow (phone) slots. */
const fmtPctShort = (n: number) =>
  `${n >= 0 ? '+' : '-'}${Math.abs(n).toFixed(0)}%`

/** Muted fill for the "estimate" bar — faint enough to sit behind the actual,
 *  and legible on both the dark and light canvas. Shared with the legend. */
const estimateColor = (theme: Theme) =>
  theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.18)'

/** "Q2 '24" from the fiscal period — or "FY24" for an annual row (a fiscal
 *  year with no quarter) — falling back to the report month. */
function quarterLabel(q: EarningsSurprise): string {
  if (q.fiscal_quarter && q.fiscal_year) {
    return `Q${q.fiscal_quarter} '${String(q.fiscal_year).slice(-2)}`
  }
  if (q.fiscal_year) {
    return `FY${String(q.fiscal_year).slice(-2)}`
  }
  if (q.period) {
    return new Date(q.period).toLocaleDateString('en-US', {
      month: 'short',
      year: '2-digit',
    })
  }
  return '—'
}

/** Parse a date-only "YYYY-MM-DD" as a *local* date. Using `new Date(iso)`
 *  treats it as UTC midnight, which formats a day early in negative offsets. */
function parseDateOnly(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** "Q3 '26" for the upcoming report — or "FY27" for an upcoming fiscal year —
 *  falling back to its expected month. */
function nextLabel(n: NextEarnings): string {
  if (n.fiscal_quarter && n.fiscal_year) {
    return `Q${n.fiscal_quarter} '${String(n.fiscal_year).slice(-2)}`
  }
  if (n.fiscal_year) {
    return `FY${String(n.fiscal_year).slice(-2)}`
  }
  if (n.report_date) {
    return parseDateOnly(n.report_date).toLocaleDateString('en-US', {
      month: 'short',
      year: '2-digit',
    })
  }
  return 'Next'
}

/** "Jul 30" — the expected report day, for the forecast column's sub-label. */
const fmtReportDate = (iso: string) =>
  parseDateOnly(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })

/** Compact revenue, e.g. "$89.0B" / "$1.2T". */
const fmtRev = (n: number) =>
  n.toLocaleString('en-US', {
    notation: 'compact',
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 1,
  })

/** Extra-compact revenue ("$216B") for the under-bar value labels when the
 *  columns run too narrow for the decimal ("$215.9B") — i.e. on phones. */
const fmtRevShort = (n: number) =>
  n.toLocaleString('en-US', {
    notation: 'compact',
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })

/** Format a value with `fmt`, or an em dash when it's missing. */
const orDash = (
  v: number | null | undefined,
  fmt: (n: number) => string,
): string => (v == null ? '—' : fmt(v))

const SESSION_LABEL: Record<string, string> = {
  bmo: 'before open',
  amc: 'after close',
  dmh: 'during hours',
}

/** One reported column for the grouped-bar chart: a muted "estimate" bar beside
 *  the reported "actual", coloured by whether it met or beat. Reported columns
 *  carry no growth figure — the bar heights already tell that story; only the
 *  forward columns annotate the growth their consensus implies. */
interface ChartBar {
  key: string
  label: string
  estimate: number | null
  actual: number | null
  beat: boolean | null
  surprise: number | null
}

/** One forward "expected" column — an analyst consensus for an upcoming report.
 *  `growth` is the change the consensus implies on the period right before it:
 *  the prior quarter (QoQ) for quarterly rows, the prior fiscal year (YoY) for
 *  annual ones. */
interface ChartForecast {
  key: string
  label: string
  estimate: number | null
  growth: number | null
}

/**
 * Growth of `value` on the immediately preceding period's figure, as a
 * percent. null when either side is missing or the base isn't positive — a
 * growth rate measured off a loss (or zero) base is meaningless.
 */
function growthPct(
  value: number | null,
  prior: number | null | undefined,
): number | null {
  if (value == null || prior == null || prior <= 0) return null
  return (value / prior - 1) * 100
}

/** The fiscal period immediately before `q`: the previous quarter (Q1 wraps to
 *  the prior year's Q4) — or, for annual rows (null quarter), the prior fiscal
 *  year. null when `q` names no fiscal year. */
function prevPeriodOf(q: {
  fiscal_year: number | null
  fiscal_quarter: number | null
}): { fy: number; fq: number | null } | null {
  if (q.fiscal_year == null) return null
  if (q.fiscal_quarter == null) return { fy: q.fiscal_year - 1, fq: null }
  return q.fiscal_quarter === 1
    ? { fy: q.fiscal_year - 1, fq: 4 }
    : { fy: q.fiscal_year, fq: q.fiscal_quarter - 1 }
}

/** The EPS series (newest-first), straight from the per-quarter fields. */
function epsSeries(quarters: EarningsSurprise[]): ChartBar[] {
  return quarters.map((q, i) => ({
    key: q.period ?? String(i),
    label: quarterLabel(q),
    estimate: q.estimate,
    actual: q.actual,
    beat: q.beat,
    surprise: q.surprise_percent,
  }))
}

/** The revenue series (newest-first): reported actuals only. The API carries no
 *  consensus revenue estimate, so there's no beat/surprise to derive — the
 *  forward consensus (next report) rides in as a forecast column instead.
 *  Quarters with no reported revenue are KEPT (actual stays null), so the chart
 *  draws a labelled "no data" slot for them rather than silently closing the
 *  gap. That makes a missing quarter visible — e.g. the latest one, which prints
 *  EPS before its EDGAR revenue lands, or a quarter EDGAR doesn't cover. */
function revenueSeries(quarters: EarningsSurprise[]): ChartBar[] {
  return quarters.map((q, i) => ({
    key: q.period ?? String(i),
    label: quarterLabel(q),
    estimate: null,
    actual: q.revenue_actual ?? null,
    beat: null,
    surprise: null,
  }))
}

/**
 * Forward columns from a consensus list, keeping only those with a value. Each
 * carries the growth its estimate implies on the *immediately preceding*
 * period — the prior quarter (QoQ) for quarterly rows, the prior fiscal year
 * (YoY) for annual ones. The base is the reported figure when `history`
 * reaches it, else the preceding *consensus* from the same list (so a later
 * estimate reads over the one before it, e.g. FY2 over FY1's estimate).
 */
function forecastSeries(
  list: NextEarnings[],
  value: (f: NextEarnings) => number | null,
  history: EarningsSurprise[],
  reportedValue: (q: EarningsSurprise) => number | null,
): ChartForecast[] {
  const priorFor = (f: NextEarnings): number | null => {
    const prev = prevPeriodOf(f)
    if (!prev) return null
    const reported = history.find(
      (q) => q.fiscal_year === prev.fy && q.fiscal_quarter === prev.fq,
    )
    const actual = reported ? reportedValue(reported) : null
    if (actual != null) return actual
    const consensus = list.find(
      (g) => g.fiscal_year === prev.fy && g.fiscal_quarter === prev.fq,
    )
    return consensus ? value(consensus) : null
  }
  return list
    .map((f, i) => ({
      key: f.report_date ?? String(i),
      label: nextLabel(f),
      estimate: value(f),
      growth: growthPct(value(f), priorFor(f)),
    }))
    .filter((f) => f.estimate != null)
}

/**
 * A grouped actual-vs-estimate bar chart for one metric (EPS or revenue). Each
 * quarter gets a muted "estimate" bar beside the reported "actual" (green when
 * it met/beat, red when it missed), oldest → newest, with the surprise % above
 * the pair and the actual value beneath the quarter label. A zero baseline keeps
 * loss quarters (negative values) readable. Any forward consensus columns are
 * appended at the right edge, styled as a forecast (a dashed accent outline).
 * Hovering a column fills the detail line above the plot with its exact numbers.
 */
function SurpriseChart({
  bars,
  forecasts,
  fmt,
  fmtShort,
  ariaLabel,
  neutralColor,
  growthLabel = 'QoQ',
}: {
  bars: ChartBar[]
  forecasts: ChartForecast[]
  fmt: (n: number) => string
  /** Tighter format for the under-bar value labels, used when the columns run
   *  too narrow for `fmt` (phones). The axis and detail line keep `fmt`, so the
   *  full precision stays a tap away. Omit to always label with `fmt`. */
  fmtShort?: (n: number) => string
  ariaLabel: string
  /** Bar/value colour for a series with no beat-or-miss meaning (revenue, which
   *  has no consensus estimate). Defaults to the muted axis grey EPS uses for the
   *  rare estimate-less quarter; revenue passes its own accent so its bars read
   *  as a deliberate series, not a greyed-out one. */
  neutralColor?: string
  /** What the forecast growth figure compares against, for the detail line:
   *  "QoQ" on the quarterly charts, "YoY" on the annual ones. */
  growthLabel?: string
}) {
  const theme = useTheme()
  const up = theme.palette.success.main
  const down = theme.palette.error.main
  const grid = theme.palette.divider
  const axis = theme.palette.text.secondary
  const est = estimateColor(theme)
  const forecast = theme.palette.primary.main // indigo accent for the forecast
  const neutral = neutralColor ?? axis
  // The pointer-selected column — a mouse hover or, on touch, a tap. null falls
  // back to the latest column carrying a value (see `active` below).
  const [hover, setHover] = useState<number | null>(null)

  // Track the rendered width so the viewBox matches it 1:1 — keeps labels at
  // their native pixel size instead of shrinking on narrow (mobile) screens.
  const wrapRef = useRef<HTMLDivElement>(null)
  const [cw, setCw] = useState(W_FALLBACK)
  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = () => {
      const w = el.getBoundingClientRect().width
      if (w > 0) setCw(Math.round(w))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const W = cw

  // Display-only responsiveness, driven by the *measured* width (not a media
  // query): on a phone-width canvas the columns get too tight for their
  // labels, so trim to the most recent history and the nearest forecasts, and
  // pull the axis gutters in. The underlying data is untouched — this only
  // changes what the narrow chart draws.
  const narrow = W < 420
  const pad = useMemo(
    () => (narrow ? { ...PAD, right: 40, bottom: 42, left: 8 } : PAD),
    [narrow],
  )
  const viewForecasts = useMemo(
    () => (narrow ? forecasts.slice(0, 2) : forecasts),
    [narrow, forecasts],
  )

  const hasForecast = viewForecasts.length > 0

  // Whether any forecast column carries a YoY growth figure (reported columns
  // never do — their bar heights already show the growth). The growth row
  // rides in 14 extra viewBox units beneath the value labels, so charts with
  // nothing to show keep their original height instead of a blank strip.
  const growthRow = viewForecasts.some((f) => f.growth != null)
  const vbH = growthRow ? H + 14 : H

  // API is newest-first; a time axis reads oldest → newest, left → right. The
  // forecasts sit at the far right, after the last reported quarter. On a
  // narrow canvas keep only the newest few columns so the labels stay legible.
  const data = useMemo(() => {
    const ordered = [...bars].reverse()
    return narrow ? ordered.slice(-5) : ordered
  }, [bars, narrow])

  const geo = useMemo(() => {
    const plotW = W - pad.left - pad.right
    const plotH = H - pad.top - pad.bottom

    // Always anchor the scale at zero so bar heights are comparable and the
    // baseline is meaningful; stretch to cover whatever actual/estimate reach,
    // plus the forward consensus if there is one.
    let max = 0
    let min = 0
    for (const b of data) {
      for (const v of [b.actual, b.estimate]) {
        if (v == null) continue
        if (v > max) max = v
        if (v < min) min = v
      }
    }
    for (const f of viewForecasts) {
      if (f.estimate == null) continue
      if (f.estimate > max) max = f.estimate
      if (f.estimate < min) min = f.estimate
    }
    if (max === min) max = 1 // all-zero / empty guard
    const padV = (max - min) * 0.15 || 1
    max += padV
    if (min < 0) min -= padV // only drop the floor when there are losses

    const n = data.length + viewForecasts.length
    const slot = plotW / Math.max(n, 1)
    const groupW = Math.min(slot * 0.62, 72)
    const gap = Math.min(groupW * 0.12, 4)
    // EPS pairs an estimate + actual bar in each group; a single-series metric
    // (revenue: actual only) gives its lone bar the whole group width so the
    // slot isn't left half-empty with a thin, lost-looking bar.
    const grouped = data.some((b) => b.estimate != null)
    const barW = grouped ? (groupW - gap) / 2 : groupW

    const cx = (i: number) => pad.left + slot * (i + 0.5)
    const y = (v: number) =>
      pad.top + (1 - (v - min) / (max - min || 1)) * plotH

    const tickN = 4
    const ticks = Array.from(
      { length: tickN + 1 },
      (_, i) => min + ((max - min) * i) / tickN,
    )

    return { cx, y, groupW, gap, barW, ticks, zeroY: y(0), slot, n }
  }, [data, viewForecasts, pad, W])

  if (data.length === 0 && !hasForecast) {
    return (
      <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
        No data available.
      </Typography>
    )
  }

  const { cx, y, groupW, gap, barW, ticks, zeroY, slot, n } = geo
  const fcIndex = data.length // the forecast column's slot, at the right edge

  // Value labels ride beneath every column, so on narrow slots (a phone-width
  // chart) the full format collides with its neighbours — swap in the tighter
  // one. 50 units ≈ what an 11px "$130.5B" needs to clear its slot.
  const barFmt = fmtShort && slot < 50 ? fmtShort : fmt
  // The growth row shortens the same way ("+34%"), keeping the decimal for
  // the detail line above the plot.
  const growthFmt = slot < 50 ? fmtPctShort : fmtPct
  // Under-bar quarter labels collide once the slots get tight; below ~44 units
  // a label no longer clears its neighbour. Keep the newest column labelled and
  // drop every other one going back — the value stays under every bar and a tap
  // fills the detail line, so the axis reads without stacking rotated text over
  // the values.
  const labelEvery = slot >= 44
  const showBarLabel = (i: number) =>
    labelEvery || (data.length - 1 - i) % 2 === 0

  // Default the detail to the latest column that actually carries a value — the
  // newest reported quarter normally, but the forecast when only a forward
  // figure exists (e.g. a revenue estimate with no reported revenue history), so
  // the line is never a row of em dashes.
  const lastReported = (() => {
    for (let i = data.length - 1; i >= 0; i--) {
      if (data[i].actual != null || data[i].estimate != null) return i
    }
    return -1
  })()
  const active =
    hover ??
    (lastReported >= 0
      ? lastReported
      : hasForecast
        ? fcIndex
        : Math.max(0, data.length - 1))

  // Which column sits under the pointer, in viewBox space — or null before the
  // SVG is laid out (jsdom / pre-measure), where we leave the selection alone.
  function columnAt(e: PointerEvent<SVGSVGElement>): number | null {
    const rect = e.currentTarget.getBoundingClientRect()
    if (!rect.width) return null
    const vbX = ((e.clientX - rect.left) / rect.width) * W
    const i = Math.floor((vbX - pad.left) / slot)
    return Math.max(0, Math.min(n - 1, i))
  }

  // Select the column under the pointer. Bound to pointerdown as well as
  // pointermove so a touch tap selects (touch has no hover), while a mouse
  // hover or drag scrubs across columns.
  function onPoint(e: PointerEvent<SVGSVGElement>) {
    const i = columnAt(e)
    if (i != null) setHover(i)
  }

  // Only a mouse leaving clears the highlight; on touch there's no pointer to
  // "leave", so a tapped column stays selected after the finger lifts.
  function onLeave(e: PointerEvent<SVGSVGElement>) {
    if (e.pointerType === 'mouse') setHover(null)
  }

  // One inline label/value cell for the detail line above the plot.
  const cell = (label: string, value: string, color?: string) => (
    <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
      <Box component="span" sx={{ color: axis }}>
        {label}
      </Box>{' '}
      <Box
        component="span"
        sx={{
          color: color ?? 'text.primary',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </Box>
    </Box>
  )

  // The detail line for the active column — estimate vs. actual (+ surprise); the
  // forecast column shows the consensus going in.
  const detail =
    active < data.length
      ? (() => {
          const b = data[active]
          const c = b.beat == null ? neutral : b.beat ? up : down
          const isGap = b.estimate == null && b.actual == null
          return (
            <>
              <Box component="span" sx={{ color: axis, mr: 0.5 }}>
                {b.label}
              </Box>
              {isGap ? (
                <Box component="span" sx={{ color: axis }}>
                  No data reported
                </Box>
              ) : (
                <>
                  {b.estimate != null && cell('Est', fmt(b.estimate))}
                  {cell('Act', orDash(b.actual, fmt), c)}
                  {b.surprise != null && cell('', fmtPct(b.surprise), c)}
                </>
              )}
            </>
          )
        })()
      : (() => {
          const f = viewForecasts[active - data.length]
          if (!f) return null
          return (
            <>
              <Box component="span" sx={{ color: forecast, mr: 0.5 }}>
                {f.label}
              </Box>
              {cell('Est', orDash(f.estimate, fmt), forecast)}
              {f.growth != null &&
                cell(growthLabel, fmtPct(f.growth), f.growth >= 0 ? up : down)}
            </>
          )
        })()

  return (
    <Box ref={wrapRef}>
      <Stack
        direction="row"
        useFlexGap
        sx={{
          flexWrap: 'wrap',
          alignItems: 'baseline',
          columnGap: 1.5,
          rowGap: 0.5,
          fontSize: '0.8rem',
          fontWeight: 500,
          mb: 1.5,
          px: 1.5,
          py: 1,
          borderRadius: 1.5,
          bgcolor: 'action.hover',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        {detail}
      </Stack>

      <Box
        component="svg"
        viewBox={`0 0 ${W} ${vbH}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={ariaLabel}
        onPointerDown={onPoint}
        onPointerMove={onPoint}
        onPointerLeave={onLeave}
        sx={{
          width: '100%',
          height: 'auto',
          display: 'block',
          // Let the page scroll vertically through the chart on touch, while
          // horizontal drags scrub and a tap selects a column.
          touchAction: 'pan-y',
          cursor: 'crosshair',
        }}
      >
        {/* hovered-column highlight band */}
        {hover != null && (
          <rect
            x={pad.left + slot * hover}
            y={pad.top}
            width={slot}
            height={H - pad.top - pad.bottom}
            fill={axis}
            opacity={0.08}
            pointerEvents="none"
          />
        )}
        {/* gridlines + value axis labels (right) */}
        {ticks.map((t, i) => (
          <g key={`t${i}`}>
            <line
              x1={pad.left}
              x2={W - pad.right}
              y1={y(t)}
              y2={y(t)}
              stroke={grid}
              strokeWidth={1}
            />
            <text
              x={W - pad.right + 6}
              y={y(t) + 3.5}
              fontSize={11}
              fill={axis}
            >
              {fmt(t)}
            </text>
          </g>
        ))}
        {/* zero baseline, drawn a touch stronger than the gridlines */}
        <line
          x1={pad.left}
          x2={W - pad.right}
          y1={zeroY}
          y2={zeroY}
          stroke={axis}
          strokeWidth={1}
          opacity={0.5}
        />

        {/* dashed divider between reported history and the forward estimate */}
        {hasForecast && data.length > 0 && (
          <line
            x1={pad.left + slot * fcIndex}
            x2={pad.left + slot * fcIndex}
            y1={pad.top}
            y2={H - pad.bottom}
            stroke={axis}
            strokeWidth={1}
            strokeDasharray="2 3"
            opacity={0.4}
          />
        )}

        {data.map((b, i) => {
          const center = cx(i)
          const estX = center - groupW / 2
          // With no estimate bar (revenue), centre the lone actual in the slot.
          const actX =
            b.estimate == null ? center - barW / 2 : estX + barW + gap
          const actColor = b.beat == null ? neutral : b.beat ? up : down
          // Nothing reported this quarter (no estimate and no actual) — draw a
          // labelled "no data" slot so the gap reads as missing, not as zero.
          const isGap = b.estimate == null && b.actual == null

          const bar = (x: number, v: number | null, fill: string) => {
            if (v == null) return null
            const top = Math.min(y(v), zeroY)
            const h = Math.max(1, Math.abs(y(v) - zeroY))
            return (
              <rect x={x} y={top} width={barW} height={h} rx={2} fill={fill} />
            )
          }

          // Surprise % rides in the top margin, aligned across all groups. It
          // shortens with the value labels (slot < 50), and drops out entirely
          // once the slots are too tight to read it (slot < 34) — it stays a
          // tap away in the detail line above the plot.
          const surprise =
            b.surprise == null || slot < 34 ? null : (
              <text
                x={center}
                y={18}
                fontSize={11}
                fontWeight={600}
                fill={actColor}
                textAnchor="middle"
              >
                {growthFmt(b.surprise)}
              </text>
            )

          return (
            <g key={b.key}>
              {surprise}
              {bar(estX, b.estimate, est)}
              {bar(actX, b.actual, actColor)}
              {/* "no data" mark, centred in the plot for a gap column */}
              {isGap && (
                <text
                  x={center}
                  y={pad.top + (H - pad.top - pad.bottom) / 2}
                  fontSize={15}
                  fill={axis}
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  —
                </text>
              )}
              {/* quarter label + the reported value (or "no data") beneath it.
                  The label thins out on a tight axis (showBarLabel); the value
                  stays under every bar. */}
              {showBarLabel(i) && (
                <text
                  x={center}
                  y={H - 26}
                  fontSize={11}
                  fill={axis}
                  textAnchor="middle"
                >
                  {b.label}
                </text>
              )}
              <text
                x={center}
                y={H - 12}
                fontSize={isGap ? 9 : 11}
                fontWeight={isGap ? 400 : 600}
                fill={isGap ? axis : actColor}
                textAnchor="middle"
              >
                {isGap ? 'no data' : b.actual != null ? barFmt(b.actual) : ''}
              </text>
            </g>
          )
        })}

        {/* forward "expected" columns: analyst consensus for upcoming quarters */}
        {viewForecasts.map((f, k) => {
          const e = f.estimate
          if (e == null) return null
          const center = cx(fcIndex + k)
          const top = Math.min(y(e), zeroY)
          const h = Math.max(1, Math.abs(y(e) - zeroY))
          return (
            <g key={f.key}>
              {/* forecast bar: faint accent fill + dashed outline */}
              <rect
                x={center - barW / 2}
                y={top}
                width={barW}
                height={h}
                rx={2}
                fill={forecast}
                fillOpacity={0.18}
                stroke={forecast}
                strokeWidth={1.25}
                strokeDasharray="3 2"
              />
              {/* fiscal label + the consensus target beneath it, mirroring the
                  reported columns (value under the quarter) */}
              <text
                x={center}
                y={H - 26}
                fontSize={11}
                fill={forecast}
                textAnchor="middle"
              >
                {f.label}
              </text>
              <text
                x={center}
                y={H - 12}
                fontSize={11}
                fontWeight={600}
                fill={forecast}
                textAnchor="middle"
              >
                {barFmt(e)}
              </text>
              {/* the YoY growth the consensus implies vs. a year earlier */}
              {f.growth != null && (
                <text
                  x={center}
                  y={H + 2}
                  fontSize={10}
                  fontWeight={500}
                  fill={f.growth >= 0 ? up : down}
                  textAnchor="middle"
                >
                  {growthFmt(f.growth)}
                </text>
              )}
            </g>
          )
        })}
      </Box>
    </Box>
  )
}

/** A legend swatch with its label, used beneath the chart. `color` is either a
 *  theme palette path (e.g. "success.main") or a theme-aware resolver. */
function LegendItem({
  color,
  label,
}: {
  color: string | ((theme: Theme) => string)
  label: string
}) {
  return (
    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
      <Box sx={{ width: 12, height: 12, borderRadius: 0.5, bgcolor: color }} />
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Stack>
  )
}

/** Small uppercase heading that names each chart when both EPS and revenue show. */
const chartLabelSx: SxProps<Theme> = {
  display: 'block',
  color: 'text.secondary',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  fontWeight: 600,
  mb: 0.5,
}

/**
 * The trailing year-over-year growth summary shown above the annual charts: the
 * top and bottom line's most recent trailing growth, framing the fiscal-year
 * history below. Green when a line grew over the trailing year, red when it
 * shrank, an em dash when a side isn't served. This is the *reported* trailing
 * read — distinct from the forward, consensus-implied growth the upcoming
 * columns annotate.
 */
function TrailingGrowth({
  revenueGrowth,
  epsGrowth,
}: {
  revenueGrowth: number | null
  epsGrowth: number | null
}) {
  const figure = (label: string, value: number | null) => {
    const color =
      value == null
        ? 'text.secondary'
        : value >= 0
          ? 'success.main'
          : 'error.main'
    return (
      <Box sx={{ px: 1.5, py: 1, borderRadius: 1.5, bgcolor: 'action.hover' }}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            display: 'block',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            fontSize: '0.65rem',
          }}
        >
          {label}
        </Typography>
        <Typography
          sx={{
            mt: 0.25,
            fontWeight: 700,
            color,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value == null ? '—' : fmtPct(value)}
        </Typography>
      </Box>
    )
  }
  return (
    <Box sx={{ mt: 2 }}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{
          display: 'block',
          mb: 1,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          fontSize: '0.65rem',
        }}
      >
        Trailing growth · YoY
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 160px))',
          gap: 1,
        }}
      >
        {figure('Revenue', revenueGrowth)}
        {figure('EPS', epsGrowth)}
      </Box>
    </Box>
  )
}

/** The plain-language read for each consistency call: a short verdict word and
 *  the colour it's shown in — dependable green, hit-or-miss amber, shaky red. */
const CONSISTENCY: Record<BeatConsistency, { label: string; color: string }> = {
  reliable: { label: 'Beats consistently', color: 'success.main' },
  mixed: { label: 'Hit or miss', color: '#fbbf24' }, // amber, matching sibling cards
  shaky: { label: 'Often falls short', color: 'error.main' },
}

/**
 * A plain-language verdict that opens the card, so the "how are they doing?"
 * read lands before the charts: how the latest quarter came in (beat, missed,
 * or simply reported — with the figures spelled out in a sentence) and the
 * recent track record as a beat/miss dot strip beside the share of quarters
 * that cleared consensus. Rides the `beats`/`scored`/`beat_rate` summary the
 * API already computes plus the newest reported quarter — always the quarterly
 * beat history, independent of the Quarterly/Annual chart toggle.
 */
function EarningsSummary({ earnings }: { earnings: EarningsHistory }) {
  const theme = useTheme()
  const up = theme.palette.success.main
  const down = theme.palette.error.main
  const { quarters, beats, scored, beat_rate } = earnings

  // The headline quarter: the newest one scored against a consensus (both an
  // actual and an estimate), falling back to the newest with any reported figure
  // so a just-reported quarter still leads before its estimate is matched up.
  const scoredQ = quarters.find((q) => q.actual != null && q.estimate != null)
  const reported = scoredQ ?? quarters.find((q) => q.actual != null) ?? null
  if (!reported) return null

  const beat = scoredQ?.beat ?? null
  // Two-word verdict so the badge never collides with the single-word "Beat" /
  // "Missed" chart-legend labels (which the annual view drops).
  const verdict =
    beat == null ? 'Reported' : beat ? 'Beat estimates' : 'Missed estimates'
  const verdictColor =
    beat == null ? theme.palette.text.secondary : beat ? up : down
  const surprise = scoredQ?.surprise_percent ?? null

  // "a 4.3% beat" / "a 2.5% miss" — magnitude plus the direction word, so the
  // sign lives in the word and the colour rather than a stray minus.
  const swing =
    beat != null && surprise != null
      ? `a ${Math.abs(surprise).toFixed(1)}% ${beat ? 'beat' : 'miss'}`
      : null

  // Recent quarters as beat/miss/unscored dots, oldest → newest to match the
  // charts below.
  const dots = [...quarters].reverse()
  const tone = beatConsistency(beat_rate)

  return (
    <Box
      sx={{
        mt: 2.5,
        p: 2,
        borderRadius: 1.5,
        bgcolor: 'action.hover',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      {/* Latest quarter — the plain-language headline */}
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
        <Box
          component="span"
          sx={{
            px: 1,
            py: 0.25,
            borderRadius: 1,
            fontSize: '0.7rem',
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            // Keep the two-word verdict on one line beside the caption instead
            // of wrapping inside its pill on a narrow header.
            whiteSpace: 'nowrap',
            flexShrink: 0,
            color: verdictColor,
            bgcolor: alpha(verdictColor, 0.15),
          }}
        >
          {verdict}
        </Box>
        <Typography variant="caption" color="text.secondary">
          Latest quarter · {quarterLabel(reported)}
        </Typography>
      </Stack>

      <Typography sx={{ fontSize: '0.95rem', lineHeight: 1.5 }}>
        Reported{' '}
        <Box component="span" sx={{ fontWeight: 700 }}>
          {fmtEps(reported.actual as number)}
        </Box>{' '}
        per share
        {scoredQ?.estimate != null && (
          <> vs. the {fmtEps(scoredQ.estimate)} expected</>
        )}
        {swing && (
          <>
            {' — '}
            <Box component="span" sx={{ fontWeight: 700, color: verdictColor }}>
              {swing}
            </Box>
          </>
        )}
        .
      </Typography>

      {/* Track record — a beat/miss dot strip beside the beat share */}
      {scored > 0 && beat_rate != null && (
        <Stack
          direction="row"
          useFlexGap
          sx={{
            flexWrap: 'wrap',
            alignItems: 'center',
            columnGap: 1.5,
            rowGap: 0.75,
            mt: 1.5,
            pt: 1.5,
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
            {dots.map((q, i) => (
              <Box
                key={q.period ?? i}
                component="span"
                title={`${quarterLabel(q)} — ${
                  q.beat == null ? 'no estimate' : q.beat ? 'Beat' : 'Missed'
                }`}
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  bgcolor:
                    q.beat == null ? theme.palette.divider : q.beat ? up : down,
                }}
              />
            ))}
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Beat estimates in{' '}
            <Box
              component="span"
              sx={{ fontWeight: 700, color: 'text.primary' }}
            >
              {beats} of {scored}
            </Box>{' '}
            recent quarters
          </Typography>
          {tone && (
            <Box
              component="span"
              sx={{
                fontSize: '0.8rem',
                fontWeight: 700,
                color: CONSISTENCY[tone].color,
              }}
            >
              {CONSISTENCY[tone].label}
            </Box>
          )}
        </Stack>
      )}
    </Box>
  )
}

export default function EarningsCard({
  earnings,
  upcoming = null,
  annual = null,
  revenueGrowth = null,
  epsGrowth = null,
  price = null,
  quarterly = null,
  trailingPe = null,
}: {
  earnings: EarningsHistory
  // The upcoming (scheduled, not-yet-reported) quarters the charts draw forward
  // "expected" columns for — one per quarter, oldest → newest. Defaults to the
  // single `earnings.next_report` when not supplied, so callers that only have
  // the beat history keep their one forecast column.
  upcoming?: NextEarnings[] | null
  // The annual earnings series. When present, a Quarterly/Annual toggle lets the
  // whole card switch to fiscal years — the EPS & revenue charts (reported years
  // as bars, upcoming ones as forecast columns) and the forward-P/E walk below.
  annual?: AnnualEarnings | null
  // Trailing year-over-year growth (percent) for the top and bottom line, from
  // the ticker card's metrics block. Surfaced as a summary strip on the Annual
  // view only — a trailing YoY read belongs beside the fiscal-year history, and
  // would double up with the QoQ story the quarterly view already tells.
  revenueGrowth?: number | null
  epsGrowth?: number | null
  // Today's price, from the ticker card — feeds the forward-P/E valuation
  // section below the charts (every multiple divides it). The section self-hides
  // when price/quarterly aren't supplied, so callers with only the beat history
  // still get the charts alone.
  price?: number | null
  // The raw consolidated quarterly series, feeding the forward-P/E walk's
  // trailing-TTM anchor and rolling quarter steps (distinct from the `earnings`
  // view-model the charts read).
  quarterly?: QuarterlyEarnings | null
  // The ticker card's trailing P/E multiple (metrics.pe) — the "Current P/E"
  // tile the forward-P/E walk threads between its reported anchor and the
  // forward steps.
  trailingPe?: number | null
}) {
  const theme = useTheme()
  const { quarters } = earnings
  // The scheduled next report, if any — the header chip shows its date alone.
  const nextRpt = earnings.next_report

  // The annual series, adapted to the same shapes the quarterly charts consume.
  // The period toggle only appears when there's annual data to switch to.
  const annualQuarters = annual ? annualReported(annual) : []
  const annualForecasts = annual ? annualUpcoming(annual) : []
  const hasAnnual = annualQuarters.length > 0 || annualForecasts.length > 0
  const [period, setPeriod] = useState<'quarterly' | 'annual'>('quarterly')
  const isAnnual = hasAnnual && period === 'annual'
  const activePeriod: 'quarterly' | 'annual' = isAnnual ? 'annual' : 'quarterly'
  // The trailing YoY growth summary rides the annual view only, and only when
  // at least one line's growth is served.
  const showTrailingGrowth =
    isAnnual && (revenueGrowth != null || epsGrowth != null)

  // The reported history the bars draw — quarters or fiscal years, per the
  // toggle — and the forward consensus columns beside it: every upcoming
  // quarter the page passes (else the single scheduled next report), or the
  // upcoming fiscal years in the annual view.
  const activeQuarters = isAnnual ? annualQuarters : quarters
  const forecastList = isAnnual
    ? annualForecasts
    : upcoming && upcoming.length > 0
      ? upcoming
      : earnings.next_report
        ? [earnings.next_report]
        : []
  const epsBars = epsSeries(activeQuarters)
  const epsForecasts = forecastSeries(
    forecastList,
    (f) => f.eps_estimate,
    activeQuarters,
    (q) => q.actual,
  )
  const revForecasts = forecastSeries(
    forecastList,
    (f) => f.revenue_estimate,
    activeQuarters,
    (q) => q.revenue_actual ?? null,
  )
  const revBars = revenueSeries(activeQuarters)

  // Show the reported-revenue columns (gaps included — see revenueSeries) only
  // when at least one quarter actually reported revenue. With no history at all
  // there are no gaps worth surfacing, just the forward estimate, so don't draw
  // a chart that's all "no data" slots.
  const hasRevenueHistory = revBars.some((b) => b.actual != null)
  const revChartBars = hasRevenueHistory ? revBars : []

  // Only draw the revenue chart when there's something to show — reported
  // figures or a forward consensus. Many tickers don't carry revenue at all.
  const hasRevenue = hasRevenueHistory || revForecasts.length > 0
  const hasUpcoming = epsForecasts.length > 0 || revForecasts.length > 0
  // Whether any forecast column carries a YoY growth figure — gates the
  // one-line explainer of the growth row beneath the legend.
  const hasGrowth = [...epsForecasts, ...revForecasts].some(
    (f) => f.growth != null,
  )

  return (
    <Card
      variant="outlined"
      sx={{
        position: 'relative',
        overflow: 'hidden',
        borderColor: 'divider',
        // The home-page blue→gold wash, so the earnings tab reads as a hero.
        backgroundImage: (theme) => heroWash(theme),
      }}
    >
      <CardContent sx={{ p: { xs: 1.5, sm: 2, md: 3 } }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}
        >
          <Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <BarChartIcon fontSize="small" sx={{ color: 'primary.main' }} />
              <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
                Earnings
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {isAnnual
                ? hasRevenue
                  ? 'Annual EPS & revenue by fiscal year'
                  : 'Annual EPS by fiscal year'
                : hasRevenue
                  ? 'Quarterly EPS & revenue'
                  : 'Quarterly EPS — actual vs. estimate'}
            </Typography>
          </Box>

          {nextRpt?.report_date && (
            <Box
              sx={{
                flexShrink: 0,
                // Hugs the right on desktop; on the stacked phone header it sits
                // below the title, so left-align it there instead of stranding
                // the date at the far edge.
                textAlign: { xs: 'left', sm: 'right' },
                borderRadius: 2,
                px: 2,
                py: 1.25,
                // A gold-tinted "next report" chip — the brand's second accent,
                // set off from the blue-led heading beside it.
                bgcolor: (theme) => alpha(theme.palette.secondary.main, 0.12),
                border: '1px solid',
                borderColor: (theme) =>
                  alpha(theme.palette.secondary.main, 0.35),
              }}
            >
              <Stack
                direction="row"
                spacing={0.5}
                sx={{
                  alignItems: 'center',
                  justifyContent: { xs: 'flex-start', sm: 'flex-end' },
                }}
              >
                <CalendarMonthIcon
                  sx={{ fontSize: 14, color: 'secondary.main' }}
                />
                <Typography
                  variant="caption"
                  sx={{
                    color: 'secondary.main',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                  }}
                >
                  Next report
                </Typography>
              </Stack>
              <Typography
                sx={{
                  fontWeight: 700,
                  fontSize: '1.35rem',
                  lineHeight: 1.3,
                  mt: 0.25,
                }}
              >
                {fmtReportDate(nextRpt.report_date)}
              </Typography>
              {nextRpt.session && SESSION_LABEL[nextRpt.session] && (
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.secondary',
                    display: 'block',
                    textTransform: 'capitalize',
                  }}
                >
                  {SESSION_LABEL[nextRpt.session]}
                </Typography>
              )}
            </Box>
          )}
        </Stack>

        <EarningsSummary earnings={earnings} />

        {/* ── Reported history: the EPS & revenue charts. The divider + label
            set this zone off from the latest-quarter summary above; the period
            toggle rides in the header and governs the time-based views below it
            (the charts and the forward-P/E walk). ── */}
        <Stack
          direction="row"
          spacing={2}
          sx={{
            mt: 3,
            pt: 3,
            borderTop: '1px solid',
            borderColor: 'divider',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            rowGap: 1,
          }}
        >
          <Typography
            variant="subtitle2"
            component="h3"
            sx={{ fontWeight: 700, letterSpacing: '0.01em' }}
          >
            Reported history
          </Typography>
          {hasAnnual && (
            <ToggleButtonGroup
              size="small"
              exclusive
              value={period}
              onChange={(_, value: 'quarterly' | 'annual' | null) =>
                value && setPeriod(value)
              }
              aria-label="Earnings period"
              // A pill-style segmented control: one rounded track with the
              // active segment lifted onto a raised paper chip. The one switch
              // governs the time-based views below — the charts and the
              // forward-P/E walk.
              sx={{
                p: 0.5,
                gap: 0.5,
                borderRadius: 999,
                bgcolor: 'action.hover',
                border: '1px solid',
                borderColor: 'divider',
                '& .MuiToggleButtonGroup-grouped': {
                  border: 0,
                  borderRadius: '999px !important',
                  px: 2,
                  py: 0.5,
                  // Guarantee a ~40px tap target on touch (the small pill is
                  // shorter than that by default).
                  minHeight: { xs: 40, sm: 'auto' },
                  textTransform: 'none',
                  fontWeight: 600,
                  letterSpacing: 0,
                  color: 'text.secondary',
                  '&:hover': { bgcolor: 'action.selected' },
                  '&.Mui-selected': {
                    color: 'text.primary',
                    bgcolor: 'background.paper',
                    boxShadow: 1,
                    '&:hover': { bgcolor: 'background.paper' },
                  },
                },
              }}
            >
              <ToggleButton value="quarterly">Quarterly</ToggleButton>
              <ToggleButton value="annual">Annual</ToggleButton>
            </ToggleButtonGroup>
          )}
        </Stack>

        {activeQuarters.length === 0 ? (
          <Typography color="text.secondary" sx={{ mt: 2 }}>
            No earnings history available for this stock.
          </Typography>
        ) : (
          <>
            {showTrailingGrowth && (
              <TrailingGrowth
                revenueGrowth={revenueGrowth}
                epsGrowth={epsGrowth}
              />
            )}
            <Box sx={{ mt: 2.5 }}>
              {hasRevenue && (
                <Typography variant="caption" sx={chartLabelSx}>
                  {/* The annual EPS the API reports is the plain (GAAP) fiscal-
                      year figure, not the adjusted consensus basis the quarterly
                      bars are on — so the annual chart drops the qualifier. */}
                  {isAnnual ? 'EPS' : 'EPS (adjusted)'}
                </Typography>
              )}
              <SurpriseChart
                bars={epsBars}
                forecasts={epsForecasts}
                growthLabel={isAnnual ? 'YoY' : 'QoQ'}
                // Reported fiscal years carry no consensus, so their bars have
                // no beat colour — paint them the same green the quarterly
                // actuals wear, not the washed-out axis grey.
                neutralColor={isAnnual ? theme.palette.success.main : undefined}
                fmt={fmtEps}
                ariaLabel={
                  isAnnual
                    ? 'Annual earnings per share by fiscal year'
                    : 'Quarterly actual versus estimated earnings per share'
                }
              />
            </Box>
            {hasRevenue && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="caption" sx={chartLabelSx}>
                  Revenue
                </Typography>
                <SurpriseChart
                  bars={revChartBars}
                  forecasts={revForecasts}
                  growthLabel={isAnnual ? 'YoY' : 'QoQ'}
                  fmt={fmtRev}
                  fmtShort={fmtRevShort}
                  neutralColor={theme.palette.secondary.main}
                  ariaLabel={
                    isAnnual
                      ? 'Annual reported revenue by fiscal year'
                      : 'Quarterly reported revenue'
                  }
                />
              </Box>
            )}
            <Stack
              direction="row"
              spacing={2}
              useFlexGap
              sx={{ flexWrap: 'wrap', mt: 1.5 }}
            >
              {isAnnual ? (
                // Annual reported years have no estimate bars or beat/miss
                // reading — just the EPS series itself.
                <LegendItem color="success.main" label="EPS" />
              ) : (
                <>
                  <LegendItem color={estimateColor} label="EPS estimate" />
                  <LegendItem color="success.main" label="Beat" />
                  <LegendItem color="error.main" label="Missed" />
                </>
              )}
              {hasRevenue && (
                <LegendItem color="secondary.main" label="Revenue" />
              )}
              {hasUpcoming && (
                <LegendItem color="primary.main" label="Upcoming (est.)" />
              )}
            </Stack>
            {hasGrowth && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mt: 1 }}
              >
                The % beneath an upcoming column is the growth its consensus
                implies vs.{' '}
                {isAnnual
                  ? 'the prior fiscal year (YoY)'
                  : 'the quarter right before it (QoQ)'}
                .
              </Typography>
            )}
          </>
        )}

        {/* Forward-P/E valuation walk — the same period toggle governs it, so
            the quarterly view carries the rolling by-quarter walk and the
            annual view the by-fiscal-year one. The section owns its own top
            divider and self-hides (renders null) when the active period has no
            forward consensus to walk. */}
        {price != null && (
          <ForwardPeSection
            price={price}
            quarterly={quarterly}
            annual={annual}
            trailingPe={trailingPe}
            period={activePeriod}
          />
        )}
      </CardContent>
    </Card>
  )
}
