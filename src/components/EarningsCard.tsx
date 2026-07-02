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
import type { SxProps, Theme } from '@mui/material/styles'
import { annualReported, annualUpcoming, gradeValuation } from '@/lib/api'
import type {
  AnnualEarnings,
  EarningsHistory,
  EarningsMetrics,
  EarningsSurprise,
  KeyMetrics,
  NextEarnings,
  ValuationGrade,
  ValuationRatio,
} from '@/lib/api'

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
const fmtPlainPct = (n: number) => `${n.toFixed(1)}%`
/** A valuation multiple or ratio (P/E, PEG, current ratio, D/E) —
 *  two decimals, no unit. */
const fmtMultiple = (n: number) => n.toFixed(2)

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

  const hasForecast = forecasts.length > 0

  // Whether any forecast column carries a YoY growth figure (reported columns
  // never do — their bar heights already show the growth). The growth row
  // rides in 14 extra viewBox units beneath the value labels, so charts with
  // nothing to show keep their original height instead of a blank strip.
  const growthRow = forecasts.some((f) => f.growth != null)
  const vbH = growthRow ? H + 14 : H

  // API is newest-first; a time axis reads oldest → newest, left → right. The
  // forecasts sit at the far right, after the last reported quarter.
  const data = useMemo(() => [...bars].reverse(), [bars])

  const geo = useMemo(() => {
    const plotW = W - PAD.left - PAD.right
    const plotH = H - PAD.top - PAD.bottom

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
    for (const f of forecasts) {
      if (f.estimate == null) continue
      if (f.estimate > max) max = f.estimate
      if (f.estimate < min) min = f.estimate
    }
    if (max === min) max = 1 // all-zero / empty guard
    const padV = (max - min) * 0.15 || 1
    max += padV
    if (min < 0) min -= padV // only drop the floor when there are losses

    const n = data.length + forecasts.length
    const slot = plotW / Math.max(n, 1)
    const groupW = Math.min(slot * 0.62, 72)
    const gap = Math.min(groupW * 0.12, 4)
    // EPS pairs an estimate + actual bar in each group; a single-series metric
    // (revenue: actual only) gives its lone bar the whole group width so the
    // slot isn't left half-empty with a thin, lost-looking bar.
    const grouped = data.some((b) => b.estimate != null)
    const barW = grouped ? (groupW - gap) / 2 : groupW

    const cx = (i: number) => PAD.left + slot * (i + 0.5)
    const y = (v: number) =>
      PAD.top + (1 - (v - min) / (max - min || 1)) * plotH

    const tickN = 4
    const ticks = Array.from(
      { length: tickN + 1 },
      (_, i) => min + ((max - min) * i) / tickN,
    )

    return { cx, y, groupW, gap, barW, ticks, zeroY: y(0), slot, n }
  }, [data, forecasts, W])

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
    const i = Math.floor((vbX - PAD.left) / slot)
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
          const f = forecasts[active - data.length]
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
            x={PAD.left + slot * hover}
            y={PAD.top}
            width={slot}
            height={H - PAD.top - PAD.bottom}
            fill={axis}
            opacity={0.08}
            pointerEvents="none"
          />
        )}
        {/* gridlines + value axis labels (right) */}
        {ticks.map((t, i) => (
          <g key={`t${i}`}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(t)}
              y2={y(t)}
              stroke={grid}
              strokeWidth={1}
            />
            <text
              x={W - PAD.right + 6}
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
          x1={PAD.left}
          x2={W - PAD.right}
          y1={zeroY}
          y2={zeroY}
          stroke={axis}
          strokeWidth={1}
          opacity={0.5}
        />

        {/* dashed divider between reported history and the forward estimate */}
        {hasForecast && data.length > 0 && (
          <line
            x1={PAD.left + slot * fcIndex}
            x2={PAD.left + slot * fcIndex}
            y1={PAD.top}
            y2={H - PAD.bottom}
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

          // Surprise % rides in the top margin, aligned across all groups.
          const surprise =
            b.surprise == null ? null : (
              <text
                x={center}
                y={18}
                fontSize={11}
                fontWeight={600}
                fill={actColor}
                textAnchor="middle"
              >
                {fmtPct(b.surprise)}
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
                  y={PAD.top + (H - PAD.top - PAD.bottom) / 2}
                  fontSize={15}
                  fill={axis}
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  —
                </text>
              )}
              {/* quarter label + the reported value (or "no data") beneath it */}
              <text
                x={center}
                y={H - 26}
                fontSize={11}
                fill={axis}
                textAnchor="middle"
              >
                {b.label}
              </text>
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
        {forecasts.map((f, k) => {
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

/** One label/value tile in a metrics grid: a soft card with an uppercase label
 *  above a bold, tabular-aligned value. An optional `hint` adds a one-line
 *  plain-language explainer beneath the value (used by the valuation grid).
 *  Shared by the trailing-metrics and valuation grids so the two read
 *  identically. */
function StatTile({
  label,
  value,
  color = 'text.primary',
  hint,
}: {
  label: string
  value: string
  color?: string
  hint?: string
}) {
  return (
    <Box
      sx={{
        px: 1.5,
        py: 1.25,
        borderRadius: 1.5,
        bgcolor: 'action.hover',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{
          display: 'block',
          textTransform: 'uppercase',
          letterSpacing: '0.03em',
          fontSize: '0.65rem',
        }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          mt: 0.25,
          fontWeight: 700,
          fontSize: '1.05rem',
          fontVariantNumeric: 'tabular-nums',
          color,
          lineHeight: 1.25,
        }}
      >
        {value}
      </Typography>
      {hint && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            display: 'block',
            mt: 0.5,
            fontSize: '0.68rem',
            lineHeight: 1.35,
          }}
        >
          {hint}
        </Typography>
      )}
    </Box>
  )
}

/** A grid of trailing metrics beside the beat history: the GAAP margin stack,
 *  from the vendor. The basis is spelled out below the grid since the
 *  per-quarter bars above are on the adjusted (consensus) basis. Uncovered
 *  values show an em dash. */
function MetricTiles({ metrics }: { metrics: EarningsMetrics }) {
  const tiles: { label: string; text: string; color: string }[] = [
    {
      label: 'Gross Margin',
      text:
        metrics.gross_margin == null ? '—' : fmtPlainPct(metrics.gross_margin),
      color: 'text.primary',
    },
    {
      label: 'Op. Margin',
      text:
        metrics.operating_margin == null
          ? '—'
          : fmtPlainPct(metrics.operating_margin),
      color: 'text.primary',
    },
    {
      label: 'Net Margin',
      text: metrics.net_margin == null ? '—' : fmtPlainPct(metrics.net_margin),
      color: 'text.primary',
    },
  ]
  return (
    <Box
      sx={{ mt: 2.5, pt: 2.5, borderTop: '1px solid', borderColor: 'divider' }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}
      >
        Trailing metrics
      </Typography>
      <Box
        sx={{
          mt: 1.5,
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' },
          rowGap: 2,
          columnGap: 2,
        }}
      >
        {tiles.map((t) => (
          <StatTile
            key={t.label}
            label={t.label}
            value={t.text}
            color={t.color}
          />
        ))}
      </Box>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', mt: 1.5 }}
      >
        Margins are GAAP.
      </Typography>
    </Box>
  )
}

/** Maps a ratio's grade to its tile colour: green for a favourable reading, red
 *  for one worth a closer look, and the default text colour for the unremarkable
 *  middle — so only the notable extremes draw the eye. */
const GRADE_COLOR: Record<ValuationGrade, string> = {
  good: 'success.main',
  fair: 'text.primary',
  caution: 'error.main',
}

/** A grid of point-in-time valuation and health ratios (P/E, PEG, current
 *  ratio, debt/equity) — a subset of the KeyMetrics the stock snapshot
 *  carries, surfaced beside the trailing earnings so the "is it priced well?"
 *  read sits next to "how's it growing?". Each tile carries a one-line
 *  plain-language explainer of what it shows, and its value is tinted green/red
 *  by a coarse rule of thumb (see {@link gradeValuation}) so a favourable or
 *  stretched reading stands out at a glance. All trailing; uncovered values show
 *  an em dash (in the default colour), and an all-empty block is dropped rather
 *  than rendered as a wall of dashes. (P/B and the 52-week range are part of
 *  KeyMetrics but aren't surfaced here.) */
function ValuationTiles({ valuation }: { valuation: KeyMetrics }) {
  const tiles: {
    label: string
    ratio: ValuationRatio
    value: number | null
    hint: string
  }[] = [
    // The plain P/E isn't tiled here — it anchors the ForwardPeCard, which
    // walks it against the forward multiples.
    {
      label: 'PEG',
      ratio: 'peg',
      value: valuation.peg,
      hint: 'P/E adjusted for growth; under 1 looks cheap',
    },
    {
      label: 'Current Ratio',
      ratio: 'current_ratio',
      value: valuation.current_ratio,
      hint: 'Short-term assets vs. bills due; above 1 is healthy',
    },
    {
      label: 'Debt / Equity',
      ratio: 'debt_to_equity',
      value: valuation.debt_to_equity,
      hint: 'Debt vs. shareholder money; lower is safer',
    },
  ]
  // Nothing covered → drop the section rather than show a grid of em dashes.
  if (tiles.every((t) => t.value == null)) return null
  return (
    <Box
      sx={{ mt: 2.5, pt: 2.5, borderTop: '1px solid', borderColor: 'divider' }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}
      >
        Valuation
      </Typography>
      <Box
        sx={{
          mt: 1.5,
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' },
          rowGap: 2,
          columnGap: 2,
        }}
      >
        {tiles.map((t) => (
          <StatTile
            key={t.label}
            label={t.label}
            value={orDash(t.value, fmtMultiple)}
            color={
              t.value == null
                ? 'text.primary'
                : GRADE_COLOR[gradeValuation(t.ratio, t.value)]
            }
            hint={t.hint}
          />
        ))}
      </Box>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', mt: 1.5 }}
      >
        Green is favourable, red worth a closer look — a rough guide that varies
        by sector. Trailing ratios (no forward estimates); PEG is P/E over
        trailing EPS growth.
      </Typography>
    </Box>
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

export default function EarningsCard({
  earnings,
  upcoming = null,
  annual = null,
}: {
  earnings: EarningsHistory
  // The upcoming (scheduled, not-yet-reported) quarters the charts draw forward
  // "expected" columns for — one per quarter, oldest → newest. Defaults to the
  // single `earnings.next_report` when not supplied, so callers that only have
  // the beat history keep their one forecast column.
  upcoming?: NextEarnings[] | null
  // The annual earnings series. When present, a Quarterly/Annual toggle lets the
  // EPS & revenue charts switch to fiscal years — reported years as bars,
  // upcoming (estimated) years as forecast columns. The trailing/valuation
  // tiles are period-independent and stay put.
  annual?: AnnualEarnings | null
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
    <Card variant="outlined" sx={{ borderColor: 'divider' }}>
      <CardContent sx={{ p: 3 }}>
        <Stack
          direction="row"
          spacing={2}
          sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}
        >
          <Box>
            <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
              Earnings
            </Typography>
            <Typography variant="caption" color="text.secondary">
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
                textAlign: 'right',
                borderRadius: 1.5,
                px: 2,
                py: 1.25,
                bgcolor: 'action.hover',
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  display: 'block',
                  fontSize: '0.7rem',
                }}
              >
                Next report
              </Typography>
              <Typography
                sx={{ fontWeight: 700, fontSize: '1.35rem', lineHeight: 1.3 }}
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

        {hasAnnual && (
          <ToggleButtonGroup
            size="small"
            exclusive
            value={period}
            onChange={(_, value: 'quarterly' | 'annual' | null) =>
              value && setPeriod(value)
            }
            aria-label="Earnings period"
            sx={{ mt: 2 }}
          >
            <ToggleButton value="quarterly" sx={{ px: 1.5, py: 0.25 }}>
              Quarterly
            </ToggleButton>
            <ToggleButton value="annual" sx={{ px: 1.5, py: 0.25 }}>
              Annual
            </ToggleButton>
          </ToggleButtonGroup>
        )}

        {activeQuarters.length === 0 ? (
          <Typography color="text.secondary" sx={{ mt: 2 }}>
            No earnings history available for this stock.
          </Typography>
        ) : (
          <>
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

        {earnings.metrics && <MetricTiles metrics={earnings.metrics} />}
        {earnings.valuation && (
          <ValuationTiles valuation={earnings.valuation} />
        )}
      </CardContent>
    </Card>
  )
}
