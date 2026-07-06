import { Box, Card, CardContent, Stack, Typography } from '@mui/material'
import { profitabilityVerdict, type ProfitabilityVerdict } from '@/lib/api'

// Amber for the cautionary "Marginally Profitable" — the shared amber the
// verdict cards use for a neutral middle call.
const THIN_COLOR = '#fbbf24' // amber-400

// The gauge spans -20% → +40% net margin: wide enough to seat a loss-maker and
// a fat-margin software name, with 0 (break-even) the line that splits
// profitable from not.
const MIN = -20
const MAX = 40
const SPAN = MAX - MIN

// Per-verdict colour, gauge-track tint, and the plain-language blurb. Profit
// reads green (deepening with the margin), break-even-ish amber, a loss red.
const VERDICT: Record<
  ProfitabilityVerdict,
  { color: string; track: string; blurb: string }
> = {
  'Highly Profitable': {
    color: 'success.main',
    track: 'rgba(52,211,153,0.45)',
    blurb:
      'Keeps more than 20¢ of profit on every dollar of sales — an ' +
      'exceptional net margin with plenty of cushion.',
  },
  Profitable: {
    color: 'success.main',
    track: 'rgba(52,211,153,0.3)',
    blurb:
      'Keeps a double-digit share of revenue as profit — a healthy, ' +
      'comfortable net margin.',
  },
  'Marginally Profitable': {
    color: THIN_COLOR,
    track: 'rgba(251,191,36,0.28)',
    blurb:
      'Makes money, but keeps under 10¢ per sales dollar — a thin net ' +
      'margin with little room for error.',
  },
  Unprofitable: {
    color: 'error.main',
    track: 'rgba(248,113,113,0.32)',
    blurb:
      'Spends more than it earns — no bottom-line profit on its current ' +
      'revenue.',
  },
}

/** Net margin as a signed percent, e.g. 25.34 → "25.3%", -4.2 → "-4.2%". */
const fmtMargin = (n: number) => `${n.toFixed(1)}%`

// Where a margin sits on the 0–100 track (clamped to the gauge's range).
const pos = (margin: number) =>
  ((Math.max(MIN, Math.min(MAX, margin)) - MIN) / SPAN) * 100
// Track position of a margin edge (break-even at 0, the tier cuts at 10/20).
const edge = (margin: number) => ((margin - MIN) / SPAN) * 100

/** The -20→+40% track with its loss / thin / healthy zones, a bold break-even
 *  divider at 0, and a marker at the current margin. */
function Gauge({ margin, color }: { margin: number; color: string }) {
  const breakeven = edge(0)
  return (
    <Box sx={{ mt: 2.5 }}>
      <Box
        role="img"
        aria-label={`Net margin of ${fmtMargin(margin)}`}
        sx={{
          position: 'relative',
          height: 8,
          borderRadius: 4,
          // Red loss band up to break-even, then amber thin-profit, then greens
          // deepening through the healthy and exceptional zones.
          background: `linear-gradient(to right,
            ${VERDICT.Unprofitable.track} 0%,
            ${VERDICT.Unprofitable.track} ${breakeven}%,
            ${VERDICT['Marginally Profitable'].track} ${breakeven}%,
            ${VERDICT['Marginally Profitable'].track} ${edge(10)}%,
            ${VERDICT.Profitable.track} ${edge(10)}%,
            ${VERDICT.Profitable.track} ${edge(20)}%,
            ${VERDICT['Highly Profitable'].track} ${edge(20)}%,
            ${VERDICT['Highly Profitable'].track} 100%)`,
        }}
      >
        {/* break-even divider — the line that splits profit from loss */}
        <Box
          sx={{
            position: 'absolute',
            top: -3,
            left: `${breakeven}%`,
            transform: 'translateX(-50%)',
            width: 2,
            height: 14,
            borderRadius: 1,
            bgcolor: 'text.secondary',
            opacity: 0.6,
          }}
        />
        {/* current-margin marker */}
        <Box
          sx={{
            position: 'absolute',
            top: -4,
            left: `${pos(margin)}%`,
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
      <Box sx={{ position: 'relative', mt: 0.75, height: 28 }}>
        {[
          { v: `${MIN}%`, at: 0, anchor: 'left' as const, sub: null },
          {
            v: '0%',
            at: breakeven,
            anchor: 'center' as const,
            sub: 'break-even',
          },
          { v: '+20%', at: edge(20), anchor: 'center' as const, sub: null },
          { v: `+${MAX}%`, at: 100, anchor: 'right' as const, sub: null },
        ].map(({ v, at, anchor, sub }) => (
          <Box
            key={v}
            sx={{
              position: 'absolute',
              left: `${at}%`,
              transform:
                anchor === 'left'
                  ? 'none'
                  : anchor === 'right'
                    ? 'translateX(-100%)'
                    : 'translateX(-50%)',
              textAlign:
                anchor === 'left'
                  ? 'left'
                  : anchor === 'right'
                    ? 'right'
                    : 'center',
            }}
          >
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {v}
            </Typography>
            {sub && (
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  color: 'text.secondary',
                  fontSize: '0.6rem',
                  lineHeight: 1,
                }}
              >
                {sub}
              </Typography>
            )}
          </Box>
        ))}
      </Box>
    </Box>
  )
}

/** One secondary margin (gross or operating) as a compact tile: a small label
 *  with the percent below, green when it's positive and red when it isn't, an
 *  em dash when the vendor doesn't cover it. These sit under the headline net
 *  read to round out the profit picture. */
function MarginTile({ label, value }: { label: string; value: number | null }) {
  const color =
    value == null ? 'text.secondary' : value > 0 ? 'success.main' : 'error.main'
  return (
    <Box
      sx={{
        borderRadius: 2,
        bgcolor: 'action.hover',
        px: 1.5,
        py: 1.25,
        textAlign: 'center',
      }}
    >
      <Typography
        variant="caption"
        sx={{ color: 'text.secondary', display: 'block' }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          mt: 0.25,
          fontWeight: 700,
          color,
          fontVariantNumeric: 'tabular-nums',
          fontSize: '1.1rem',
        }}
      >
        {value == null ? '—' : fmtMargin(value)}
      </Typography>
    </Box>
  )
}

export default function ProfitabilityCard({
  netMargin,
  grossMargin = null,
  operatingMargin = null,
}: {
  netMargin: number | null
  grossMargin?: number | null
  operatingMargin?: number | null
}) {
  const verdict = profitabilityVerdict(netMargin)
  const meta = verdict ? VERDICT[verdict] : null

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
              Profitability
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Trailing net margin
            </Typography>
          </Box>

          {verdict && meta && (
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
                Verdict
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
                {verdict}
              </Box>
            </Box>
          )}
        </Stack>

        {netMargin == null ? (
          <Typography color="text.secondary" sx={{ mt: 2 }}>
            No net-margin data to gauge profitability.
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
                {fmtMargin(netMargin)}
              </Typography>
              <Typography color="text.secondary" sx={{ fontWeight: 500 }}>
                net profit margin
              </Typography>
            </Stack>

            <Gauge margin={netMargin} color={meta?.color ?? 'text.secondary'} />

            {meta && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 2.5 }}
              >
                {meta.blurb}
              </Typography>
            )}

            {/* The two margins above the bottom line — gross (after cost of
                goods) and operating (after running costs) — so the fuller
                profit picture reads at a glance, not just the net headline. */}
            <Box
              sx={{
                mt: 2.5,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 1.5,
              }}
            >
              <MarginTile label="Gross margin" value={grossMargin} />
              <MarginTile label="Operating margin" value={operatingMargin} />
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  )
}
