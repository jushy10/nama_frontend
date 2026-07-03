import { Box, Card, CardContent, Stack, Typography } from '@mui/material'
import {
  optionsLevel,
  optionsSentiment,
  type OptionsLevel,
  type OptionsMetrics,
  type OptionsSentiment,
} from '@/lib/api'

// Amber for every unremarkable middle read — matches the RSI/Profitability/PEG
// cards' neutral call.
const MID_COLOR = '#fbbf24' // amber-400

// Traffic-light colour per low/mid/high read: low is the easy green end
// (calm / small / cheap), high the red end (wild / big / pricey).
const LEVEL_COLOR: Record<OptionsLevel, string> = {
  low: 'success.main',
  mid: MID_COLOR,
  high: 'error.main',
}

// One-word calls per gauge, in low → mid → high order, so each figure reads
// at a glance: the word carries the meaning, the colour carries the judgement.
const LEVEL_WORDS: Record<
  'implied_volatility' | 'expected_move' | 'insurance_cost',
  Record<OptionsLevel, string>
> = {
  implied_volatility: { low: 'Calm', mid: 'Normal', high: 'Wild' },
  expected_move: { low: 'Small', mid: 'Medium', high: 'Big' },
  insurance_cost: { low: 'Cheap', mid: 'Fair', high: 'Pricey' },
}

// Per-lean chip label, colour, one-word tile call, and plain-language blurb.
// Calls dominating reads green (upside bets), puts dominating red (downside
// cover), parity amber.
const SENTIMENT: Record<
  OptionsSentiment,
  { label: string; color: string; word: string; blurb: string }
> = {
  optimistic: {
    label: 'Optimistic',
    color: 'success.main',
    word: 'Betting up',
    blurb:
      'Most traders are betting the price goes up — few are paying for ' +
      'protection against a fall.',
  },
  balanced: {
    label: 'Balanced',
    color: MID_COLOR,
    word: 'Split',
    blurb:
      'Up bets and down bets are about even — traders have no clear lean ' +
      'either way.',
  },
  protective: {
    label: 'Protective',
    color: 'error.main',
    word: 'Betting down',
    blurb:
      'Most traders are protecting against a fall rather than betting the ' +
      'price goes up.',
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

/**
 * One figure told three ways: a plain-question label ("How jumpy?"), the
 * number and its one-word call coloured by the same read, then a short plain
 * sentence (with the technical name tucked in) for anyone who wants the
 * grown-up term.
 */
function Stat({
  label,
  value,
  word,
  color,
  sub,
}: {
  label: string
  value: string
  word: string | null
  color?: string
  sub: string
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
      <Stack
        direction="row"
        spacing={1}
        sx={{ mt: 0.5, alignItems: 'baseline' }}
      >
        <Typography
          variant="h5"
          sx={{
            fontWeight: 700,
            color,
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.1,
          }}
        >
          {value}
        </Typography>
        {word && (
          <Typography variant="body2" sx={{ fontWeight: 700, color }}>
            {word}
          </Typography>
        )}
      </Stack>
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
  const ivLevel = optionsLevel('implied_volatility', iv)
  const moveLevel = optionsLevel('expected_move', move)
  const insuranceLevel = optionsLevel('insurance_cost', insurance)
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
              What option traders are pricing in — green is the calm/cheap end,
              red the wild/pricey end
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
                label="How jumpy?"
                value={iv == null ? '—' : fmtPct(iv)}
                word={ivLevel && LEVEL_WORDS.implied_volatility[ivLevel]}
                color={ivLevel ? LEVEL_COLOR[ivLevel] : undefined}
                sub="how much the price is expected to bounce around (implied volatility)"
              />
              <Stat
                label="Possible swing"
                value={move == null ? '—' : fmtMove(move)}
                word={moveLevel && LEVEL_WORDS.expected_move[moveLevel]}
                color={moveLevel ? LEVEL_COLOR[moveLevel] : undefined}
                sub={
                  moveBy
                    ? `up or down by ${fmtDate(moveBy)} (expected move)`
                    : 'up or down, priced by the market (expected move)'
                }
              />
              <Stat
                label="Cost to protect"
                value={insurance == null ? '—' : fmtPct(insurance)}
                word={
                  insuranceLevel && LEVEL_WORDS.insurance_cost[insuranceLevel]
                }
                color={insuranceLevel ? LEVEL_COLOR[insuranceLevel] : undefined}
                sub={
                  insuranceBy
                    ? `to insure your shares until ${fmtDate(insuranceBy)} (put option)`
                    : 'to insure your shares against a fall (put option)'
                }
              />
              <Stat
                label="Up or down bets?"
                value={pcr == null ? '—' : fmtRatio(pcr)}
                word={meta?.word ?? null}
                color={meta?.color}
                sub="down bets traded per up bet today (put/call ratio)"
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
