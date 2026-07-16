import { Box } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'

/**
 * The inline micro-bars the screener tables draw under their metric figures.
 *
 * Both are purely decorative encodings of a number the cell already states in
 * text, so both are `aria-hidden` — a screen reader gets the figure, not a
 * redundant graphic, and the text stays the single accessible source. They also
 * render no text of their own, which keeps the tables' `getByText` assertions
 * unambiguous.
 */

/** Bar geometry, in px. Thin enough to sit under a figure without competing. */
const BAR_HEIGHT = 3
const TRACK_WIDTH = 52

/**
 * Which accent a magnitude bar draws in. `primary` (brand blue) is the default —
 * "more of this". `secondary` (brand gold) marks a metric where more is a cost,
 * not a win, like an expense ratio: same length encoding, but the colour stops the
 * bar from reading as an endorsement of the priciest fund on the page.
 */
export type BarTone = 'primary' | 'secondary'

/**
 * Which edge the bar's track sits against. `right` matches the tables, whose
 * metric cells are right-aligned; `left` matches the mobile cards, whose metric
 * grid is left-aligned. It's a prop rather than something the caller overrides
 * with a wrapper style because the track sets its own `ml: 'auto'` — an outside
 * override is a specificity race, and the bars silently drifted right on the
 * cards when it lost.
 */
export type BarAlign = 'left' | 'right'

/** Track alignment within its cell. */
const alignSx = (align: BarAlign) =>
  align === 'right' ? { ml: 'auto' } : { mr: 'auto' }

/**
 * A magnitude bar for a size metric (market cap, fund AUM): a track anchored to
 * the cell's right edge, filled left-ward in proportion to `fraction`.
 *
 * Right-anchored because the figure above it is right-aligned — the bar's end and
 * the number's last digit share an edge, so the column reads as one ragged-left
 * shape rather than two competing alignments.
 */
export function MagnitudeBar({
  fraction,
  tone = 'primary',
  align = 'right',
}: {
  fraction: number
  tone?: BarTone
  align?: BarAlign
}) {
  const theme = useTheme()
  if (fraction <= 0) return null
  return (
    <Box
      aria-hidden
      sx={{
        mt: 0.5,
        ...alignSx(align),
        width: TRACK_WIDTH,
        height: BAR_HEIGHT,
        borderRadius: 999,
        bgcolor: alpha(theme.palette.text.primary, 0.06),
        display: 'flex',
        justifyContent: 'flex-end',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          width: `${Math.max(2, fraction * 100)}%`,
          borderRadius: 999,
          bgcolor: alpha(theme.palette[tone].main, 0.55),
        }}
      />
    </Box>
  )
}

/**
 * A diverging bar for a signed metric (YoY growth): a centre-baselined track
 * where a gain fills right in success green and a loss fills left in error red.
 *
 * The centre line is the zero anchor, so a column of these reads as a single
 * up/down spine — the shape of the page's growth at a glance. Colour carries the
 * direction here only as reinforcement: the cell's text above already prints an
 * explicit `+`/`-` sign, so the meaning never rests on colour alone.
 */
export function GrowthBar({
  fraction,
  align = 'right',
}: {
  fraction: number
  align?: BarAlign
}) {
  const theme = useTheme()
  if (fraction === 0) return null
  const up = fraction > 0
  const width = Math.max(2, Math.abs(fraction) * 50)
  return (
    <Box
      aria-hidden
      sx={{
        position: 'relative',
        mt: 0.5,
        ...alignSx(align),
        width: TRACK_WIDTH,
        height: BAR_HEIGHT,
        borderRadius: 999,
        bgcolor: alpha(theme.palette.text.primary, 0.06),
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          // Both halves start at the centre; a gain grows right, a loss grows left.
          left: up ? '50%' : undefined,
          right: up ? undefined : '50%',
          width: `${width}%`,
          borderRadius: 999,
          bgcolor: alpha(
            up ? theme.palette.success.main : theme.palette.error.main,
            0.7,
          ),
        }}
      />
    </Box>
  )
}
