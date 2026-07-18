import { Box, Card, CardContent, Stack, Typography } from '@mui/material'
import InfoHint from '@/components/InfoHint'
import type {
  StockTrend,
  TrendDirection,
  TrendLeg,
  TrendReading,
} from '@/lib/api'

// The house neutral: the same amber the verdict cards use for a middle call.
// A "sideways" horizon and an "unknown" reading both read amber — neither up
// (emerald) nor down (red).
const NEUTRAL = '#fbbf24' // amber-400

// Per-direction word, colour, and the faint tile tint behind it. Colours match
// the candle chart and sector cards (success = up, error = down) so a rising
// trend reads the same green here as a green candle. Used twice per tile: for the
// horizon's effective direction (the headline) and for its line's own slope.
const DIRECTION: Record<
  TrendDirection,
  { word: string; color: string; track: string }
> = {
  up: { word: 'Rising', color: 'success.main', track: 'rgba(52,211,153,0.1)' },
  down: {
    word: 'Falling',
    color: 'error.main',
    track: 'rgba(248,113,113,0.1)',
  },
  sideways: { word: 'Flat', color: NEUTRAL, track: 'rgba(251,191,36,0.1)' },
}

// The combined reading: its label, the colour it carries (the *long-term* trend
// sets the primary hue — an uptrend stays green even while weakening), and a
// plain-language line explaining what the three horizons together mean. The long
// horizon sets the primary trend, the medium horizon qualifies it (the early
// warning), and the short horizon confirms strength (all aligned = strong_*).
const READING: Record<
  TrendReading,
  { label: string; color: string; blurb: string }
> = {
  strong_uptrend: {
    label: 'Strong uptrend',
    color: 'success.main',
    blurb:
      'All three horizons are rising — near-term, intermediate and long-term ' +
      'momentum all agree.',
  },
  uptrend: {
    label: 'Uptrend',
    color: 'success.main',
    blurb:
      'The long-term trend is up, with the faster horizons leaning the same ' +
      'way.',
  },
  uptrend_pullback: {
    label: 'Uptrend · pulling back',
    color: 'success.main',
    blurb:
      'The long-term trend is up, but price has turned down in the short ' +
      'term — a pullback within an uptrend, not a reversal (yet).',
  },
  uptrend_weakening: {
    label: 'Uptrend · weakening',
    color: 'success.main',
    blurb:
      'The long-term trend is still up, but the intermediate trend has rolled ' +
      'over — an early warning the uptrend may be tiring.',
  },
  strong_downtrend: {
    label: 'Strong downtrend',
    color: 'error.main',
    blurb:
      'All three horizons are falling — near-term, intermediate and long-term ' +
      'weakness all aligned.',
  },
  downtrend: {
    label: 'Downtrend',
    color: 'error.main',
    blurb:
      'The long-term trend is down, with the faster horizons leaning the same ' +
      'way.',
  },
  downtrend_bounce: {
    label: 'Downtrend · bouncing',
    color: 'error.main',
    blurb:
      'The long-term trend is down, but price has ticked up short term — a ' +
      'bounce within a downtrend.',
  },
  downtrend_recovering: {
    label: 'Downtrend · recovering',
    color: 'error.main',
    blurb:
      'The long-term trend is still down, but the intermediate trend has ' +
      'turned up — an early sign the decline may be easing.',
  },
  range_bound: {
    label: 'Range-bound',
    color: NEUTRAL,
    blurb:
      'None of the three horizons is trending — the stock is drifting sideways.',
  },
  range_breaking_up: {
    label: 'Range-bound · breaking up',
    color: NEUTRAL,
    blurb:
      'The long-term trend is flat, but both faster horizons have turned up — ' +
      'the range may be breaking upward.',
  },
  range_breaking_down: {
    label: 'Range-bound · breaking down',
    color: NEUTRAL,
    blurb:
      'The long-term trend is flat, but both faster horizons have turned ' +
      'down — the range may be breaking downward.',
  },
  range_turning_up: {
    label: 'Range-bound · turning up',
    color: NEUTRAL,
    blurb:
      'The long-term trend is flat, but the faster horizons are tilting up.',
  },
  range_turning_down: {
    label: 'Range-bound · turning down',
    color: NEUTRAL,
    blurb:
      'The long-term trend is flat, but the faster horizons are tilting down.',
  },
  unknown: {
    label: 'Not enough history',
    color: 'text.secondary',
    blurb:
      'There isn’t enough price history to read the trend at all three ' +
      'horizons yet — the long-term read needs about 200 bars, and it fills ' +
      'in as more candles print.',
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
 * A right-pointing arrow tilted by the EMA's actual per-bar slope, so the line's
 * steepness — not just its direction — reads at a glance. It describes the *line*,
 * which is why it sits with the "Line +X% over N bars" row rather than the tile's
 * headline: the headline follows price's side of that line, and the two can point
 * opposite ways. Decorative — the percent beside it carries the meaning.
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

/** One horizon (long, medium or short) as a tile.
 *
 *  The direction word leads and comes from the horizon's `effective_direction` —
 *  price's side of the line leading its slope — so the word never contradicts the
 *  "price below this line" figure right under it. Below that, the line's *own*
 *  slope (arrow + percent move) is shown as clearly-labelled detail, which is why
 *  a tile can legitimately read "Falling" over a line that moved +11%: the 20-day
 *  average still points up, but price has dropped through it.
 *
 *  A horizon with too little history to warm its EMA reads muted. */
function HorizonTile({
  label,
  leg,
  unit,
}: {
  label: string
  leg: TrendLeg | null
  unit: string
}) {
  const meta = leg ? DIRECTION[leg.effective_direction] : null
  // The line's own heading, for the slope arrow + the "line moved" row: it can
  // disagree with the headline, and colouring it by its own direction is what
  // makes the divergence legible rather than looking like a bug.
  const slopeMeta = leg ? DIRECTION[leg.direction] : null
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

      {leg && meta && slopeMeta ? (
        <>
          <Typography
            component="p"
            sx={{
              fontWeight: 700,
              fontSize: '1.15rem',
              color: meta.color,
              mt: 1,
            }}
          >
            {meta.word}
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
            Price {Math.abs(leg.price_vs_ema_percent).toFixed(1)}%{' '}
            {leg.price_vs_ema_percent >= 0 ? 'above' : 'below'}{' '}
            <Box
              component="span"
              sx={{ color: 'text.secondary', fontWeight: 400 }}
            >
              the {leg.period}-{unit} line
            </Box>
          </Typography>
          <Stack
            direction="row"
            spacing={0.75}
            sx={{ alignItems: 'center', mt: 1.25 }}
          >
            <SlopeArrow
              slopePercent={leg.slope_percent}
              color={slopeMeta.color}
            />
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              Line{' '}
              <Box
                component="span"
                sx={{ color: slopeMeta.color, fontWeight: 700 }}
              >
                {signedPct(leg.change_percent)}
              </Box>{' '}
              over {leg.lookback} bars
            </Typography>
          </Stack>
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
 * The trend card: a stock's direction at three horizons (long / medium / short),
 * read from the slope of three EMAs, plus the one-line reading that combines them
 * (e.g. "Uptrend · weakening"). Long-term leads — it's the primary trend and sets
 * the reading's colour; the medium term qualifies it (the early warning) and the
 * short term confirms strength.
 */
export default function TrendCard({ trend }: { trend: StockTrend }) {
  const meta = READING[trend.reading] ?? READING.unknown
  const unit = unitLabel(trend.timeframe)
  const hasPrice = trend.reference_price > 0

  return (
    <Card variant="outlined" sx={{ borderColor: 'divider' }}>
      <CardContent
        sx={{
          p: { xs: 2, sm: 2.5 },
          '&:last-child': { pb: { xs: 2, sm: 2.5 } },
        }}
      >
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
              <InfoHint title="Read from three moving averages (EMA) — short, medium and long — off the daily candles. Each horizon takes its direction from which side of its line price is trading on, falling back to the line’s slope when price sits on it. So a horizon can read “Falling” while its line still points up: price has dropped through the average. It describes direction — not a price target — and isn’t investment advice." />
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Short, medium &amp; long-term direction
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

        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.75 }}>
          {meta.blurb}
        </Typography>

        {/* Long-term leads (the primary trend); medium qualifies it (the early
            warning) and short confirms strength. The three slope arrows side by
            side make a divergence read at a glance. */}
        <Box
          sx={{
            mt: 2,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
            gap: 1,
          }}
        >
          <HorizonTile label="Long-term" leg={trend.long_term} unit={unit} />
          <HorizonTile
            label="Medium-term"
            leg={trend.medium_term}
            unit={unit}
          />
          <HorizonTile label="Short-term" leg={trend.short_term} unit={unit} />
        </Box>
      </CardContent>
    </Card>
  )
}
