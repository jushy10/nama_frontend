import { Box, Card, CardContent, Stack, Typography } from '@mui/material'
import {
  optionsLevel,
  optionsSentiment,
  optionsSignal,
  type OptionsLevel,
  type OptionsMetrics,
  type OptionsSentiment,
  type OptionsSignal,
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

// One-word tile call and colour per put/call lean. Calls dominating reads
// green (upside bets), puts dominating red (downside cover), parity amber.
const SENTIMENT: Record<OptionsSentiment, { color: string; word: string }> = {
  optimistic: { color: 'success.main', word: 'Betting up' },
  balanced: { color: MID_COLOR, word: 'Split' },
  protective: { color: 'error.main', word: 'Betting down' },
}

// Per-signal chip colour and plain-language blurb: what today's flow says
// about going long or short. Longs read green, shorts red, no-edge amber.
const SIGNAL: Record<OptionsSignal, { color: string; blurb: string }> = {
  'Go Long': {
    color: 'success.main',
    blurb:
      'Up bets heavily outnumber down bets today — the options flow says ' +
      'this is a good time to go long.',
  },
  'Lean Long': {
    color: 'success.main',
    blurb:
      'Up bets outnumber down bets, but not decisively — the options flow ' +
      'mildly favours going long.',
  },
  Neutral: {
    color: MID_COLOR,
    blurb:
      'Up bets and down bets are about even — the options flow gives no ' +
      'edge for going long or short today.',
  },
  'Lean Short': {
    color: 'error.main',
    blurb:
      'Down bets outnumber up bets, but not decisively — the options flow ' +
      'mildly favours going short.',
  },
  'Go Short': {
    color: 'error.main',
    blurb:
      'Down bets heavily outnumber up bets today — the options flow says ' +
      'this is a good time to go short.',
  },
}

// The signal follows today's flow only — worth saying out loud on a card that
// hands out the words "long" and "short".
const DISCLAIMER =
  "A rough read of one day's options flow — not price analysis, not advice."

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
  const lean = sentiment ? SENTIMENT[sentiment] : null
  const signal = optionsSignal(pcr)
  const call = signal ? SIGNAL[signal] : null
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

          {signal && call && (
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
                Signal
              </Typography>
              <Box
                sx={{
                  mt: 0.5,
                  display: 'inline-block',
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: call.color,
                  color: call.color,
                  bgcolor: 'action.hover',
                  fontWeight: 700,
                  fontSize: '1rem',
                  letterSpacing: '0.02em',
                }}
              >
                {signal}
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
                word={lean?.word ?? null}
                color={lean?.color}
                sub="down bets traded per up bet today (put/call ratio)"
              />
            </Box>

            {call && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 2.5 }}
              >
                {call.blurb} {DISCLAIMER}
              </Typography>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
