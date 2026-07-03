import { Box, Card, CardContent, Stack, Typography } from '@mui/material'
import {
  optionsSentiment,
  type OptionsMetrics,
  type OptionsSentiment,
} from '@/lib/api'

// Amber for the too-close-to-call "Balanced" lean — matches the DCA/RSI/
// Profitability cards' neutral middle call.
const BALANCED_COLOR = '#fbbf24' // amber-400

// Per-lean chip label, colour and plain-language blurb. Calls dominating reads
// green (upside bets), puts dominating red (downside cover), parity amber.
const SENTIMENT: Record<
  OptionsSentiment,
  { label: string; color: string; blurb: string }
> = {
  optimistic: {
    label: 'Optimistic',
    color: 'success.main',
    blurb:
      "Today's flow leans toward calls — traders are positioning for " +
      'upside rather than paying for protection.',
  },
  balanced: {
    label: 'Balanced',
    color: BALANCED_COLOR,
    blurb:
      "Today's puts and calls are trading in roughly equal measure — no " +
      'clear lean either way.',
  },
  protective: {
    label: 'Protective',
    color: 'error.main',
    blurb:
      "Today's flow leans toward puts — traders are paying up for " +
      'downside cover rather than betting on upside.',
  },
}

/** Plain percent, e.g. 30.01 → "30.0%". */
const fmtPct = (n: number) => `${n.toFixed(1)}%`
/** Signed-either-way swing, e.g. 6.4 → "±6.4%". */
const fmtMove = (n: number) => `±${Math.abs(n).toFixed(1)}%`
/** Ratio with two decimals, e.g. 0.24 → "0.24". */
const fmtRatio = (n: number) => n.toFixed(2)

/** Parse a date-only "YYYY-MM-DD" as a *local* date. Using `new Date(iso)`
 *  treats it as UTC midnight, which formats a day early in negative offsets. */
function parseDateOnly(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** "Jul 31, 2026" — expiry dates can cross a year boundary, so keep the year. */
const fmtDate = (iso: string) =>
  parseDateOnly(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

/** One headline figure with its label above and context line below. */
function Stat({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string
  sub: string
  color?: string
}) {
  return (
    <Box>
      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          display: 'block',
        }}
      >
        {label}
      </Typography>
      <Typography
        variant="h5"
        sx={{
          mt: 0.5,
          fontWeight: 700,
          color,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.1,
        }}
      >
        {value}
      </Typography>
      <Typography
        variant="caption"
        sx={{ color: 'text.secondary', display: 'block', mt: 0.25 }}
      >
        {sub}
      </Typography>
    </Box>
  )
}

export default function OptionsCard({ metrics }: { metrics: OptionsMetrics }) {
  const {
    implied_volatility: iv,
    expected_move_percent: move,
    expected_move_by: moveBy,
    insurance_cost_percent: insurance,
    insurance_expires: insuranceBy,
    put_call_ratio: pcr,
  } = metrics
  const sentiment = optionsSentiment(pcr)
  const meta = sentiment ? SENTIMENT[sentiment] : null
  const empty = iv == null && move == null && insurance == null && pcr == null

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
              Options Market
            </Typography>
            <Typography variant="caption" color="text.secondary">
              What option traders are pricing in
            </Typography>
          </Box>

          {meta && (
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
                Positioning
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
                {meta.label}
              </Box>
            </Box>
          )}
        </Stack>

        {empty ? (
          <Typography color="text.secondary" sx={{ mt: 2 }}>
            No options data — contracts are too thin to price.
          </Typography>
        ) : (
          <>
            <Box
              sx={{
                mt: 3,
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr 1fr',
                  sm: 'repeat(4, 1fr)',
                },
                gap: 2.5,
              }}
            >
              <Stat
                label="Implied volatility"
                value={iv == null ? '—' : fmtPct(iv)}
                sub="annualized, ~1-month at-the-money"
              />
              <Stat
                label="Expected move"
                value={move == null ? '—' : fmtMove(move)}
                sub={moveBy ? `by ${fmtDate(moveBy)}` : 'priced by the market'}
              />
              <Stat
                label="Downside insurance"
                value={insurance == null ? '—' : fmtPct(insurance)}
                sub={
                  insuranceBy
                    ? `to hedge until ${fmtDate(insuranceBy)}`
                    : 'cost of an at-the-money put'
                }
              />
              <Stat
                label="Put/Call ratio"
                value={pcr == null ? '—' : fmtRatio(pcr)}
                sub="today's put vs call volume"
                color={meta?.color}
              />
            </Box>

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
