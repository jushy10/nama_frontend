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
  Typography,
  useTheme,
} from '@mui/material'
import type { Theme } from '@mui/material/styles'
import type {
  EarningsHistory,
  EarningsMetrics,
  EarningsSurprise,
  NextEarnings,
} from '@/lib/api'

// The plot's viewBox WIDTH tracks the measured container width (so 1 unit ≈ 1px
// and text stays legible at any size — crucial on mobile), while the height is
// fixed at H. `W_FALLBACK` is used until the container is measured and in jsdom
// (where there's no layout), keeping tests on stable desktop geometry.
const W_FALLBACK = 820
const H = 300
const PAD = { top: 30, right: 48, bottom: 46, left: 12 }

const fmtEps = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(n).toFixed(2)}`
const fmtPct = (n: number) => `${n >= 0 ? '+' : '-'}${Math.abs(n).toFixed(1)}%`
const fmtPlainPct = (n: number) => `${n.toFixed(1)}%`

/** Muted fill for the "estimate" bar — faint enough to sit behind the actual,
 *  and legible on both the dark and light canvas. Shared with the legend. */
const estimateColor = (theme: Theme) =>
  theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.18)'

/** "Q2 '24" from the fiscal period, falling back to the report month. */
function quarterLabel(q: EarningsSurprise): string {
  if (q.fiscal_quarter && q.fiscal_year) {
    return `Q${q.fiscal_quarter} '${String(q.fiscal_year).slice(-2)}`
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

/** "Q3 '26" for the upcoming report, falling back to its expected month. */
function nextLabel(n: NextEarnings): string {
  if (n.fiscal_quarter && n.fiscal_year) {
    return `Q${n.fiscal_quarter} '${String(n.fiscal_year).slice(-2)}`
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

/** "Nov 20 '25" — a quarter's period date, for the hover detail line. */
const fmtFullDate = (iso: string) =>
  parseDateOnly(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: '2-digit',
  })

/** Compact revenue, e.g. "$89.0B" / "$1.2T". */
const fmtRev = (n: number) =>
  n.toLocaleString('en-US', {
    notation: 'compact',
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 1,
  })

/** EPS or an em dash when the value is missing. */
const eps = (v: number | null | undefined) => (v == null ? '—' : fmtEps(v))

const SESSION_LABEL: Record<string, string> = {
  bmo: 'before open',
  amc: 'after close',
  dmh: 'during hours',
}

/** The nearest upcoming report — the same one the chart draws its first forecast
 *  bar for. Prefers the multi-quarter `upcoming` list, falls back to
 *  `next_report`, so the header chip and that bar always agree. */
function nearestForecast(e: EarningsHistory): NextEarnings | null {
  const list = e.upcoming?.length
    ? e.upcoming
    : e.next_report
      ? [e.next_report]
      : []
  return list.find((f) => f.eps_estimate != null) ?? null
}

/**
 * Grouped EPS columns — a muted "estimate" bar beside the reported "actual"
 * (green when it met/beat, red when it missed) for each quarter, oldest to
 * newest. Surprise % rides above each pair; the actual EPS sits under the
 * quarter label. A zero baseline keeps loss quarters (negative EPS) readable.
 * When `next` carries a consensus, a forward "expected" column is appended at
 * the right edge, styled as a forecast (dashed accent outline + a level marker).
 */
function EarningsChart({
  quarters,
  next,
  upcoming,
}: {
  quarters: EarningsSurprise[]
  next?: NextEarnings | null
  upcoming?: NextEarnings[]
}) {
  const theme = useTheme()
  const up = theme.palette.success.main
  const down = theme.palette.error.main
  const grid = theme.palette.divider
  const axis = theme.palette.text.secondary
  const est = estimateColor(theme)
  const forecast = theme.palette.primary.main // indigo accent for the forecast
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

  // Forward "expected" columns: the multi-quarter analyst consensus when we have
  // it, else just the next scheduled report — only those with a consensus EPS.
  const forecasts = useMemo(() => {
    const list = upcoming && upcoming.length ? upcoming : next ? [next] : []
    return list.filter((f) => f.eps_estimate != null)
  }, [upcoming, next])
  const hasForecast = forecasts.length > 0

  // API is newest-first; a time axis reads oldest → newest, left → right. The
  // forecasts sit at the far right, after the last reported quarter.
  const data = useMemo(() => [...quarters].reverse(), [quarters])

  const geo = useMemo(() => {
    const plotW = W - PAD.left - PAD.right
    const plotH = H - PAD.top - PAD.bottom

    // Always anchor the scale at zero so bar heights are comparable and the
    // baseline is meaningful; stretch to cover whatever actual/estimate reach,
    // plus the forward consensus if there is one.
    let max = 0
    let min = 0
    for (const q of data) {
      for (const v of [q.actual, q.estimate]) {
        if (v == null) continue
        if (v > max) max = v
        if (v < min) min = v
      }
    }
    for (const f of forecasts) {
      const e = f.eps_estimate
      if (e == null) continue
      if (e > max) max = e
      if (e < min) min = e
    }
    if (max === min) max = 1 // all-zero / empty guard
    const padV = (max - min) * 0.15 || 1
    max += padV
    if (min < 0) min -= padV // only drop the floor when there are losses

    const n = data.length + forecasts.length
    const slot = plotW / Math.max(n, 1)
    const groupW = Math.min(slot * 0.62, 72)
    const gap = Math.min(groupW * 0.12, 4)
    const barW = (groupW - gap) / 2

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
        No earnings history available.
      </Typography>
    )
  }

  const { cx, y, groupW, gap, barW, ticks, zeroY, slot, n } = geo
  const fcIndex = data.length // the forecast column's slot, at the right edge

  // The hovered column drives the detail line; default to the latest reported
  // quarter (or the forecast when there's no history) so the line is never blank.
  const active = hover ?? (data.length > 0 ? data.length - 1 : fcIndex)

  function onMove(e: PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    if (!rect.width) return // jsdom / unmeasured: leave hover untouched
    const vbX = ((e.clientX - rect.left) / rect.width) * W
    const i = Math.floor((vbX - PAD.left) / slot)
    setHover(Math.max(0, Math.min(n - 1, i)))
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

  // The detail line for the active column — EPS estimate vs. actual (+ surprise),
  // revenue when present; the forecast column shows the consensus going in.
  const detail =
    active < data.length
      ? (() => {
          const q = data[active]
          const c = q.beat == null ? axis : q.beat ? up : down
          return (
            <>
              <Box component="span" sx={{ color: axis, mr: 0.5 }}>
                {quarterLabel(q)}
                {q.period ? ` · ${fmtFullDate(q.period)}` : ''}
              </Box>
              {cell('Est', eps(q.estimate))}
              {cell('Act', eps(q.actual), c)}
              {q.surprise_percent != null &&
                cell('', fmtPct(q.surprise_percent), c)}
              {q.revenue_estimate != null &&
                cell('Rev est', fmtRev(q.revenue_estimate))}
              {q.revenue_actual != null &&
                cell('act', fmtRev(q.revenue_actual), c)}
            </>
          )
        })()
      : (() => {
          const f = forecasts[active - data.length]
          if (!f) return null
          return (
            <>
              <Box component="span" sx={{ color: forecast, mr: 0.5 }}>
                {nextLabel(f)}
                {f.report_date ? ` · Est. ${fmtReportDate(f.report_date)}` : ''}
                {f.session && SESSION_LABEL[f.session]
                  ? ` (${SESSION_LABEL[f.session]})`
                  : ''}
              </Box>
              {cell('EPS est', eps(f.eps_estimate), forecast)}
              {f.revenue_estimate != null &&
                cell('Rev est', fmtRev(f.revenue_estimate), forecast)}
              <Box component="span" sx={{ color: forecast, fontWeight: 600 }}>
                Upcoming
              </Box>
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
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Quarterly actual versus estimated earnings per share"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        sx={{
          width: '100%',
          height: 'auto',
          display: 'block',
          touchAction: 'none',
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
        {/* gridlines + EPS axis labels (right) */}
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
              {fmtEps(t)}
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

        {data.map((q, i) => {
          const center = cx(i)
          const estX = center - groupW / 2
          const actX = estX + barW + gap
          const actColor = q.beat == null ? axis : q.beat ? up : down

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
            q.surprise_percent == null ? null : (
              <text
                x={center}
                y={18}
                fontSize={11}
                fontWeight={600}
                fill={actColor}
                textAnchor="middle"
              >
                {fmtPct(q.surprise_percent)}
              </text>
            )

          return (
            <g key={q.period ?? i}>
              {surprise}
              {bar(estX, q.estimate, est)}
              {bar(actX, q.actual, actColor)}
              {/* quarter label + the reported EPS beneath it */}
              <text
                x={center}
                y={H - 26}
                fontSize={11}
                fill={axis}
                textAnchor="middle"
              >
                {quarterLabel(q)}
              </text>
              {q.actual != null && (
                <text
                  x={center}
                  y={H - 12}
                  fontSize={11}
                  fontWeight={600}
                  fill={actColor}
                  textAnchor="middle"
                >
                  {fmtEps(q.actual)}
                </text>
              )}
            </g>
          )
        })}

        {/* forward "expected" columns: analyst consensus for upcoming quarters */}
        {forecasts.map((f, k) => {
          const e = f.eps_estimate
          if (e == null) return null
          const center = cx(fcIndex + k)
          const top = Math.min(y(e), zeroY)
          const h = Math.max(1, Math.abs(y(e) - zeroY))
          return (
            <g key={`fc${k}`}>
              {/* consensus estimate, accent-coloured, in the top margin */}
              <text
                x={center}
                y={18}
                fontSize={11}
                fontWeight={600}
                fill={forecast}
                textAnchor="middle"
              >
                {fmtEps(e)}
              </text>
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
              {/* level marker — "where analysts expect it", a touch wider */}
              <line
                x1={center - groupW / 2}
                x2={center + groupW / 2}
                y1={y(e)}
                y2={y(e)}
                stroke={forecast}
                strokeWidth={1.5}
              />
              {/* fiscal label + the expected report date beneath it */}
              <text
                x={center}
                y={H - 26}
                fontSize={11}
                fill={forecast}
                textAnchor="middle"
              >
                {nextLabel(f)}
              </text>
              {f.report_date && (
                <text
                  x={center}
                  y={H - 12}
                  fontSize={11}
                  fontWeight={600}
                  fill={forecast}
                  textAnchor="middle"
                >
                  {`Est. ${fmtReportDate(f.report_date)}`}
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

// The trailing earnings/profitability metrics, in display order. `kind` drives
// formatting: `money` → "$8.27", `growth` → signed + coloured ("+29.0%"),
// `pct` → plain percent ("27.2%").
const METRIC_TILES: {
  key: keyof EarningsMetrics
  label: string
  kind: 'money' | 'growth' | 'pct'
}[] = [
  { key: 'eps', label: 'EPS (TTM)', kind: 'money' },
  { key: 'eps_growth_yoy', label: 'EPS Gr. (YoY)', kind: 'growth' },
  { key: 'revenue_growth_yoy', label: 'Rev. Gr. (YoY)', kind: 'growth' },
  { key: 'gross_margin', label: 'Gross Margin', kind: 'pct' },
  { key: 'operating_margin', label: 'Op. Margin', kind: 'pct' },
  { key: 'net_margin', label: 'Net Margin', kind: 'pct' },
]

/** A grid of trailing earnings metrics (EPS, growth, margins, returns, payout)
 *  served alongside the beat history. Growth tiles are signed and coloured; a
 *  value the vendor doesn't cover shows an em dash. */
function MetricTiles({ metrics }: { metrics: EarningsMetrics }) {
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
        {METRIC_TILES.map(({ key, label, kind }) => {
          const v = metrics[key]
          let text = '—'
          let color = 'text.primary'
          if (v != null) {
            if (kind === 'money') text = fmtEps(v)
            else if (kind === 'growth') {
              text = fmtPct(v)
              color = v >= 0 ? 'success.main' : 'error.main'
            } else text = fmtPlainPct(v)
          }
          return (
            <Box
              key={key}
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
                {text}
              </Typography>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}

export default function EarningsCard({
  earnings,
}: {
  earnings: EarningsHistory
}) {
  const { quarters } = earnings
  const nextRpt = nearestForecast(earnings)

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
              Quarterly EPS — actual vs. estimate
            </Typography>
          </Box>

          {nextRpt?.report_date && (
            <Box
              sx={{
                flexShrink: 0,
                textAlign: 'right',
                borderRadius: 1.5,
                px: 1.5,
                py: 0.75,
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
                  fontSize: '0.6rem',
                }}
              >
                Next report
              </Typography>
              <Typography sx={{ fontWeight: 600, lineHeight: 1.3 }}>
                {fmtReportDate(nextRpt.report_date)}
              </Typography>
              {nextRpt.eps_estimate != null && (
                <Typography
                  variant="caption"
                  sx={{ color: 'primary.main', fontWeight: 500 }}
                >
                  {`est ${fmtEps(nextRpt.eps_estimate)}`}
                </Typography>
              )}
            </Box>
          )}
        </Stack>

        {quarters.length === 0 ? (
          <Typography color="text.secondary" sx={{ mt: 2 }}>
            No earnings history available for this stock.
          </Typography>
        ) : (
          <>
            <Box sx={{ mt: 2.5 }}>
              <EarningsChart
                quarters={quarters}
                next={earnings.next_report}
                upcoming={earnings.upcoming}
              />
            </Box>
            <Stack
              direction="row"
              spacing={2}
              useFlexGap
              sx={{ flexWrap: 'wrap', mt: 1.5 }}
            >
              <LegendItem color={estimateColor} label="Estimate" />
              <LegendItem color="success.main" label="Beat" />
              <LegendItem color="error.main" label="Missed" />
              {(earnings.upcoming?.some((u) => u.eps_estimate != null) ||
                earnings.next_report?.eps_estimate != null) && (
                <LegendItem color="primary.main" label="Upcoming (est.)" />
              )}
            </Stack>
          </>
        )}

        {earnings.metrics && <MetricTiles metrics={earnings.metrics} />}
      </CardContent>
    </Card>
  )
}
