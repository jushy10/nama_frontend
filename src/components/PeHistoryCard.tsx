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
import type {
  PeHistory,
  PeHistoryPoint,
  PeHistorySignal,
  PeHistoryStats,
} from '@/lib/api'
import InfoHint from '@/components/InfoHint'

// A trailing-P/E history needs a few points to read as a trend rather than a dot
// or two; below this the card self-hides (an uncovered or upstream-blocked symbol
// comes back with an empty/near-empty series from the best-effort endpoint).
const MIN_POINTS = 3

// The same valuation palette the Industry P/E and PEG cards use — cheaper-than-usual
// reads green, in its usual band amber, pricier-than-usual red — so "green = cheap"
// stays consistent down the Valuation tab. The difference: this compares the stock
// against *its own* history, not its peers.
const STANCE = {
  below: { color: 'success.main', label: 'Below Its Avg' },
  in_line: { color: '#fbbf24', label: 'In Its Range' },
  above: { color: 'error.main', label: 'Above Its Avg' },
} as const
type Stance = keyof typeof STANCE

// Map the backend's percentile-based signal onto the card's stance vocabulary —
// cheap (bottom quartile of its own history) reads the same green "below its avg"
// as a client-computed below-median stance, so the palette stays consistent
// whichever path produced the verdict.
const SIGNAL_STANCE: Record<PeHistorySignal, Stance> = {
  cheap: 'below',
  fair: 'in_line',
  expensive: 'above',
}

/** A P/E to one decimal, e.g. 21.04 → "21.0". */
const fmt = (n: number) => n.toFixed(1)

/** An ordinal label for a percentile, e.g. 6 → "6th", 92 → "92nd". */
function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`
}

/** A short month/year label from an ISO `yyyy-mm-dd` (parsed as local midnight). */
const fmtDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    year: '2-digit',
  })

/** The median of a numeric list (mean of the two middles on an even count). */
function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/**
 * Grade the latest P/E against the window median with the same ±10% dead-band the
 * industry read uses, so a small gap doesn't read as a signal. Null when either
 * figure is non-positive (no gradeable comparison without two positive multiples).
 */
function stanceOf(latest: number, med: number): Stance | null {
  if (latest <= 0 || med <= 0) return null
  const ratio = latest / med
  if (ratio <= 0.9) return 'below'
  if (ratio >= 1.1) return 'above'
  return 'in_line'
}

/** The one-line story the latest multiple and the window tell together, worded off
 *  the graded stance so the chip and the sentence never disagree at the band edge. */
function summaryLine(
  latest: number,
  med: number,
  lo: number,
  hi: number,
  n: number,
  stance: Stance | null,
): string {
  const range = `over the last ${n} quarters it has ranged ${fmt(lo)}–${fmt(hi)}`
  if (stance === null || stance === 'in_line') {
    return (
      `Its trailing P/E of ${fmt(latest)} is about where it usually sits ` +
      `(${n}-quarter median ${fmt(med)}); ${range}.`
    )
  }
  const pct = Math.abs(Math.round((latest / med - 1) * 100))
  if (stance === 'above') {
    return (
      `Its trailing P/E of ${fmt(latest)} is about ${pct}% above its ` +
      `${n}-quarter median of ${fmt(med)} — the market is paying more for it ` +
      `than it typically has; ${range}.`
    )
  }
  return (
    `Its trailing P/E of ${fmt(latest)} is about ${pct}% below its ` +
    `${n}-quarter median of ${fmt(med)} — cheaper than its own recent norm; ` +
    `${range}.`
  )
}

/**
 * The stats-aware summary (when the backend ranked the series): leads with how the
 * current multiple ranks against the stock's own recent history — the percentile
 * complement, so "cheaper than 94% of the last N quarters" — then its gap to the
 * median. Worded off `stats.signal` so it never disagrees with the verdict chip.
 */
function statsSummaryLine(stats: PeHistoryStats, n: number): string {
  const pe = fmt(stats.current_pe)
  const med = fmt(stats.median_pe)
  const disc = Math.abs(Math.round(stats.discount_to_median_percent))
  const pct = Math.round(stats.current_percentile)
  const range = `over ${n} quarters it has ranged ${fmt(stats.min_pe)}–${fmt(
    stats.max_pe,
  )}`
  if (stats.signal === 'cheap') {
    return (
      `Its trailing P/E of ${pe} is cheaper than ${100 - pct}% of the last ${n} ` +
      `quarters — about ${disc}% below its median of ${med}. Low for its own ` +
      `history, whether a bargain or a discount for slower growth; ${range}.`
    )
  }
  if (stats.signal === 'expensive') {
    return (
      `Its trailing P/E of ${pe} is higher than ${pct}% of the last ${n} ` +
      `quarters — about ${disc}% above its median of ${med}. The market is ` +
      `paying up versus its own history; ${range}.`
    )
  }
  return (
    `Its trailing P/E of ${pe} is about where it usually trades ` +
    `(median ${med}); ${range}.`
  )
}

/** One labelled figure block — the latest P/E and the window median, side by side.
 *  The latest value is tinted by its stance; the median stays neutral. */
function Figure({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: string
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
          letterSpacing: '0.05em',
          fontSize: '0.65rem',
          overflowWrap: 'anywhere',
        }}
      >
        {label}
      </Typography>
      <Typography
        variant="h4"
        sx={{
          mt: 0.25,
          fontWeight: 700,
          color,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.1,
        }}
      >
        {fmt(value)}
      </Typography>
    </Box>
  )
}

// Responsive SVG geometry — the same approach as CandleChart /
// PerformanceComparisonChart: the viewBox width tracks the container's measured
// pixel width so axis text stays legible down to phone widths, with a desktop
// fallback until measured (and in jsdom, which has no ResizeObserver).
const H = 220
const W_FALLBACK = 640
const PAD = { top: 12, right: 46, bottom: 24, left: 10 }

/**
 * The dependency-free P/E line: the trailing multiple at each earnings release,
 * plotted evenly by release (quarters are ~evenly spaced, and even slots keep the
 * line readable), with a dashed median reference so "rich vs. its own history" is
 * visible at a glance. A hover crosshair drives the date + P/E readout above it.
 */
function PeLineChart({
  points,
  med,
  band,
}: {
  points: PeHistoryPoint[]
  med: number
  band?: { p25: number; p75: number }
}) {
  const theme = useTheme()
  const grid = theme.palette.divider
  const axis = theme.palette.text.secondary
  const lineColor = theme.palette.primary.main

  const wrapRef = useRef<HTMLDivElement>(null)
  const [cw, setCw] = useState(W_FALLBACK)
  const [hover, setHover] = useState<number | null>(null)
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

  const geo = useMemo(() => {
    const plotW = W - PAD.left - PAD.right
    const plotH = H - PAD.top - PAD.bottom
    const pes = points.map((p) => p.pe)
    let lo = Math.min(...pes, med)
    let hi = Math.max(...pes, med)
    const pad = (hi - lo) * 0.1 || 1
    lo -= pad
    hi += pad
    const last = Math.max(points.length - 1, 1)
    const x = (i: number) => PAD.left + (i / last) * plotW
    const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo || 1)) * plotH
    const tickN = 4
    const yTicks = Array.from(
      { length: tickN + 1 },
      (_, i) => lo + ((hi - lo) * i) / tickN,
    )
    // Evenly-spaced date labels, capped so they never collide at narrow widths.
    const labelW = 68
    const dateN = Math.min(
      points.length,
      5,
      Math.max(2, Math.floor(plotW / labelW)),
    )
    const dateIdx = Array.from({ length: dateN }, (_, i) =>
      Math.round((i * (points.length - 1)) / Math.max(dateN - 1, 1)),
    )
    return { x, y, yTicks, dateIdx, plotW, last }
  }, [points, med, W])

  const { x, y, yTicks, dateIdx } = geo
  const active = hover ?? points.length - 1
  const activePt = points[active]

  function onPoint(e: PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    if (!rect.width) return
    const vbX = ((e.clientX - rect.left) / rect.width) * W
    const i = Math.round(((vbX - PAD.left) / geo.plotW) * geo.last)
    setHover(Math.max(0, Math.min(points.length - 1, i)))
  }
  function onLeave(e: PointerEvent<SVGSVGElement>) {
    if (e.pointerType === 'mouse') setHover(null)
  }

  const line = points.map((p, i) => `${x(i)},${y(p.pe)}`).join(' ')

  return (
    <Box ref={wrapRef} sx={{ mt: 2 }}>
      {/* Readout: the hovered (or latest) release's date + P/E. */}
      <Stack
        direction="row"
        spacing={1}
        sx={{ mb: 0.5, fontSize: '0.8rem', fontWeight: 500 }}
      >
        <Box component="span" sx={{ color: axis }}>
          {fmtDate(activePt.date)}
        </Box>
        <Box
          component="span"
          sx={{
            color: 'text.primary',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          P/E {fmt(activePt.pe)}
        </Box>
      </Stack>

      <Box
        component="svg"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={
          band
            ? `Trailing P/E over the last ${points.length} quarters, with its usual 25th–75th percentile range shaded`
            : `Trailing P/E over the last ${points.length} quarters`
        }
        onPointerDown={onPoint}
        onPointerMove={onPoint}
        onPointerLeave={onLeave}
        sx={{
          width: '100%',
          height: 'auto',
          display: 'block',
          touchAction: 'pan-y',
          cursor: 'crosshair',
        }}
      >
        {/* the multiple's usual range (25th–75th percentile) — the line dipping
            below it reads cheap, poking above it rich; only when the backend
            ranked the series (drawn first, so it sits behind the grid and line) */}
        {band && (
          <rect
            x={PAD.left}
            y={y(band.p75)}
            width={W - PAD.right - PAD.left}
            height={Math.max(0, y(band.p25) - y(band.p75))}
            fill={lineColor}
            opacity={0.1}
          />
        )}

        {/* horizontal gridlines + P/E axis labels (right) */}
        {yTicks.map((v, i) => (
          <g key={i}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(v)}
              y2={y(v)}
              stroke={grid}
              strokeWidth={1}
            />
            <text
              x={W - PAD.right + 6}
              y={y(v) + 3.5}
              fontSize={11}
              fill={axis}
            >
              {fmt(v)}
            </text>
          </g>
        ))}

        {/* the median reference line — the "its own norm" the verdict grades against */}
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={y(med)}
          y2={y(med)}
          stroke={axis}
          strokeWidth={1}
          strokeDasharray="4 3"
          opacity={0.7}
        />
        <text x={PAD.left + 2} y={y(med) - 4} fontSize={10} fill={axis}>
          median {fmt(med)}
        </text>

        {/* date axis labels — pin first/last inside the frame so they don't clip */}
        {dateIdx.map((i, k) => {
          const isFirst = k === 0
          const isLast = k === dateIdx.length - 1
          const anchor = isFirst ? 'start' : isLast ? 'end' : 'middle'
          const tx = isFirst ? PAD.left : isLast ? W - PAD.right : x(i)
          return (
            <text
              key={i}
              x={tx}
              y={H - 7}
              fontSize={11}
              fill={axis}
              textAnchor={anchor}
            >
              {fmtDate(points[i].date)}
            </text>
          )
        })}

        {/* the P/E path */}
        <polyline
          points={line}
          fill="none"
          stroke={lineColor}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* the active (hovered/latest) point + its crosshair */}
        {hover != null && (
          <line
            x1={x(active)}
            x2={x(active)}
            y1={PAD.top}
            y2={H - PAD.bottom}
            stroke={axis}
            strokeWidth={1}
            strokeDasharray="3 3"
            opacity={0.6}
            pointerEvents="none"
          />
        )}
        <circle cx={x(active)} cy={y(activePt.pe)} r={3.5} fill={lineColor} />
      </Box>
    </Box>
  )
}

/**
 * The stock's trailing P/E over time (`GET /stocks/ticker/{ticker}/pe-history`):
 * the closing price at each past earnings release over its trailing-twelve-month
 * reported EPS. Where the Industry P/E card anchors the multiple against peers,
 * this anchors it against the stock's *own* history — is today's multiple rich or
 * cheap versus where it has traded? When the backend ranked the series (≈2+ years),
 * the verdict, the headline percentile, and the shaded interquartile band all come
 * from its `stats` block (a percentile-based read); for shorter series it falls back
 * to a client-side median stance. A line plots the walk with that median marked, and
 * a plain-language line spells out the gap. Renders nothing below `MIN_POINTS` — a
 * dot or two isn't a history (an uncovered/blocked symbol comes back near-empty).
 */
export default function PeHistoryCard({ history }: { history: PeHistory }) {
  const points = history.points
  if (points.length < MIN_POINTS) return null

  const pes = points.map((p) => p.pe)
  // Prefer the backend's ranked read (percentile + signal + IQR band over the whole
  // series) when present; fall back to a client-side median stance for short series
  // (3–7 quarters) the backend leaves unranked (`stats: null`).
  const stats = history.stats ?? null
  const med = stats ? stats.median_pe : median(pes)
  const latest = stats ? stats.current_pe : points[points.length - 1].pe
  const lo = Math.min(...pes)
  const hi = Math.max(...pes)
  const stance = stats ? SIGNAL_STANCE[stats.signal] : stanceOf(latest, med)
  const meta = stance ? STANCE[stance] : null
  const latestColor = meta ? meta.color : 'text.primary'
  const band = stats ? { p25: stats.p25_pe, p75: stats.p75_pe } : undefined

  return (
    <Card variant="outlined" sx={{ borderColor: 'divider' }}>
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack
          direction="row"
          spacing={2}
          sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}
        >
          <Box>
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
              <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
                P/E History
              </Typography>
              <InfoHint title="The stock's trailing P/E at each past earnings release — the closing price that day over its trailing-twelve-month reported EPS. Shows whether today's multiple is high or low against its own recent history, a different anchor from the peer comparison." />
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Trailing multiple over {points.length} quarters
            </Typography>
          </Box>

          {meta && (
            <Box sx={{ textAlign: 'right' }}>
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  display: 'block',
                }}
              >
                Verdict
              </Typography>
              <Box
                sx={{
                  mt: 0.5,
                  display: 'inline-block',
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: meta.color,
                  color: meta.color,
                  bgcolor: 'action.hover',
                  fontWeight: 700,
                  fontSize: '1rem',
                  letterSpacing: '0.02em',
                }}
              >
                {meta.label}
              </Box>
              {stats && (
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    mt: 0.75,
                    color: 'text.secondary',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {ordinal(Math.round(stats.current_percentile))} percentile
                </Typography>
              )}
            </Box>
          )}
        </Stack>

        <Box
          sx={{
            mt: 2,
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            columnGap: 2,
          }}
        >
          <Figure label="Latest P/E" value={latest} color={latestColor} />
          <Figure
            label={`${points.length}-qtr median`}
            value={med}
            color="text.primary"
          />
        </Box>

        <PeLineChart points={points} med={med} band={band} />

        <Typography variant="body2" color="text.secondary" sx={{ mt: 2.5 }}>
          {stats
            ? statsSummaryLine(stats, points.length)
            : summaryLine(latest, med, lo, hi, points.length, stance)}
        </Typography>
      </CardContent>
    </Card>
  )
}
