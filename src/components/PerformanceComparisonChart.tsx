import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from 'react'
import { Box, Stack, Typography, useTheme } from '@mui/material'

// Same responsive-SVG approach as CandleChart: the viewBox width tracks the
// container's pixel width (measured below) so axis text stays legible down to
// phone widths, with a sensible desktop fallback until we've measured (and in
// jsdom, which has no ResizeObserver).
const W_FALLBACK = 820
const H = 360
const PAD = { top: 14, right: 52, bottom: 26, left: 10 }

/** One point on a rebased line: a timestamp and a percent-from-start value. */
export interface SeriesPoint {
  /** UNIX epoch seconds (shared time axis across every series). */
  t: number
  /** Percent change from the series' first close (0 at the left edge). */
  pct: number
}

/** A single ticker's rebased line plus its benchmark stats. */
export interface ComparisonSeries {
  symbol: string
  label: string
  color: string
  /** Benchmarks (the index ETFs) draw thicker and on top of the members. */
  isBenchmark?: boolean
  /** Stroke dash pattern; undefined = solid. Benchmarks pass a dash. */
  dash?: string
  points: SeriesPoint[]
  /** Total return over the range = the last point's pct. */
  totalPct: number
}

const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
const fmtAxisPct = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(0)}%`

function fmtDate(ts: number, intraday: boolean) {
  const d = new Date(ts * 1000)
  return intraday
    ? d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: '2-digit',
      })
}

interface Props {
  series: ComparisonSeries[]
  /** True for intraday ranges, so the date axis/readout carries a time. */
  intraday?: boolean
}

/**
 * A dependency-free multi-line chart that overlays each ticker's price path
 * rebased to a common 0% start, so lines that move together are visibly
 * correlated regardless of share price. The benchmark (SPY) draws thicker on
 * top; a hover crosshair drives a per-series legend showing each line's value
 * at that date. Renders as one responsive SVG, like CandleChart.
 */
export default function PerformanceComparisonChart({
  series,
  intraday = false,
}: Props) {
  const theme = useTheme()
  const [hover, setHover] = useState<number | null>(null)

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

  const grid = theme.palette.divider
  const axis = theme.palette.text.secondary

  const geo = useMemo(() => {
    const plotW = W - PAD.left - PAD.right
    const plotH = H - PAD.top - PAD.bottom

    // The pct domain always includes 0 so the rebase baseline is on-chart even
    // when every line is up (or down); the timeline is the union of every
    // series' timestamps.
    let pMin = 0
    let pMax = 0
    const times = new Set<number>()
    for (const s of series) {
      for (const p of s.points) {
        if (p.pct < pMin) pMin = p.pct
        if (p.pct > pMax) pMax = p.pct
        times.add(p.t)
      }
    }
    // Breathe above/below the extremes so lines aren't flush to the frame.
    const pad = (pMax - pMin) * 0.06 || 1
    pMax += pad
    pMin -= pad

    // Sorted, de-duped timeline, with each timestamp's slot index and each
    // series' value at a timestamp pre-indexed for O(1) lookup. The mega-caps
    // share identical bar timestamps, so plotting by slot index (not absolute
    // time) keeps lines aligned and — like the candle chart — compresses the
    // overnight/weekend gaps an intraday range would otherwise stretch across.
    const timeline = [...times].sort((a, b) => a - b)
    const slotOf = new Map<number, number>()
    timeline.forEach((t, i) => slotOf.set(t, i))
    const maps = series.map((s) => {
      const m = new Map<number, number>()
      for (const p of s.points) m.set(p.t, p.pct)
      return m
    })

    const lastSlot = Math.max(timeline.length - 1, 1)
    const x = (i: number) => PAD.left + (i / lastSlot) * plotW
    const y = (p: number) =>
      PAD.top + (1 - (p - pMin) / (pMax - pMin || 1)) * plotH

    const tickN = 4
    const pctTicks = Array.from(
      { length: tickN + 1 },
      (_, i) => pMin + ((pMax - pMin) * i) / tickN,
    )

    // Even slot spacing means evenly-spaced labels with no collisions.
    const labelW = intraday ? 96 : 64
    const dateN = Math.min(
      timeline.length,
      6,
      Math.max(2, Math.floor(plotW / labelW)),
    )
    const dateIdx = Array.from({ length: dateN }, (_, i) =>
      Math.round((i * (timeline.length - 1)) / Math.max(dateN - 1, 1)),
    )

    return { x, y, slotOf, pctTicks, timeline, maps, dateIdx, plotW, lastSlot }
  }, [series, W, intraday])

  if (series.length === 0 || geo.timeline.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
        No comparison data for this range.
      </Typography>
    )
  }

  const { x, y, slotOf, pctTicks, timeline, maps, dateIdx } = geo
  const active = hover ?? timeline.length - 1
  const activeT = timeline[active]
  const zeroY = y(0)

  function onPoint(e: PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    if (!rect.width) return
    const vbX = ((e.clientX - rect.left) / rect.width) * W
    // Map the pointer straight onto the nearest evenly-spaced slot.
    const slot = Math.round(((vbX - PAD.left) / geo.plotW) * geo.lastSlot)
    setHover(Math.max(0, Math.min(timeline.length - 1, slot)))
  }

  function onLeave(e: PointerEvent<SVGSVGElement>) {
    if (e.pointerType === 'mouse') setHover(null)
  }

  const ariaLabel = `Performance comparison chart overlaying ${series.length} tickers rebased to a common start`

  return (
    <Box ref={wrapRef}>
      {/* Legend: a swatch + label + value-at-cursor + correlation per ticker.
          Defaults to the latest point (total return over the range) and tracks
          the hovered date. */}
      <Stack
        direction="row"
        useFlexGap
        sx={{
          flexWrap: 'wrap',
          columnGap: 1.5,
          rowGap: 0.5,
          fontSize: '0.8rem',
          fontWeight: 500,
          mb: 1,
        }}
      >
        <Box component="span" sx={{ color: axis, mr: 0.5 }}>
          {fmtDate(activeT, intraday)}
        </Box>
        {series.map((s, si) => {
          const v = maps[si].get(activeT)
          const up = (v ?? s.totalPct) >= 0
          return (
            <Box
              key={s.symbol}
              component="span"
              sx={{ whiteSpace: 'nowrap', display: 'inline-flex', gap: 0.5 }}
            >
              <Box
                component="span"
                sx={{
                  width: 9,
                  height: 9,
                  borderRadius: '2px',
                  bgcolor: s.color,
                  alignSelf: 'center',
                  outline: s.isBenchmark
                    ? `1px solid ${theme.palette.text.primary}`
                    : 'none',
                }}
              />
              <Box component="span" sx={{ color: 'text.primary' }}>
                {s.symbol}
              </Box>
              <Box
                component="span"
                sx={{
                  color: up
                    ? theme.palette.success.main
                    : theme.palette.error.main,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {v == null ? '—' : fmtPct(v)}
              </Box>
            </Box>
          )
        })}
      </Stack>

      <Box
        component="svg"
        viewBox={`0 0 ${W} ${H}`}
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
          touchAction: 'pan-y',
          cursor: 'crosshair',
        }}
      >
        {/* horizontal gridlines + percent axis labels (right) */}
        {pctTicks.map((p, i) => (
          <g key={`p${i}`}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(p)}
              y2={y(p)}
              stroke={grid}
              strokeWidth={1}
            />
            <text
              x={W - PAD.right + 6}
              y={y(p) + 3.5}
              fontSize={11}
              fill={axis}
            >
              {fmtAxisPct(p)}
            </text>
          </g>
        ))}
        {/* emphasised 0% baseline — the rebase origin every line starts from */}
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={zeroY}
          y2={zeroY}
          stroke={axis}
          strokeWidth={1}
          opacity={0.5}
        />

        {/* date axis labels — pin first/last inside the frame so they don't clip */}
        {dateIdx.map((i, k) => {
          const isFirst = k === 0
          const isLast = k === dateIdx.length - 1
          const anchor = isFirst ? 'start' : isLast ? 'end' : 'middle'
          const tx = isFirst ? PAD.left : isLast ? W - PAD.right : x(i)
          return (
            <text
              key={`d${i}`}
              x={tx}
              y={H - 8}
              fontSize={11}
              fill={axis}
              textAnchor={anchor}
            >
              {fmtDate(timeline[i], intraday)}
            </text>
          )
        })}

        {/* the lines: non-benchmark first, benchmark last so SPY sits on top */}
        {[...series]
          .map((s, si) => ({ s, si }))
          .sort((a, b) => Number(!!a.s.isBenchmark) - Number(!!b.s.isBenchmark))
          .map(({ s, si }) => (
            <polyline
              key={s.symbol}
              points={s.points
                .map((p) => `${x(slotOf.get(p.t) ?? 0)},${y(p.pct)}`)
                .join(' ')}
              fill="none"
              stroke={s.color}
              strokeWidth={s.isBenchmark ? 2.5 : 1.5}
              strokeDasharray={s.dash}
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={hover != null && maps[si].get(activeT) == null ? 0.5 : 1}
            />
          ))}

        {/* hover crosshair + a dot on each line at the hovered date */}
        {hover != null && (
          <g pointerEvents="none">
            <line
              x1={x(active)}
              x2={x(active)}
              y1={PAD.top}
              y2={H - PAD.bottom}
              stroke={axis}
              strokeWidth={1}
              strokeDasharray="3 3"
              opacity={0.6}
            />
            {series.map((s, si) => {
              const v = maps[si].get(activeT)
              if (v == null) return null
              return (
                <circle
                  key={s.symbol}
                  cx={x(active)}
                  cy={y(v)}
                  r={s.isBenchmark ? 3.5 : 2.5}
                  fill={s.color}
                />
              )
            })}
          </g>
        )}
      </Box>
    </Box>
  )
}
