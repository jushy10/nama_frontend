import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from 'react'
import { Box, useTheme } from '@mui/material'
import type { YieldCurve } from '@/lib/api'

// Same responsive-SVG approach as CandleChart / PerformanceComparisonChart: the
// viewBox width tracks the container's pixel width (measured below) so axis text
// stays legible down to phone widths, with a desktop fallback until we've
// measured (and in jsdom, which has no ResizeObserver).
const W_FALLBACK = 820
const H = 340
const PAD = { top: 20, right: 22, bottom: 36, left: 46 }

// The two tenors the story is about — always dotted + labelled on the curve.
const EMPHASISED = new Set(['2Y', '10Y'])

interface Props {
  curve: YieldCurve
}

/**
 * The par-yield curve as one responsive SVG line across maturities (1M → 30Y),
 * shortest on the left. Tenors are spaced evenly (ordinal) so the short end
 * isn't crushed; the 2Y and 10Y — the pair whose gap defines the 2s10s spread —
 * are emphasised with a dot and value. A hover crosshair reads any maturity.
 * Dependency-free, themed off the palette like the app's other charts.
 */
export default function YieldCurveChart({ curve }: Props) {
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

  const tenors = curve.tenors
  const line = theme.palette.primary.main
  const grid = theme.palette.divider
  const axis = theme.palette.text.secondary
  const fill =
    theme.palette.mode === 'dark'
      ? 'rgba(79,131,230,0.14)'
      : 'rgba(7,55,142,0.08)'

  const geo = useMemo(() => {
    const plotW = W - PAD.left - PAD.right
    const plotH = H - PAD.top - PAD.bottom
    const rates = tenors.map((t) => t.rate)
    let lo = rates.length ? Math.min(...rates) : 0
    let hi = rates.length ? Math.max(...rates) : 1
    const pad = (hi - lo) * 0.18 || 0.5
    lo -= pad
    hi += pad
    const n = tenors.length
    const x = (i: number) =>
      PAD.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW)
    const y = (r: number) => PAD.top + (1 - (r - lo) / (hi - lo || 1)) * plotH
    const tickN = 4
    const yTicks = Array.from(
      { length: tickN + 1 },
      (_, i) => lo + ((hi - lo) * i) / tickN,
    )
    // Even x spacing → pick a label stride so tenor labels never collide, but
    // always keep the first, last, and the emphasised 2Y/10Y.
    const labelStride = Math.max(1, Math.ceil(n / Math.floor(plotW / 44)))
    return { x, y, yTicks, plotW, n, lo, labelStride }
  }, [tenors, W])

  if (tenors.length === 0) return null

  const { x, y, yTicks, lo, labelStride } = geo
  const linePts = tenors.map((t, i) => `${x(i)},${y(t.rate)}`).join(' ')
  const areaPts = `${x(0)},${y(lo)} ${linePts} ${x(tenors.length - 1)},${y(lo)}`
  const active = hover

  function onPoint(e: PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    if (!rect.width) return
    const vbX = ((e.clientX - rect.left) / rect.width) * W
    const i = Math.round(((vbX - PAD.left) / geo.plotW) * (geo.n - 1))
    setHover(Math.max(0, Math.min(geo.n - 1, i)))
  }
  function onLeave(e: PointerEvent<SVGSVGElement>) {
    if (e.pointerType === 'mouse') setHover(null)
  }

  const ariaLabel = `US Treasury yield curve from ${tenors[0].label} to ${
    tenors[tenors.length - 1].label
  }, ${curve.two_year ?? '—'}% at 2 years and ${curve.ten_year ?? '—'}% at 10 years`

  return (
    <Box ref={wrapRef}>
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
        {/* horizontal gridlines + percent axis labels (left) */}
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
            <text x={4} y={y(r) + 3.5} fontSize={11} fill={axis}>
              {r.toFixed(1)}%
            </text>
          </g>
        ))}

        {/* area under the curve, then the curve itself */}
        <polyline points={areaPts} fill={fill} stroke="none" />
        <polyline
          points={linePts}
          fill="none"
          stroke={line}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* tenor markers + x labels; emphasise 2Y & 10Y with a value */}
        {tenors.map((t, i) => {
          const emph = EMPHASISED.has(t.label)
          const showLabel =
            emph || i === 0 || i === geo.n - 1 || i % labelStride === 0
          return (
            <g key={t.label}>
              {emph && (
                <>
                  <circle cx={x(i)} cy={y(t.rate)} r={4.5} fill={line} />
                  <text
                    x={x(i)}
                    y={y(t.rate) - 10}
                    fontSize={12}
                    fontWeight={600}
                    fill={theme.palette.text.primary}
                    textAnchor="middle"
                  >
                    {t.rate.toFixed(2)}%
                  </text>
                </>
              )}
              {showLabel && (
                <text
                  x={x(i)}
                  y={H - 12}
                  fontSize={11}
                  fill={emph ? theme.palette.text.primary : axis}
                  fontWeight={emph ? 600 : 400}
                  textAnchor="middle"
                >
                  {t.label}
                </text>
              )}
            </g>
          )
        })}

        {/* hover crosshair + readout for any maturity */}
        {active != null && (
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
            <circle
              cx={x(active)}
              cy={y(tenors[active].rate)}
              r={3.5}
              fill={line}
            />
            <text
              x={Math.min(
                Math.max(x(active), PAD.left + 34),
                W - PAD.right - 34,
              )}
              y={PAD.top + 2}
              fontSize={12}
              fontWeight={600}
              fill={theme.palette.text.primary}
              textAnchor="middle"
            >
              {tenors[active].label} · {tenors[active].rate.toFixed(2)}%
            </text>
          </g>
        )}
      </Box>
    </Box>
  )
}
