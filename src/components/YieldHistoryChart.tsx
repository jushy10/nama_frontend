import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from 'react'
import { Box, Stack, Typography, useTheme } from '@mui/material'
import type { YieldHistory } from '@/lib/api'

const W_FALLBACK = 820
const H_NARROW = 400
const H_WIDE = 360
const NARROW_MAX = 480
const PAD = { top: 16, right: 48, bottom: 26, left: 10 }

const fmtDate = (ms: number) =>
  new Date(ms).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: '2-digit',
  })

interface Props {
  history: YieldHistory
}

/**
 * The 2Y and 10Y yields over time as two responsive SVG lines on one axis, with
 * the inverted stretches (2Y above 10Y — the recession-warning shape) shaded so
 * the crossover reads at a glance. A hover crosshair drives a legend showing
 * both yields and the 2s10s spread at that date. Dependency-free, themed off the
 * palette like the app's other line charts.
 */
export default function YieldHistoryChart({ history }: Props) {
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
  const H = W <= NARROW_MAX ? H_NARROW : H_WIDE

  const grid = theme.palette.divider
  const axis = theme.palette.text.secondary
  const colorTwo = theme.palette.primary.main
  const colorTen = theme.palette.secondary.main
  const invertFill =
    theme.palette.mode === 'dark'
      ? 'rgba(248,113,113,0.14)'
      : 'rgba(220,38,38,0.10)'

  const geo = useMemo(() => {
    const plotW = W - PAD.left - PAD.right
    const plotH = H - PAD.top - PAD.bottom
    const two = history.series.find((s) => s.label === '2Y')
    const ten = history.series.find((s) => s.label === '10Y')
    const twoObs = two?.observations ?? []
    const tenObs = ten?.observations ?? []

    // Shared, sorted, de-duped timeline (epoch ms) across both series.
    const times = new Set<number>()
    for (const o of twoObs) times.add(Date.parse(o.date))
    for (const o of tenObs) times.add(Date.parse(o.date))
    const timeline = [...times].sort((a, b) => a - b)
    const slotOf = new Map<number, number>()
    timeline.forEach((t, i) => slotOf.set(t, i))

    const twoMap = new Map<number, number>()
    for (const o of twoObs) twoMap.set(Date.parse(o.date), o.rate)
    const tenMap = new Map<number, number>()
    for (const o of tenObs) tenMap.set(Date.parse(o.date), o.rate)

    let lo = Infinity
    let hi = -Infinity
    for (const r of [...twoMap.values(), ...tenMap.values()]) {
      if (r < lo) lo = r
      if (r > hi) hi = r
    }
    if (!Number.isFinite(lo)) {
      lo = 0
      hi = 1
    }
    const pad = (hi - lo) * 0.08 || 0.5
    lo -= pad
    hi += pad

    const lastSlot = Math.max(timeline.length - 1, 1)
    const x = (i: number) => PAD.left + (i / lastSlot) * plotW
    const y = (r: number) => PAD.top + (1 - (r - lo) / (hi - lo || 1)) * plotH

    const tickN = 4
    const yTicks = Array.from(
      { length: tickN + 1 },
      (_, i) => lo + ((hi - lo) * i) / tickN,
    )
    const labelW = 64
    const dateN = Math.min(
      timeline.length,
      6,
      Math.max(2, Math.floor(plotW / labelW)),
    )
    const dateIdx = Array.from({ length: dateN }, (_, i) =>
      Math.round((i * (timeline.length - 1)) / Math.max(dateN - 1, 1)),
    )

    // Contiguous inverted spans (2Y > 10Y) as [startSlot, endSlot] pairs so we
    // can shade each stretch with one rect.
    const spans: Array<[number, number]> = []
    let start = -1
    timeline.forEach((t, i) => {
      const tv = twoMap.get(t)
      const nv = tenMap.get(t)
      const inv = tv != null && nv != null && tv > nv
      if (inv && start === -1) start = i
      if (!inv && start !== -1) {
        spans.push([start, i - 1])
        start = -1
      }
    })
    if (start !== -1) spans.push([start, timeline.length - 1])

    return {
      x,
      y,
      slotOf,
      yTicks,
      timeline,
      twoMap,
      tenMap,
      dateIdx,
      spans,
      plotW,
      lastSlot,
    }
  }, [history, W, H])

  if (geo.timeline.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
        No yield history available.
      </Typography>
    )
  }

  const { x, y, slotOf, yTicks, timeline, twoMap, tenMap, dateIdx, spans } = geo
  const active = hover ?? timeline.length - 1
  const activeT = timeline[active]
  const twoV = twoMap.get(activeT)
  const tenV = tenMap.get(activeT)
  const spreadV =
    twoV != null && tenV != null ? Number((tenV - twoV).toFixed(2)) : null

  const twoPts = [...twoMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([t, r]) => `${x(slotOf.get(t) ?? 0)},${y(r)}`)
    .join(' ')
  const tenPts = [...tenMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([t, r]) => `${x(slotOf.get(t) ?? 0)},${y(r)}`)
    .join(' ')

  function onPoint(e: PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    if (!rect.width) return
    const vbX = ((e.clientX - rect.left) / rect.width) * W
    const slot = Math.round(((vbX - PAD.left) / geo.plotW) * geo.lastSlot)
    setHover(Math.max(0, Math.min(timeline.length - 1, slot)))
  }
  function onLeave(e: PointerEvent<SVGSVGElement>) {
    if (e.pointerType === 'mouse') setHover(null)
  }

  const legend: Array<{
    key: string
    color: string
    value: number | undefined
  }> = [
    { key: '2Y', color: colorTwo, value: twoV },
    { key: '10Y', color: colorTen, value: tenV },
  ]

  return (
    <Box ref={wrapRef}>
      {/* Legend: hovered date + each yield + the 2s10s spread at that point. */}
      <Box
        sx={{
          color: axis,
          fontSize: '0.78rem',
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
          mb: 0.75,
        }}
      >
        {fmtDate(activeT)}
      </Box>
      <Stack
        direction="row"
        useFlexGap
        sx={{
          flexWrap: 'wrap',
          columnGap: 1.5,
          rowGap: 0.75,
          fontSize: '0.8rem',
          fontWeight: 500,
          mb: 1,
        }}
      >
        {legend.map((l) => (
          <Box
            key={l.key}
            component="span"
            sx={{ whiteSpace: 'nowrap', display: 'inline-flex', gap: 0.5 }}
          >
            <Box
              component="span"
              sx={{
                width: 9,
                height: 9,
                borderRadius: '2px',
                bgcolor: l.color,
                alignSelf: 'center',
              }}
            />
            <Box component="span" sx={{ color: 'text.primary' }}>
              {l.key}
            </Box>
            <Box
              component="span"
              sx={{
                color: 'text.secondary',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {l.value == null ? '—' : `${l.value.toFixed(2)}%`}
            </Box>
          </Box>
        ))}
        <Box
          component="span"
          sx={{ whiteSpace: 'nowrap', display: 'inline-flex', gap: 0.5 }}
        >
          <Box component="span" sx={{ color: 'text.primary' }}>
            2s10s
          </Box>
          <Box
            component="span"
            sx={{
              color:
                spreadV == null
                  ? 'text.secondary'
                  : spreadV < 0
                    ? theme.palette.error.main
                    : theme.palette.success.main,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {spreadV == null
              ? '—'
              : `${spreadV >= 0 ? '+' : ''}${spreadV.toFixed(2)}`}
          </Box>
        </Box>
      </Stack>

      <Box
        component="svg"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Two-year and ten-year US Treasury yields over time; inverted stretches shaded. Latest spread ${
          history.latest_spread ?? '—'
        }`}
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
        {/* shaded inverted stretches (2Y above 10Y) behind everything */}
        {spans.map(([a, b], i) => (
          <rect
            key={`inv${i}`}
            x={x(a)}
            y={PAD.top}
            width={Math.max(x(b) - x(a), 1.5)}
            height={H - PAD.top - PAD.bottom}
            fill={invertFill}
          />
        ))}

        {/* horizontal gridlines + percent axis labels (right) */}
        {yTicks.map((r, i) => (
          <g key={`y${i}`}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(r)}
              y2={y(r)}
              stroke={grid}
              strokeWidth={1}
            />
            <text
              x={W - PAD.right + 6}
              y={y(r) + 3.5}
              fontSize={11}
              fill={axis}
            >
              {r.toFixed(1)}%
            </text>
          </g>
        ))}

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
              {fmtDate(timeline[i])}
            </text>
          )
        })}

        {/* the two yield lines */}
        <polyline
          points={tenPts}
          fill="none"
          stroke={colorTen}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <polyline
          points={twoPts}
          fill="none"
          stroke={colorTwo}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

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
            {twoV != null && (
              <circle cx={x(active)} cy={y(twoV)} r={3} fill={colorTwo} />
            )}
            {tenV != null && (
              <circle cx={x(active)} cy={y(tenV)} r={3} fill={colorTen} />
            )}
          </g>
        )}
      </Box>
    </Box>
  )
}
