import {
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from 'react'
import { Box, Stack, Typography, useTheme } from '@mui/material'
import type { Candle, EmaLine, SupportLevel } from '@/lib/api'
import { fontFamilyMono } from '@/theme'

// The chart's viewBox width tracks the container's pixel width (measured below),
// so one viewBox unit ≈ one CSS pixel and the in-SVG axis text stays legible on
// a phone instead of being shrunk to ~4px by an 820-unit box crammed into
// ~300px. Until we've measured — and in jsdom, which has no ResizeObserver — we
// fall back to a sensible desktop width. The height is fixed per instance (the
// `height` prop, defaulting to H_DEFAULT), so with `preserveAspectRatio="none"`
// the chart always renders that many px tall.
const W_FALLBACK = 820
const H_DEFAULT = 360
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

// EMA overlay line colours, assigned by the line's order (20/50/200). Chosen to
// stay distinct from the up/down candle greens/reds and the info-blue support
// lines, and to read on both the light and dark chart backgrounds.
const EMA_COLORS = ['#f2a63b', '#8b5cf6', '#e0529c', '#2dd4bf', '#eab308']

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
  /**
   * EMA overlay lines (e.g. 20/50/200) to draw on the price axis. Each point is
   * matched to the candle sharing its `time`, so points outside the visible
   * window are simply skipped — a line only draws where the candles exist.
   */
  emaLines?: EmaLine[]
  /**
   * Overall SVG height in px (default {@link H_DEFAULT}, 360). The home band runs
   * a taller chart to match its full-bleed width; the stock page keeps the
   * default. All internal geometry derives from this, so the plot scales while
   * the volume band keeps its fixed height.
   */
  height?: number
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
  emaLines,
  height = H_DEFAULT,
}: Props) {
  const theme = useTheme()
  const [hover, setHover] = useState<number | null>(null)
  // Stable, unique gradient id so several charts on one page don't collide.
  const gradId = useId().replace(/:/g, '')

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
  // Local alias so the geometry below reads the same as before; all of it
  // derives from H, which is now per-instance via the `height` prop.
  const H = height

  const up = theme.palette.success.main
  const down = theme.palette.error.main
  const grid = theme.palette.divider
  const axis = theme.palette.text.secondary
  const support = theme.palette.info.main
  const supportText = theme.palette.info.contrastText
  const intraday = !!timeframe && /Min|Hour/.test(timeframe)

  const geo = useMemo(() => {
    // Reclaim some of the price-axis gutter on a phone so the plot gets more
    // width before the candles compress — the labels don't need 58px there.
    const padRight = W < 420 ? 40 : PAD.right
    const plotW = W - PAD.left - padRight
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

    // EMA overlays: map each point onto the candle sharing its `time` and stitch
    // a polyline across the price axis. Points with no matching candle (outside
    // the visible window) are skipped, so a line starts at the first bar it can.
    const timeToIndex = new Map<number, number>()
    candles.forEach((cd, i) => timeToIndex.set(cd.time, i))
    const emaPaths = (emaLines ?? []).map((line) => {
      const pts: string[] = []
      for (const p of line.points) {
        const i = timeToIndex.get(p.time)
        if (i === undefined) continue
        pts.push(`${x(i).toFixed(2)},${y(p.value).toFixed(2)}`)
      }
      return { period: line.period, d: pts.length ? `M${pts.join('L')}` : '' }
    })

    return {
      x,
      y,
      volY,
      volTop,
      slot,
      bodyW,
      priceTicks,
      dateIdx,
      n,
      min,
      max,
      padRight,
      emaPaths,
    }
  }, [candles, W, H, intraday, emaLines])

  if (candles.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
        No candle data for this range.
      </Typography>
    )
  }

  const {
    x,
    y,
    volY,
    volTop,
    bodyW,
    priceTicks,
    dateIdx,
    min,
    max,
    padRight,
    emaPaths,
  } = geo
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

  // Where a support line should begin: the candle of its most recent swing low
  // (`last_touched`). The level only becomes support once that low forms, so the
  // line starts there and runs right to the axis tag rather than spanning the
  // whole plot. Levels last touched before the visible window begin at the left
  // edge; an unparseable date also falls back to a full-width line.
  const supportStartX = (lastTouched: string) => {
    const t = Date.parse(lastTouched)
    if (Number.isNaN(t)) return PAD.left
    const sec = t / 1000
    if (sec <= candles[0].time) return PAD.left
    const lastIdx = candles.length - 1
    if (sec >= candles[lastIdx].time) return x(lastIdx)
    const idx = candles.findIndex((cd) => cd.time >= sec)
    return x(idx < 0 ? lastIdx : idx)
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

  // A soft close-price area (drawn behind the candles) gives the plot depth; the
  // "last price" marker and neutral crosshair-tag colours orient the eye. The
  // area is tinted by the net move across the visible window.
  const lastIdx = candles.length - 1
  const lastCandle = candles[lastIdx]
  const lastColor = lastCandle.close >= lastCandle.open ? up : down
  const areaColor = lastCandle.close >= candles[0].close ? up : down
  const areaD =
    'M' +
    candles
      .map((d, i) => `${x(i).toFixed(2)},${y(d.close).toFixed(2)}`)
      .join('L') +
    `L${x(lastIdx).toFixed(2)},${volTop.toFixed(2)}L${x(0).toFixed(2)},${volTop.toFixed(2)}Z`
  // Neutral tag: inverted from the surface so it reads in either mode. Dark ink
  // sits on the coloured last-price tag (legible on both the emerald and red).
  const tagBg = theme.palette.text.primary
  const tagText = theme.palette.background.paper
  const priceInk = '#0b0f14'

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
        {emaLines?.map((line, i) =>
          line.points.length ? (
            <Box
              key={`emaleg${line.period}`}
              component="span"
              sx={{
                whiteSpace: 'nowrap',
                color: EMA_COLORS[i % EMA_COLORS.length],
                fontWeight: 600,
              }}
            >
              EMA {line.period}
            </Box>
          ) : null,
        )}
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
        <defs>
          <linearGradient id={`area-${gradId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={areaColor} stopOpacity={0.16} />
            <stop offset="55%" stopColor={areaColor} stopOpacity={0.05} />
            <stop offset="100%" stopColor={areaColor} stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* Soft close-price area — depth behind the candles. */}
        <path d={areaD} fill={`url(#area-${gradId})`} pointerEvents="none" />

        {/* horizontal gridlines + price axis labels (right) */}
        {priceTicks.map((p, i) => (
          <g key={`p${i}`}>
            <line
              x1={PAD.left}
              x2={W - padRight}
              y1={y(p)}
              y2={y(p)}
              stroke={grid}
              strokeWidth={1}
            />
            <text
              x={W - padRight + 6}
              y={y(p) + 3.5}
              fontSize={11}
              fill={axis}
              fontFamily={fontFamilyMono}
            >
              {fmtAxis(p)}
            </text>
          </g>
        ))}
        {/* divider above the volume band */}
        <line
          x1={PAD.left}
          x2={W - padRight}
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
          const tx = isFirst ? PAD.left : isLast ? W - padRight : x(i)
          return (
            <text
              key={`d${i}`}
              x={tx}
              y={H - 8}
              fontSize={11}
              fill={axis}
              textAnchor={anchor}
              fontFamily={fontFamilyMono}
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

        {/* price series: one candlestick per bar — a wick (high→low) and a body
            (open→close), each coloured by its own up/down move. On a dense range
            the bars just render thin rather than collapsing into a trend line. */}
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

        {/* EMA overlay lines, drawn over the price series but under the support
            tags and crosshair. Non-interactive so they never steal the pointer. */}
        {emaPaths.map((e, i) =>
          e.d ? (
            <path
              key={`ema${e.period}`}
              d={e.d}
              fill="none"
              stroke={EMA_COLORS[i % EMA_COLORS.length]}
              strokeWidth={1.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={0.9}
              pointerEvents="none"
            />
          ) : null,
        )}

        {/* support levels: dashed price lines (in view only) with an axis tag,
            drawn over the candles but under the hover crosshair */}
        {supportLevels?.map((lvl, i) => {
          if (lvl.price < min || lvl.price > max) return null
          const yy = y(lvl.price)
          const s = SUPPORT_STRENGTH[lvl.strength] ?? SUPPORT_STRENGTH.weak
          return (
            <g key={`s${i}`} pointerEvents="none">
              <line
                x1={supportStartX(lvl.last_touched)}
                x2={W - padRight}
                y1={yy}
                y2={yy}
                stroke={support}
                strokeWidth={s.width}
                strokeDasharray="5 4"
                opacity={s.opacity}
              />
              <rect
                x={W - padRight + 1}
                y={yy - 7}
                width={padRight - 2}
                height={14}
                rx={2}
                fill={support}
                opacity={Math.min(1, s.opacity + 0.2)}
              />
              <text
                x={W - padRight + (padRight - 1) / 2}
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

        {/* last price: a coloured line + axis tag orienting the eye to "now",
            drawn over the series but under the hover crosshair. */}
        <g pointerEvents="none">
          <line
            x1={PAD.left}
            x2={W - padRight}
            y1={y(lastCandle.close)}
            y2={y(lastCandle.close)}
            stroke={lastColor}
            strokeWidth={1}
            strokeDasharray="2 3"
            opacity={0.75}
          />
          <rect
            x={W - padRight + 1}
            y={y(lastCandle.close) - 8}
            width={padRight - 2}
            height={16}
            rx={3}
            fill={lastColor}
          />
          <text
            x={W - padRight + (padRight - 1) / 2}
            y={y(lastCandle.close) + 3.5}
            fontSize={10.5}
            fontWeight={700}
            fill={priceInk}
            textAnchor="middle"
            fontFamily={fontFamilyMono}
          >
            {fmtPrice(lastCandle.close)}
          </text>
        </g>

        {/* hover crosshair: vertical + horizontal lines through the hovered
            close, a dot on the close, and price + date tags on the axes. */}
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
            <line
              x1={PAD.left}
              x2={W - padRight}
              y1={y(c.close)}
              y2={y(c.close)}
              stroke={axis}
              strokeWidth={1}
              strokeDasharray="3 3"
              opacity={0.45}
            />
            <circle
              cx={x(hover)}
              cy={y(c.close)}
              r={3.2}
              fill={cUp ? up : down}
              stroke={theme.palette.background.paper}
              strokeWidth={1.5}
            />
            {/* price tag on the right axis */}
            <rect
              x={W - padRight + 1}
              y={y(c.close) - 8}
              width={padRight - 2}
              height={16}
              rx={3}
              fill={tagBg}
            />
            <text
              x={W - padRight + (padRight - 1) / 2}
              y={y(c.close) + 3.5}
              fontSize={10.5}
              fontWeight={700}
              fill={tagText}
              textAnchor="middle"
              fontFamily={fontFamilyMono}
            >
              {fmtPrice(c.close)}
            </text>
            {/* date tag pinned to the bottom axis, clamped inside the plot */}
            {(() => {
              const label = fmtDate(c.timestamp, intraday)
              const tw = Math.max(48, label.length * 6.4)
              const tx = Math.max(
                PAD.left + tw / 2,
                Math.min(W - padRight - tw / 2, x(hover)),
              )
              return (
                <>
                  <rect
                    x={tx - tw / 2}
                    y={H - PAD.bottom + 4}
                    width={tw}
                    height={15}
                    rx={3}
                    fill={tagBg}
                  />
                  <text
                    x={tx}
                    y={H - PAD.bottom + 14.5}
                    fontSize={10}
                    fontWeight={600}
                    fill={tagText}
                    textAnchor="middle"
                    fontFamily={fontFamilyMono}
                  >
                    {label}
                  </text>
                </>
              )
            })()}
          </g>
        )}
      </Box>
    </Box>
  )
}
