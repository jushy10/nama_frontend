import { Box, Card, CardContent, Stack, Typography } from '@mui/material'
import { dcaVerdict, DCA_TIERS, type DcaAction } from '@/lib/api'

// Amber for the cautionary "Hold" — matches the RSI card's neutral call.
const HOLD_COLOR = '#fbbf24' // amber-400

// The gauge runs 0 → 40% so the 10/20/30 tier edges land on clean quarters.
const MAX_DEPTH = 40

// A drawdown is a *good* thing here, so every buy tier reads green; the track
// tint deepens as the dip — and the conviction — grows.
const ACTION: Record<
  DcaAction,
  { color: string; track: string; blurb: string }
> = {
  'Strong Buy': {
    color: 'success.main',
    track: 'rgba(52,211,153,0.45)',
    blurb:
      'Down 30% or more from its all-time high — a deep discount and the ' +
      'strongest case for averaging in.',
  },
  'Moderate Buy': {
    color: 'success.main',
    track: 'rgba(52,211,153,0.3)',
    blurb:
      'Off 20%+ from its all-time high — a sizeable pullback that warrants ' +
      'stepping up the averaging in.',
  },
  Buy: {
    color: 'success.main',
    track: 'rgba(52,211,153,0.18)',
    blurb:
      'Off 10%+ from its all-time high — a meaningful dip and a reasonable ' +
      'spot to start averaging in.',
  },
  Hold: {
    color: HOLD_COLOR,
    track: 'transparent',
    blurb:
      'Less than 10% below its all-time high — near the top, so wait for a ' +
      'deeper dip before adding.',
  },
}

/** Drawdown depth as an unsigned percent, e.g. -18.88 → "18.9%". */
const fmtDepth = (n: number) => `${Math.abs(n).toFixed(1)}%`
const fmtTier = (n: number) => `${n}%`

/** The 0–40% track with its Buy/Moderate/Strong zones and a current marker. */
function Gauge({ drawdown, color }: { drawdown: number; color: string }) {
  const depth = Math.max(0, Math.min(MAX_DEPTH, -drawdown))
  const pos = (depth / MAX_DEPTH) * 100
  // Tier edges as a percent of the track (10→25%, 20→50%, 30→75%).
  const edge = (d: number) => (d / MAX_DEPTH) * 100
  return (
    <Box sx={{ mt: 2.5 }}>
      <Box
        role="img"
        aria-label={`${fmtDepth(drawdown)} below all-time high`}
        sx={{
          position: 'relative',
          height: 8,
          borderRadius: 4,
          // Neutral "too near the high" band on the left, then greens that
          // deepen through the Buy / Moderate Buy / Strong Buy zones.
          background: (theme) => {
            const mid =
              theme.palette.mode === 'dark'
                ? 'rgba(255,255,255,0.07)'
                : 'rgba(0,0,0,0.06)'
            return `linear-gradient(to right,
            ${mid} 0%,
            ${mid} ${edge(10)}%,
            ${ACTION.Buy.track} ${edge(10)}%,
            ${ACTION.Buy.track} ${edge(20)}%,
            ${ACTION['Moderate Buy'].track} ${edge(20)}%,
            ${ACTION['Moderate Buy'].track} ${edge(30)}%,
            ${ACTION['Strong Buy'].track} ${edge(30)}%,
            ${ACTION['Strong Buy'].track} 100%)`
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
          ...DCA_TIERS.map((t) => ({
            v: t.depth,
            at: edge(t.depth),
            anchor: 'center' as const,
          })),
          { v: MAX_DEPTH, at: 100, anchor: 'right' as const },
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
            {fmtTier(v)}
          </Typography>
        ))}
      </Box>
    </Box>
  )
}

export default function DcaCard({ drawdown }: { drawdown: number | null }) {
  const action = dcaVerdict(drawdown)
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
              DCA Signal
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Drawdown from all-time high
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
                  color: meta.color,
                  bgcolor: 'action.hover',
                  fontWeight: 700,
                  fontSize: '1rem',
                  letterSpacing: '0.02em',
                }}
              >
                {action}
              </Box>
            </Box>
          )}
        </Stack>

        {drawdown == null ? (
          <Typography color="text.secondary" sx={{ mt: 2 }}>
            No all-time-high data to gauge a drawdown.
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
                {fmtDepth(drawdown)}
              </Typography>
              <Typography color="text.secondary" sx={{ fontWeight: 500 }}>
                below all-time high
              </Typography>
            </Stack>

            <Gauge
              drawdown={drawdown}
              color={meta?.color ?? 'text.secondary'}
            />

            {meta && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 2.5 }}
              >
                {meta.blurb}
              </Typography>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
