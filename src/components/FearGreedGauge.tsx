import { useEffect, useId, useState } from 'react'
import { Box, useMediaQuery, useTheme } from '@mui/material'
import { fontFamilyMono } from '@/theme'

// Geometry of the semicircular scale, in the SVG's own coordinate space.
const CX = 100
const CY = 100
const R = 82
const STROKE = 13

/** Point on the dial's arc for a 0–100 score (left = 0, top = 50, right = 100). */
function pointFor(score: number): [number, number] {
  const alpha = (Math.PI * (100 - score)) / 100 // π at 0 → 0 at 100
  return [CX + R * Math.cos(alpha), CY - R * Math.sin(alpha)]
}

interface Props {
  /** The current Fear & Greed score, 0–100. */
  score: number
  /** The band label to sit under the number, e.g. "Extreme Fear". */
  label: string
  /** Max rendered width in px. Defaults to the full 260; pass a smaller value
   *  for a compact inline dial (e.g. the hero's market snapshot). */
  maxWidth?: number
}

/**
 * The Fear & Greed dial — the home page's signature "market mood" read. A single
 * smooth semicircular scale that runs red (fear) → grey (neutral) → green (greed)
 * as one gradient, with a rounded marker knob riding the arc at the current score
 * and the number in the well. Pure SVG on a fixed `viewBox` (the number and label
 * are `<text>` inside it), so the whole thing scales as one unit from phone to
 * desktop and never needs pixel-positioning; every colour is a theme token, so it
 * reads in light and dark. On mount the marker sweeps up from the fearful end to
 * its resting position — one deliberate motion moment, skipped for reduced motion.
 */
export default function FearGreedGauge({
  score,
  label,
  maxWidth = 260,
}: Props) {
  const theme = useTheme()
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const uid = useId().replace(/:/g, '')
  const gradientId = `fg-scale-${uid}`
  const shadowId = `fg-marker-${uid}`
  const clamped = Math.max(0, Math.min(100, score))

  // Marker rests at `restDeg`; it starts at the fearful extreme (−90°) and eases
  // to rest once mounted, unless reduced motion is preferred.
  const restDeg = (clamped / 100) * 180 - 90
  const [settled, setSettled] = useState(reduceMotion)
  useEffect(() => {
    if (reduceMotion) return
    const id = requestAnimationFrame(() => setSettled(true))
    return () => cancelAnimationFrame(id)
  }, [reduceMotion])
  const markerDeg = settled ? restDeg : -90

  // The colour the number + marker take, on CNN's bands: extreme fear (red) →
  // fear (amber) → neutral (grey) → greed (light green) → extreme greed (emerald).
  const activeColor =
    clamped < 25
      ? theme.palette.error.main
      : clamped < 45
        ? theme.palette.warning.main
        : clamped <= 55
          ? theme.palette.text.secondary
          : clamped <= 75
            ? theme.palette.success.light
            : theme.palette.success.main

  // The full scale, left (0) to right (100), drawn over the top.
  const [x0, y0] = pointFor(0)
  const [x100, y100] = pointFor(100)
  const scalePath = `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${R} ${R} 0 0 1 ${x100.toFixed(2)} ${y100.toFixed(2)}`
  const [mx, my] = [CX, CY - R] // marker rests at the top; the group rotates it

  return (
    <Box
      component="svg"
      viewBox="0 0 200 118"
      role="img"
      aria-label={`Fear and Greed Index: ${Math.round(clamped)}, ${label}`}
      sx={{
        display: 'block',
        width: '100%',
        maxWidth,
        height: 'auto',
        mx: 'auto',
      }}
    >
      <defs>
        {/* Horizontal gradient across the arc's bounding box: the left end reads
            red (fear), the top-centre grey (neutral), the right end emerald
            (greed) — exactly how the scale sweeps. */}
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={theme.palette.error.main} />
          <stop offset="27%" stopColor={theme.palette.warning.main} />
          <stop offset="50%" stopColor={theme.palette.text.disabled} />
          <stop offset="73%" stopColor={theme.palette.success.light} />
          <stop offset="100%" stopColor={theme.palette.success.main} />
        </linearGradient>
        <filter id={shadowId} x="-60%" y="-60%" width="220%" height="220%">
          <feDropShadow
            dx="0"
            dy="1.5"
            stdDeviation="1.5"
            floodColor="#000"
            floodOpacity="0.3"
          />
        </filter>
      </defs>

      {/* A faint channel behind the scale gives the arc a little depth. */}
      <path
        d={scalePath}
        fill="none"
        stroke={theme.palette.divider}
        strokeWidth={STROKE + 5}
        strokeLinecap="round"
      />
      {/* The scale itself: one smooth red→grey→green gradient. */}
      <path
        d={scalePath}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={STROKE}
        strokeLinecap="round"
      />

      {/* Marker knob riding the arc at the current score. It sits at the top of
          the arc and the group rotates it into position, so the mount sweep is a
          simple rotation from the fearful end. */}
      <g
        style={{
          transform: `rotate(${markerDeg}deg)`,
          transformOrigin: `${CX}px ${CY}px`,
          transition: reduceMotion
            ? undefined
            : 'transform 1.1s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        <circle
          cx={mx}
          cy={my}
          r={9.5}
          fill={theme.palette.background.paper}
          stroke={activeColor}
          strokeWidth={3.5}
          filter={`url(#${shadowId})`}
        />
        <circle cx={mx} cy={my} r={3.5} fill={activeColor} />
      </g>

      {/* The score and band label live in the well of the dial, part of the
          scaling artwork. The number picks up the active band colour. */}
      <text
        x={CX}
        y={74}
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily={fontFamilyMono}
        fontSize={34}
        fontWeight={700}
        fill={activeColor}
        style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}
      >
        {Math.round(clamped)}
      </text>
      <text
        x={CX}
        y={102}
        textAnchor="middle"
        fontFamily={theme.typography.fontFamily}
        fontSize={11.5}
        fontWeight={700}
        letterSpacing="0.08em"
        fill={theme.palette.text.primary}
      >
        {label.toUpperCase()}
      </text>
    </Box>
  )
}
