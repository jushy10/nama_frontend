import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from 'react'
import { Box, Stack, Typography, useTheme } from '@mui/material'
import type { Candle, SupportLevel } from '@/lib/api'

// The chart's viewBox width tracks the container's pixel width (measured below),
// so one viewBox unit ≈ one CSS pixel and the in-SVG axis text stays legible on
// a phone instead of being shrunk to ~4px by an 820-unit box crammed into
// ~300px. Until we've measured — and in jsdom, which has no ResizeObserver — we
// fall back to a sensible desktop width. The height is fixed, so with
// `preserveAspectRatio="none"` the chart always renders H px tall.
const W_FALLBACK = 820
const H = 360
const PAD = { top: 14, right: 58, bottom: 26, left: 10 }
const VOL_BAND = 54 // height reserved for the volume histogram at the bottom

// Support-level line weight/opacity by strength — a level the price has turned
// up from more often reads bolder.
const SUPPORT_STRENGTH: Record<
  SupportLevel['strength'],
  { width: number; opacity: number }
> = {
  weak: { width: 1, opacity: 0.5 },
  moderate: { width: 1.25, opacity: 0.68 },
  strong: { width: 1.75, opacity: 0.9 },
}

const fmtPrice = (n: number) =>
  n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

const fmtAxis = (n: number) =>
  n.toLocaleString('en-US', { maximumFractionDigits: n < 10 ? 2 : 0 })

const fmtVol = (n: number | null) =>
  n == null
    ? '—'
    : n.toLocaleString('en-US', {
        notation: 'compact',
        maximumFractionDigits: 1,
      })

function fmtDate(ts: string, intraday: boolean) {
  const d = new Date(ts)
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
  candles: Candle[]
  /** Granularity label, e.g. "1Day"; selects intraday vs. date axis labels. */
  timeframe?: string
  /**
   * Horizontal support levels to overlay. Only those whose price falls inside
   * the chart's visible range are drawn, so long-term levels quietly drop off a
   * zoomed-in view rather than distorting its scale.
   */
  supportLevels?: SupportLevel[]
}

/**
 * A dependency-free candlestick chart: wicks + bodies, a volume histogram band,
 * price/date axes, and a hover crosshair that drives a TradingView-style OHLC
 * legend above the plot. Renders as a single responsive SVG whose viewBox width
 * tracks the container, so it stays sharp and legible down to phone widths.
 */
export default function CandleChart({
  candles,
  timeframe,
  supportLevels,
}: Props) {
  const theme = useTheme()
  const [hover, setHover] = useState<number | null>(null)

  // Measure the container so the viewBox width matches it 1:1 (see W_FALLBACK).
  // useLayoutEffect runs before paint, so the chart never flashes at the
  // fallback width; the ResizeObserver guard keeps jsdom (tests) on the
  // fallback, where there's no layout to measure anyway.
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

  const up = theme.palette.success.main
  const down = theme.palette.error.main
  const grid = theme.palette.divider
  const axis = theme.palette.text.secondary
  const support = theme.palette.info.main
  const supportText = theme.palette.info.contrastText
  const intraday = !!timeframe && /Min|Hour/.test(timeframe)

  const geo = useMemo(() => {
    const plotW = W - PAD.left - PAD.right
    const plotH = H - PAD.top - PAD.bottom
    const priceH = plotH - VOL_BAND

    let max = -Infinity
    let min = Infinity
    let maxVol = 1
    for (const c of candles) {
      if (c.high > max) max = c.high
      if (c.low < min) min = c.low
      if ((c.volume ?? 0) > maxVol) maxVol = c.volume ?? 0
    }
    // Breathe a little above/below the extremes so wicks aren't clipped, but
    // never let the floor go negative — a share price can't be below zero.
    const pad = (max - min) * 0.05 || max * 0.05 || 1
    max += pad
    min = Math.max(0, min - pad)

    const n = candles.length
    const slot = plotW / Math.max(n, 1)
    const bodyW = Math.max(1, Math.min(slot * 0.68, 13))

    const x = (i: number) => PAD.left + slot * (i + 0.5)
    const y = (p: number) =>
      PAD.top + (1 - (p - min) / (max - min || 1)) * priceH
    const volTop = PAD.top + priceH
    const volY = (v: number) => volTop + VOL_BAND - (v / maxVol) * VOL_BAND

    const tickN = 4
    const priceTicks = Array.from(
      { length: tickN + 1 },
      (_, i) => min + ((max - min) * i) / tickN,
    )
    // Fit the date labels to the available width: a phone can only show two or
    // three before they collide, while a wide desktop plot comfortably takes
    // six. Intraday labels carry a time, so they need more room than a bare date.
    const labelW = intraday ? 96 : 64
    const dateN = Math.min(n, 6, Math.max(2, Math.floor(plotW / labelW)))
    const dateIdx = Array.from({ length: dateN }, (_, i) =>
      Math.round((i * (n - 1)) / Math.max(dateN - 1, 1)),
    )

    return { x, y, volY, volTop, slot, bodyW, priceTicks, dateIdx, n, min, max }
  }, [candles, W, intraday])

  if (candles.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
        No candle data for this range.
      </Typography>
    )
  }

  const { x, y, volY, volTop, bodyW, priceTicks, dateIdx, min, max } = geo
  const active = hover ?? candles.length - 1
  const c = candles[active]
  const cUp = c.close >= c.open
  const chgPct = c.open ? ((c.close - c.open) / c.open) * 100 : 0
  const ariaLabel = `Candlestick price chart with ${candles.length} ${
    intraday ? 'intraday' : 'daily'
  } candles and a volume histogram`

  // Map a pointer onto the candle under it (viewBox space). Bound to pointerdown
  // as well as pointermove, so a touch tap — which has no hover — still selects a
  // candle, while a mouse hover or drag scrubs across them.
  function onPoint(e: PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    if (!rect.width) return
    const vbX = ((e.clientX - rect.left) / rect.width) * W
    const i = Math.floor((vbX - PAD.left) / geo.slot)
    setHover(Math.max(0, Math.min(candles.length - 1, i)))
  }

  // Only a mouse leaving clears the readout; on touch there's no pointer to
  // "leave", so a tapped candle stays selected after the finger lifts.
  function onLeave(e: PointerEvent<SVGSVGElement>) {
    if (e.pointerType === 'mouse') setHover(null)
  }

  const legendCell = (label: string, value: string, color?: string) => (
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

  return (
    <Box ref={wrapRef}>
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
          {fmtDate(c.timestamp, intraday)}
        </Box>
        {legendCell('O', fmtPrice(c.open))}
        {legendCell('H', fmtPrice(c.high))}
        {legendCell('L', fmtPrice(c.low))}
        {legendCell('C', fmtPrice(c.close), cUp ? up : down)}
        {legendCell(
          '',
          `${cUp ? '+' : ''}${chgPct.toFixed(2)}%`,
          cUp ? up : down,
        )}
        {legendCell('Vol', fmtVol(c.volume))}
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
          // Let the page scroll vertically through the chart on touch, while a
          // tap selects a candle and a horizontal drag scrubs across them.
          touchAction: 'pan-y',
          cursor: 'crosshair',
        }}
      >
        {/* horizontal gridlines + price axis labels (right) */}
        {priceTicks.map((p, i) => (
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
              {fmtAxis(p)}
            </text>
          </g>
        ))}
        {/* divider above the volume band */}
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={volTop}
          y2={volTop}
          stroke={grid}
          strokeWidth={1}
        />

        {/* date axis labels — pin the first/last to the plot edges and anchor
            them inward so they never spill past the viewBox and get clipped. */}
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
              {fmtDate(candles[i].timestamp, intraday)}
            </text>
          )
        })}

        {/* volume histogram */}
        {candles.map((d, i) => {
          const v = d.volume ?? 0
          return (
            <rect
              key={`v${i}`}
              x={x(i) - bodyW / 2}
              y={volY(v)}
              width={bodyW}
              height={Math.max(0, volTop + VOL_BAND - volY(v))}
              fill={d.close >= d.open ? up : down}
              opacity={0.28}
            />
          )
        })}

        {/* candles: wick + body */}
        {candles.map((d, i) => {
          const color = d.close >= d.open ? up : down
          const yo = y(d.open)
          const yc = y(d.close)
          const top = Math.min(yo, yc)
          const h = Math.max(1, Math.abs(yc - yo))
          return (
            <g key={`c${i}`}>
              <line
                x1={x(i)}
                x2={x(i)}
                y1={y(d.high)}
                y2={y(d.low)}
                stroke={color}
                strokeWidth={1}
              />
              <rect
                x={x(i) - bodyW / 2}
                y={top}
                width={bodyW}
                height={h}
                fill={color}
              />
            </g>
          )
        })}

        {/* support levels: dashed price lines (in view only) with an axis tag,
            drawn over the candles but under the hover crosshair */}
        {supportLevels?.map((lvl, i) => {
          if (lvl.price < min || lvl.price > max) return null
          const yy = y(lvl.price)
          const s = SUPPORT_STRENGTH[lvl.strength] ?? SUPPORT_STRENGTH.weak
          return (
            <g key={`s${i}`} pointerEvents="none">
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={yy}
                y2={yy}
                stroke={support}
                strokeWidth={s.width}
                strokeDasharray="5 4"
                opacity={s.opacity}
              />
              <rect
                x={W - PAD.right + 1}
                y={yy - 7}
                width={PAD.right - 2}
                height={14}
                rx={2}
                fill={support}
                opacity={Math.min(1, s.opacity + 0.2)}
              />
              <text
                x={W - PAD.right + (PAD.right - 1) / 2}
                y={yy + 3.5}
                fontSize={10}
                fontWeight={600}
                fill={supportText}
                textAnchor="middle"
              >
                {fmtPrice(lvl.price)}
              </text>
            </g>
          )
        })}

        {/* hover crosshair */}
        {hover != null && (
          <g pointerEvents="none">
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={PAD.top}
              y2={H - PAD.bottom}
              stroke={axis}
              strokeWidth={1}
              strokeDasharray="3 3"
              opacity={0.6}
            />
          </g>
        )}
      </Box>
    </Box>
  )
}
