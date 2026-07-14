import { Box, Card, CardContent, Stack, Typography } from '@mui/material'
import InfoHint from '@/components/InfoHint'
import type { StockTrend, TrendDirection, TrendLeg, TrendReading } from '@/lib/api'

// The house neutral: the same amber the verdict cards use for a middle call.
// A "sideways" horizon and an "unknown" reading both read amber — neither up
// (emerald) nor down (red).
const NEUTRAL = '#fbbf24' // amber-400

// Per-direction word, colour, and the faint tile tint behind it. Colours match
// the candle chart and sector cards (success = up, error = down) so a rising
// trend reads the same green here as a green candle.
const DIRECTION: Record<
  TrendDirection,
  { word: string; color: string; track: string }
> = {
  up: { word: 'Rising', color: 'success.main', track: 'rgba(52,211,153,0.1)' },
  down: { word: 'Falling', color: 'error.main', track: 'rgba(248,113,113,0.1)' },
  sideways: { word: 'Flat', color: NEUTRAL, track: 'rgba(251,191,36,0.1)' },
}

// The combined reading: its label, the colour it carries (the *long-term* trend
// sets the primary hue — an uptrend stays green even while pulling back), and a
// plain-language line explaining what the two horizons together mean.
const READING: Record<
  TrendReading,
  { label: string; color: string; blurb: string }
> = {
  uptrend: {
    label: 'Uptrend',
    color: 'success.main',
    blurb:
      'Both the short- and long-term trend are rising — near-term momentum ' +
      'and the bigger picture agree.',
  },
  uptrend_pullback: {
    label: 'Uptrend · pulling back',
    color: 'success.main',
    blurb:
      'The long-term trend is up, but price has turned down in the short ' +
      'term — a pullback within an uptrend, not a reversal (yet).',
  },
  uptrend_consolidating: {
    label: 'Uptrend · consolidating',
    color: 'success.main',
    blurb:
      'The long-term trend is up while the short term has gone flat — the ' +
      'stock is pausing, not turning over.',
  },
  downtrend: {
    label: 'Downtrend',
    color: 'error.main',
    blurb:
      'Both horizons are falling — near-term weakness in line with the ' +
      'bigger trend.',
  },
  downtrend_bounce: {
    label: 'Downtrend · bouncing',
    color: 'error.main',
    blurb:
      'The long-term trend is down, but price has ticked up short term — a ' +
      'bounce within a downtrend.',
  },
  downtrend_stalling: {
    label: 'Downtrend · stalling',
    color: 'error.main',
    blurb:
      'The long-term trend is down while the short term has flattened — the ' +
      'decline is losing momentum.',
  },
  range_bound: {
    label: 'Range-bound',
    color: NEUTRAL,
    blurb: 'Neither horizon is trending — the stock is drifting sideways.',
  },
  range_turning_up: {
    label: 'Range-bound · turning up',
    color: NEUTRAL,
    blurb:
      'The long-term trend is flat, but the short term has started to rise.',
  },
  range_turning_down: {
    label: 'Range-bound · turning down',
    color: NEUTRAL,
    blurb:
      'The long-term trend is flat, but the short term has started to fall.',
  },
  unknown: {
    label: 'Not enough history',
    color: 'text.secondary',
    blurb:
      'There isn’t enough price history to read the trend at both horizons ' +
      'yet — it fills in as more candles print.',
  },
}

/** A signed percent to one decimal, e.g. 11.37 → "+11.4%", -3.9 → "-3.9%". */
const signedPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`

/** A friendly per-bar unit from the timeframe, so "50-day EMA" reads naturally
 *  on daily bars (the default) and stays sensible on the others. */
function unitLabel(timeframe: string): string {
  if (timeframe.includes('Day')) return 'day'
  if (timeframe.includes('Week')) return 'week'
  if (timeframe.includes('Month')) return 'month'
  if (timeframe.includes('Hour')) return 'hour'
  if (timeframe.includes('Min')) return 'min'
  return 'bar'
}

/**
 * The signature: a right-pointing arrow tilted by the EMA's actual per-bar
 * slope, so steepness — not just direction — reads at a glance. Two of these
 * side by side (long vs short) make a divergence like "up, but pulling back"
 * a single glance. Decorative: the direction word beside it carries the meaning.
 */
function SlopeArrow({
  slopePercent,
  color,
  muted = false,
}: {
  slopePercent: number
  color: string
  muted?: boolean
}) {
  // Scale the per-bar slope to a legible tilt and cap it so a runaway move
  // doesn't point straight up. Negate for SVG's y-down axis (up slope tilts up).
  const angle = Math.max(-58, Math.min(58, slopePercent * 40))
  return (
    <Box
      component="svg"
      viewBox="0 0 40 40"
      aria-hidden="true"
      sx={{
        width: 34,
        height: 34,
        flexShrink: 0,
        color,
        opacity: muted ? 0.5 : 1,
        transform: `rotate(${-angle}deg)`,
        transition: 'transform 400ms ease',
        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
      }}
    >
      <line
        x1="5"
        y1="20"
        x2="30"
        y2="20"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path
        d="M23 12 L32 20 L23 28"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Box>
  )
}

/** One horizon (long or short) as a tile: the slope arrow + direction word lead,
 *  with the EMA that was read, how far it moved, and where price sits relative
 *  to it below. A horizon with too little history to warm its EMA reads muted. */
function HorizonTile({
  label,
  leg,
  unit,
}: {
  label: string
  leg: TrendLeg | null
  unit: string
}) {
  const meta = leg ? DIRECTION[leg.direction] : null
  return (
    <Box
      sx={{
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: meta ? meta.track : 'action.hover',
        p: { xs: 1.75, sm: 2 },
      }}
    >
      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          fontWeight: 600,
          display: 'block',
        }}
      >
        {label}
      </Typography>

      {leg && meta ? (
        <>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 1 }}>
            <SlopeArrow slopePercent={leg.slope_percent} color={meta.color} />
            <Typography
              component="span"
              sx={{ fontWeight: 700, fontSize: '1.15rem', color: meta.color }}
            >
              {meta.word}
            </Typography>
          </Stack>
          <Typography
            variant="caption"
            sx={{ color: 'text.secondary', display: 'block', mt: 0.75 }}
          >
            {leg.period}-{unit} EMA
          </Typography>
          <Typography
            variant="body2"
            sx={{
              mt: 0.25,
              fontWeight: 700,
              color: meta.color,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {signedPct(leg.change_percent)}{' '}
            <Box component="span" sx={{ color: 'text.secondary', fontWeight: 400 }}>
              over {leg.lookback} bars
            </Box>
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: 'text.secondary', display: 'block', mt: 0.75 }}
          >
            Price {leg.price_vs_ema_percent >= 0 ? 'above' : 'below'} this line
            by {Math.abs(leg.price_vs_ema_percent).toFixed(1)}%
          </Typography>
        </>
      ) : (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 1 }}>
          <SlopeArrow slopePercent={0} color="text.secondary" muted />
          <Typography sx={{ color: 'text.secondary', fontWeight: 600 }}>
            Not enough history
          </Typography>
        </Stack>
      )}
    </Box>
  )
}

/**
 * The trend card: a stock's direction at a long and a short horizon, read from
 * the slope of two EMAs, plus the one-line reading that combines them (e.g.
 * "Uptrend · pulling back"). Long-term leads — it's the primary trend and sets
 * the reading's colour; the short term qualifies it.
 */
export default function TrendCard({ trend }: { trend: StockTrend }) {
  const meta = READING[trend.reading] ?? READING.unknown
  const unit = unitLabel(trend.timeframe)
  const hasPrice = trend.reference_price > 0

  return (
    <Card variant="outlined" sx={{ borderColor: 'divider' }}>
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack
          direction="row"
          spacing={2}
          sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}
        >
          <Box>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
              <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
                Trend
              </Typography>
              <InfoHint title="Read from the slope of a short and a long moving average (EMA) off the daily candles. It describes direction — not a price target — and isn’t investment advice." />
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Short vs long-term direction
              {hasPrice ? ` · at $${trend.reference_price.toFixed(2)}` : ''}
            </Typography>
          </Box>

          <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                display: 'block',
              }}
            >
              Reading
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
                fontSize: { xs: '0.8rem', sm: '0.95rem' },
                whiteSpace: 'nowrap',
              }}
            >
              {meta.label}
            </Box>
          </Box>
        </Stack>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          {meta.blurb}
        </Typography>

        {/* Long-term leads (the primary trend); short-term qualifies it. The
            two slope arrows side by side make a divergence read at a glance. */}
        <Box
          sx={{
            mt: 2.5,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
            gap: 1.5,
          }}
        >
          <HorizonTile label="Long-term" leg={trend.long_term} unit={unit} />
          <HorizonTile label="Short-term" leg={trend.short_term} unit={unit} />
        </Box>
      </CardContent>
    </Card>
  )
}
