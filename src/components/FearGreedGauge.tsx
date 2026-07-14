import { useEffect, useState } from 'react'
import { Box, useMediaQuery, useTheme } from '@mui/material'

/**
 * The five CNN Fear & Greed bands, in score order, each with the theme token it
 * paints with. Red (extreme fear) → amber (fear) → grey (neutral) → light green
 * (greed) → emerald (extreme greed): the sentiment reads left-to-right the way
 * the dial sweeps. Boundaries match CNN's published thresholds.
 */
const ZONES = [
  { from: 0, to: 25, token: 'error' as const },
  { from: 25, to: 45, token: 'fear' as const },
  { from: 45, to: 55, token: 'neutral' as const },
  { from: 55, to: 75, token: 'greed' as const },
  { from: 75, to: 100, token: 'greedStrong' as const },
]

const CX = 100
const CY = 100
const R = 84
const STROKE = 15
// A hair of empty arc between zones reads as five deliberate segments, not one
// smeared rainbow.
const GAP = 1.4

/** Point on the dial's arc for a 0–100 score (left = 0, top = 50, right = 100). */
function pointFor(score: number): [number, number] {
  const alpha = (Math.PI * (100 - score)) / 100 // π at 0 → 0 at 100
  return [CX + R * Math.cos(alpha), CY - R * Math.sin(alpha)]
}

/** SVG arc path along the dial between two scores (over the top, left → right). */
function arcPath(from: number, to: number): string {
  const [x1, y1] = pointFor(from)
  const [x2, y2] = pointFor(to)
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`
}

interface Props {
  /** The current Fear & Greed score, 0–100. */
  score: number
  /** The band label to sit under the number, e.g. "Extreme Fear". */
  label: string
}

/**
 * The Fear & Greed dial — the home page's signature "market mood" read. A
 * five-zone semicircle with a needle at the current score and the number in the
 * well. Pure SVG on a fixed `viewBox` (number and label are `<text>` inside it),
 * so the whole thing scales as one unit from phone to desktop and never needs
 * pixel-positioning; colours are theme tokens, so it reads in light and dark. On
 * mount the needle sweeps up from the fearful end to its resting angle — one
 * deliberate motion moment, skipped when the viewer prefers reduced motion.
 */
export default function FearGreedGauge({ score, label }: Props) {
  const theme = useTheme()
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const clamped = Math.max(0, Math.min(100, score))

  // Needle rests at `restDeg`; it starts at the fearful extreme (−90°) and eases
  // to rest once mounted, unless reduced motion is preferred.
  const restDeg = (clamped / 100) * 180 - 90
  const [settled, setSettled] = useState(reduceMotion)
  useEffect(() => {
    if (reduceMotion) return
    const id = requestAnimationFrame(() => setSettled(true))
    return () => cancelAnimationFrame(id)
  }, [reduceMotion])
  const needleDeg = settled ? restDeg : -90

  const colorFor = (token: (typeof ZONES)[number]['token']): string => {
    switch (token) {
      case 'error':
        return theme.palette.error.main
      case 'fear':
        return theme.palette.warning.main
      case 'neutral':
        return theme.palette.text.disabled
      case 'greed':
        return theme.palette.success.light
      case 'greedStrong':
        return theme.palette.success.main
    }
  }

  const activeToken =
    ZONES.find((z) => clamped >= z.from && clamped <= z.to)?.token ?? 'neutral'
  const activeColor = colorFor(activeToken)
  const fontFamily = theme.typography.fontFamily

  return (
    <Box
      component="svg"
      viewBox="0 0 200 122"
      role="img"
      aria-label={`Fear and Greed Index: ${Math.round(clamped)}, ${label}`}
      sx={{
        display: 'block',
        width: '100%',
        maxWidth: 280,
        height: 'auto',
        mx: 'auto',
      }}
    >
      {ZONES.map((z) => (
        <path
          key={z.token}
          d={arcPath(z.from + GAP, z.to - GAP)}
          fill="none"
          stroke={colorFor(z.token)}
          strokeWidth={STROKE}
          strokeLinecap="round"
        />
      ))}

      {/* Needle: drawn pointing up, rotated to the score; eases in on mount. */}
      <g
        style={{
          transform: `rotate(${needleDeg}deg)`,
          transformOrigin: `${CX}px ${CY}px`,
          transition: reduceMotion
            ? undefined
            : 'transform 1.1s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        <line
          x1={CX}
          y1={CY}
          x2={CX}
          y2={CY - (R - STROKE / 2 - 4)}
          stroke={theme.palette.text.primary}
          strokeWidth={3}
          strokeLinecap="round"
        />
      </g>
      <circle cx={CX} cy={CY} r={7} fill={theme.palette.text.primary} />
      <circle cx={CX} cy={CY} r={3} fill={theme.palette.background.paper} />

      {/* The score and band label live in the well of the dial, as part of the
          scaling artwork. */}
      <text
        x={CX}
        y={76}
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily={fontFamily}
        fontSize={30}
        fontWeight={800}
        fill={activeColor}
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {Math.round(clamped)}
      </text>
      <text
        x={CX}
        y={116}
        textAnchor="middle"
        fontFamily={fontFamily}
        fontSize={11}
        fontWeight={700}
        letterSpacing="0.04em"
        fill={theme.palette.text.primary}
      >
        {label}
      </text>
    </Box>
  )
}
