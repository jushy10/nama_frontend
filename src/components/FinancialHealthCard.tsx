import { Box, Card, CardContent, Stack, Typography } from '@mui/material'
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined'
import {
  leverageVerdict,
  type LeverageVerdict,
  type TickerMetrics,
} from '@/lib/api'
import InfoHint from '@/components/InfoHint'

// Amber for the cautionary middle call — the shared amber the verdict cards use.
const CAUTION = '#fbbf24' // amber-400

// The leverage gauge spans 0 → 3× debt/equity, with the tier cuts at 1 (debt equals
// equity) and 2 — wide enough to seat a debt-free balance sheet and a heavily geared
// one, with 1.0 the line that splits "debt within equity" from "debt above it".
const MIN = 0
const MAX = 3
const SPAN = MAX - MIN

// Per-verdict colour, gauge-track tint, and the plain-language blurb. Low debt reads
// green, a moderate load amber, heavy leverage red — the same colour language as the
// profitability and cash cards.
const VERDICT: Record<
  LeverageVerdict,
  { color: string; track: string; blurb: string }
> = {
  'Low Debt': {
    color: 'success.main',
    track: 'rgba(52,211,153,0.3)',
    blurb:
      'Carries little debt for its size — borrowings sit at or below equity, a ' +
      'conservative balance sheet with room to borrow if it wants to.',
  },
  'Moderate Debt': {
    color: CAUTION,
    track: 'rgba(251,191,36,0.28)',
    blurb:
      'Carries a moderate debt load — more debt than equity, but within the normal ' +
      'range most established companies run.',
  },
  'High Leverage': {
    color: 'error.main',
    track: 'rgba(248,113,113,0.32)',
    blurb:
      'Leans heavily on debt — borrowings run well above equity, which lifts returns ' +
      'in good times and risk in bad ones.',
  },
}

/** A ratio to two decimals, e.g. 1.537 → "1.54". */
const fmtRatio = (n: number) => n.toFixed(2)
/** A debt/equity multiple, e.g. 1.54 → "1.54×". */
const fmtMultiple = (n: number) => `${n.toFixed(2)}×`

// Where a value sits on the 0–3 gauge (clamped to the track).
const pos = (v: number) =>
  ((Math.max(MIN, Math.min(MAX, v)) - MIN) / SPAN) * 100
// A tier edge's track position (1× and 2× cuts).
const edge = (v: number) => ((v - MIN) / SPAN) * 100

/** The 0→3× debt/equity track with its low / moderate / high zones, a bold divider at
 *  1.0 (debt equals equity), and a marker at the current ratio. */
function Gauge({ value, color }: { value: number; color: string }) {
  const parity = edge(1)
  return (
    <Box sx={{ mt: 2 }}>
      <Box
        role="img"
        aria-label={`Debt to equity of ${fmtMultiple(value)}`}
        sx={{
          position: 'relative',
          height: 8,
          borderRadius: 4,
          background: `linear-gradient(to right,
            ${VERDICT['Low Debt'].track} 0%,
            ${VERDICT['Low Debt'].track} ${parity}%,
            ${VERDICT['Moderate Debt'].track} ${parity}%,
            ${VERDICT['Moderate Debt'].track} ${edge(2)}%,
            ${VERDICT['High Leverage'].track} ${edge(2)}%,
            ${VERDICT['High Leverage'].track} 100%)`,
        }}
      >
        {/* debt = equity divider — the line the leverage read pivots on */}
        <Box
          sx={{
            position: 'absolute',
            top: -3,
            left: `${parity}%`,
            transform: 'translateX(-50%)',
            width: 2,
            height: 14,
            borderRadius: 1,
            bgcolor: 'text.secondary',
            opacity: 0.6,
          }}
        />
        {/* current-ratio marker */}
        <Box
          sx={{
            position: 'absolute',
            top: -4,
            left: `${pos(value)}%`,
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
          { v: '0', at: 0, anchor: 'left' as const, sub: null },
          {
            v: '1×',
            at: parity,
            anchor: 'center' as const,
            sub: 'debt = equity',
          },
          { v: '2×', at: edge(2), anchor: 'center' as const, sub: null },
          { v: '3×+', at: 100, anchor: 'right' as const, sub: null },
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
              textAlign: anchor,
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

/** The liquidity read: current ratio on a 0–3 track with a bold 1.0 line (below it,
 *  short-term bills outrun the assets on hand to pay them). A quieter companion to the
 *  leverage gauge — no full scale, just the marker versus the 1.0 divider. */
function LiquidityMeter({ ratio }: { ratio: number }) {
  const tone =
    ratio < 1 ? CAUTION : ratio >= 1.5 ? 'success.main' : 'text.primary'
  const read =
    ratio < 1
      ? 'Short-term bills outrun the cash and assets on hand to cover them.'
      : ratio >= 1.5
        ? 'Comfortably covers its short-term bills from liquid assets.'
        : 'Covers its short-term bills, with a modest cushion.'
  return (
    <Box sx={{ mt: 2 }}>
      <Stack
        direction="row"
        sx={{
          justifyContent: 'space-between',
          alignItems: 'baseline',
          mb: 0.75,
        }}
      >
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Liquidity
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: tone,
            fontVariantNumeric: 'tabular-nums',
            fontWeight: 700,
          }}
        >
          {fmtRatio(ratio)} current ratio
        </Typography>
      </Stack>
      <Box
        role="img"
        aria-label={`Current ratio of ${fmtRatio(ratio)}`}
        sx={{
          position: 'relative',
          height: 6,
          borderRadius: 3,
          bgcolor: 'action.hover',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: -3,
            left: `${edge(1)}%`,
            transform: 'translateX(-50%)',
            width: 2,
            height: 12,
            borderRadius: 1,
            bgcolor: 'text.secondary',
            opacity: 0.6,
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: `${pos(ratio)}%`,
            transform: 'translate(-50%, -50%)',
            width: 10,
            height: 10,
            borderRadius: '50%',
            bgcolor: tone === 'text.primary' ? 'primary.main' : tone,
            boxShadow: (t) => `0 0 0 2px ${t.palette.background.default}`,
          }}
        />
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        {read}
      </Typography>
    </Box>
  )
}

/** A supporting figure as a compact tile — the same treatment the cash card uses. */
function StatTile({ label, value }: { label: string; value: string }) {
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
          fontVariantNumeric: 'tabular-nums',
          fontSize: '1.1rem',
        }}
      >
        {value}
      </Typography>
    </Box>
  )
}

/**
 * The financial-health read for the Fundamentals tab: how sound the balance sheet is.
 * Leads with leverage (debt/equity on a zoned gauge with a verdict and a plain-language
 * blurb), then liquidity (the current ratio against the 1.0 "can it pay its bills" line),
 * with the stock's market volatility (beta) as a supporting figure. Rides the ticker
 * card's `metrics` block; renders nothing when none of the three is covered, so the tab
 * never shows an empty health card.
 */
export default function FinancialHealthCard({
  metrics,
}: {
  metrics: TickerMetrics
}) {
  const { debt_to_equity, current_ratio, beta } = metrics
  if (debt_to_equity == null && current_ratio == null && beta == null)
    return null

  const verdict = leverageVerdict(debt_to_equity)
  const meta = verdict ? VERDICT[verdict] : null

  return (
    <Card variant="outlined" sx={{ borderColor: 'divider' }}>
      <CardContent
        sx={{
          p: { xs: 2, sm: 2.5 },
          '&:last-child': { pb: { xs: 2, sm: 2.5 } },
        }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}
        >
          <Box>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
              <AccountBalanceOutlinedIcon
                fontSize="small"
                sx={{ color: 'secondary.main' }}
              />
              <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
                Financial Health
              </Typography>
              <InfoHint title="Balance-sheet strength: how much debt it carries versus equity (leverage), whether it can cover its short-term bills (liquidity), and how much it swings with the market (beta). A rough, non-sector-aware guide, not advice." />
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Leverage, liquidity &amp; volatility
            </Typography>
          </Box>

          {verdict && meta && (
            <Box
              sx={{
                textAlign: 'right',
                flexShrink: 0,
                alignSelf: { xs: 'flex-start' },
              }}
            >
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
                  fontSize: { xs: '0.8rem', sm: '1rem' },
                  letterSpacing: '0.02em',
                  whiteSpace: 'nowrap',
                }}
              >
                {verdict}
              </Box>
            </Box>
          )}
        </Stack>

        {meta && debt_to_equity != null ? (
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
                  color: meta.color,
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1,
                }}
              >
                {fmtMultiple(debt_to_equity)}
              </Typography>
              <Typography color="text.secondary" sx={{ fontWeight: 500 }}>
                debt to equity
              </Typography>
            </Stack>
            <Gauge value={debt_to_equity} color={meta.color} />
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 1.75 }}
            >
              {meta.blurb}
            </Typography>
          </>
        ) : (
          <Typography color="text.secondary" sx={{ mt: 2 }}>
            {debt_to_equity == null
              ? 'No debt-to-equity figure to gauge leverage.'
              : 'Its equity is negative, so debt to equity isn’t a clean leverage read.'}
          </Typography>
        )}

        {current_ratio != null && <LiquidityMeter ratio={current_ratio} />}

        {beta != null && (
          <Box sx={{ mt: 2 }}>
            <StatTile
              label="Beta (volatility vs market)"
              value={fmtRatio(beta)}
            />
          </Box>
        )}
      </CardContent>
    </Card>
  )
}
