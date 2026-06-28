import { Box, Card, CardContent, Stack, Typography } from '@mui/material'
import {
  rsiVerdict,
  RSI_ACTION_MARGIN,
  type RsiAction,
  type RsiSeries,
} from '@/lib/api'

// Amber for the neutral "Hold" call — the theme only defines green (up) and
// red (down), so this fills the cautionary middle ground between them.
const HOLD_COLOR = '#fbbf24' // amber-400

// RSI gauge track tints (emerald / red), each at two intensities. The deep
// shades mark the Strong Buy/Sell extremes beyond the oversold/overbought
// lines; the lighter shades mark the softer Buy/Sell bands just inside them
// (30–40 and 60–70 with the conventional 30/70 thresholds). Both read on the
// dark and light canvases; the neutral middle is tinted per-mode below.
const GAUGE_ZONE = {
  strongBuy: 'rgba(52,211,153,0.35)',
  buy: 'rgba(52,211,153,0.18)',
  sell: 'rgba(248,113,113,0.18)',
  strongSell: 'rgba(248,113,113,0.35)',
}

// `color` drives the reading, gauge marker, and outlined chip; `filled` (on the
// Strong calls only) renders the chip as a solid pill so the strongest
// conviction reads at a glance. contrastText keeps the label legible in both modes.
const ACTION: Record<
  RsiAction,
  {
    color: string
    filled?: { bg: string; fg: string }
    blurb: (r: RsiSeries) => string
  }
> = {
  'Strong Buy': {
    color: 'success.main',
    filled: { bg: 'success.main', fg: 'success.contrastText' },
    blurb: (r) =>
      `Below ${fmtLevel(r.oversold)}, RSI is deeply oversold — the selloff looks ` +
      `overstretched and primed to rebound.`,
  },
  Buy: {
    color: 'success.main',
    blurb: (r) =>
      `Between ${fmtLevel(r.oversold)} and ${fmtLevel(r.oversold + RSI_ACTION_MARGIN)}, ` +
      `RSI is leaning oversold — selling may be starting to overshoot.`,
  },
  Hold: {
    color: HOLD_COLOR,
    blurb: (r) =>
      `Between ${fmtLevel(r.oversold + RSI_ACTION_MARGIN)} and ` +
      `${fmtLevel(r.overbought - RSI_ACTION_MARGIN)}, RSI shows no strong ` +
      `momentum signal either way.`,
  },
  Sell: {
    color: 'error.main',
    blurb: (r) =>
      `Between ${fmtLevel(r.overbought - RSI_ACTION_MARGIN)} and ` +
      `${fmtLevel(r.overbought)}, RSI is leaning overbought — the run may be ` +
      `getting stretched.`,
  },
  'Strong Sell': {
    color: 'error.main',
    filled: { bg: 'error.main', fg: 'error.contrastText' },
    blurb: (r) =>
      `Above ${fmtLevel(r.overbought)}, RSI is deeply overbought — the rally ` +
      `looks overextended and primed to cool.`,
  },
}

const SIGNAL_LABEL: Record<RsiSeries['signal'], string> = {
  oversold: 'Oversold',
  overbought: 'Overbought',
  neutral: 'Neutral',
}

const fmtLevel = (n: number) => n.toFixed(0)
const fmtRsi = (n: number) => n.toFixed(1)

/** The 0–100 track with its oversold/overbought zones and a current marker. */
function Gauge({ rsi, color }: { rsi: RsiSeries; color: string }) {
  const pos = Math.max(0, Math.min(100, rsi.latest ?? 0))
  return (
    <Box sx={{ mt: 2.5 }}>
      <Box
        role="img"
        aria-label={`RSI ${fmtRsi(rsi.latest ?? 0)} of 100`}
        sx={{
          position: 'relative',
          height: 8,
          borderRadius: 4,
          // Five RSI zones — deep-green Strong Buy, light-green Buy, neutral
          // middle, light-red Sell, deep-red Strong Sell — with the hand-offs
          // pinned to the API's thresholds plus the shared Buy/Sell margin.
          background: (theme) => {
            // Neutral middle band: light tint on the dark canvas, dark tint
            // on the light one. Green/red zones read fine in both modes.
            const mid =
              theme.palette.mode === 'dark'
                ? 'rgba(255,255,255,0.07)'
                : 'rgba(0,0,0,0.06)'
            const buyEdge = rsi.oversold + RSI_ACTION_MARGIN
            const sellEdge = rsi.overbought - RSI_ACTION_MARGIN
            return `linear-gradient(to right,
            ${GAUGE_ZONE.strongBuy} 0%,
            ${GAUGE_ZONE.strongBuy} ${rsi.oversold}%,
            ${GAUGE_ZONE.buy} ${rsi.oversold}%,
            ${GAUGE_ZONE.buy} ${buyEdge}%,
            ${mid} ${buyEdge}%,
            ${mid} ${sellEdge}%,
            ${GAUGE_ZONE.sell} ${sellEdge}%,
            ${GAUGE_ZONE.sell} ${rsi.overbought}%,
            ${GAUGE_ZONE.strongSell} ${rsi.overbought}%,
            ${GAUGE_ZONE.strongSell} 100%)`
          },
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: -4,
            left: `${pos}%`,
            transform: 'translateX(-50%)',
            width: 3,
            height: 16,
            borderRadius: 1,
            bgcolor: color,
            boxShadow: (theme) =>
              `0 0 0 2px ${theme.palette.background.default}`,
          }}
        />
      </Box>
      <Box sx={{ position: 'relative', mt: 0.75, height: 16 }}>
        {[
          { v: 0, at: 0, anchor: 'left' as const },
          { v: rsi.oversold, at: rsi.oversold, anchor: 'center' as const },
          { v: rsi.overbought, at: rsi.overbought, anchor: 'center' as const },
          { v: 100, at: 100, anchor: 'right' as const },
        ].map(({ v, at, anchor }) => (
          <Typography
            key={v}
            variant="caption"
            sx={{
              position: 'absolute',
              left: `${at}%`,
              transform:
                anchor === 'left'
                  ? 'none'
                  : anchor === 'right'
                    ? 'translateX(-100%)'
                    : 'translateX(-50%)',
              color: 'text.secondary',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {fmtLevel(v)}
          </Typography>
        ))}
      </Box>
    </Box>
  )
}

export default function RsiCard({ rsi }: { rsi: RsiSeries }) {
  const action = rsiVerdict(rsi)
  const meta = action ? ACTION[action] : null

  return (
    <Card variant="outlined" sx={{ borderColor: 'divider' }}>
      <CardContent sx={{ p: 3 }}>
        <Stack
          direction="row"
          spacing={2}
          sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}
        >
          <Box>
            <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
              RSI
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {rsi.period}-period · {rsi.timeframe.replace(/^1/, '1 ')}
            </Typography>
          </Box>

          {action && meta && (
            <Box sx={{ textAlign: 'right' }}>
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  display: 'block',
                }}
              >
                Recommendation
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
                  fontWeight: 700,
                  fontSize: '1rem',
                  letterSpacing: '0.02em',
                  whiteSpace: 'nowrap',
                  ...(meta.filled
                    ? { bgcolor: meta.filled.bg, color: meta.filled.fg }
                    : { bgcolor: 'action.hover', color: meta.color }),
                }}
              >
                {action}
              </Box>
            </Box>
          )}
        </Stack>

        {rsi.latest == null ? (
          <Typography color="text.secondary" sx={{ mt: 2 }}>
            Not enough price history to compute an RSI reading.
          </Typography>
        ) : (
          <>
            <Stack
              direction="row"
              spacing={1.5}
              sx={{ mt: 2, alignItems: 'baseline' }}
            >
              <Typography
                variant="h3"
                sx={{
                  fontWeight: 700,
                  color: meta?.color,
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1,
                }}
              >
                {fmtRsi(rsi.latest)}
              </Typography>
              <Typography color="text.secondary" sx={{ fontWeight: 500 }}>
                {SIGNAL_LABEL[rsi.signal]}
              </Typography>
            </Stack>

            <Gauge rsi={rsi} color={meta?.color ?? 'text.secondary'} />

            {meta && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 2.5 }}
              >
                {meta.blurb(rsi)}
              </Typography>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
