import { Box, Card, CardContent, Stack, Typography } from '@mui/material'
import {
  cashFlowVerdict,
  profitabilityVerdict,
  type CashFlowVerdict,
  type IndustryPeStance,
  type ProfitabilityVerdict,
} from '@/lib/api'
import {
  priceBand,
  qualityBand,
  type PriceBand,
  type QualityBand,
} from '@/lib/fundamentals'
import { heroWash } from '@/components/heroWash'
import InfoHint from '@/components/InfoHint'

// The shared neutral amber the verdict cards land on for a middle call, so the
// summary's "Mixed" / "Fair" reads in the same colour as the cards beneath it.
const AMBER = '#fbbf24'

// The one-word answer for each quality band, in the same green→amber→red
// language the cards use (better business reads greener).
const QUALITY: Record<QualityBand, { word: string; color: string }> = {
  strong: { word: 'Strong', color: 'success.main' },
  solid: { word: 'Solid', color: 'success.main' },
  mixed: { word: 'Mixed', color: AMBER },
  weak: { word: 'Weak', color: 'error.main' },
}

// The one-word answer for each price band — cheaper reads green, richer red, in
// step with "green = cheap" down the rest of the tab.
const PRICE: Record<PriceBand, { word: string; color: string }> = {
  discount: { word: 'Cheap', color: 'success.main' },
  fair: { word: 'Fair', color: AMBER },
  premium: { word: 'Premium', color: 'error.main' },
  mixed: { word: 'Mixed', color: AMBER },
}

// Per-verdict chip colour, mirroring each source card so a chip here matches the
// verdict pill on the card below it.
const PROFIT_COLOR: Record<ProfitabilityVerdict, string> = {
  'Highly Profitable': 'success.main',
  Profitable: 'success.main',
  'Marginally Profitable': AMBER,
  Unprofitable: 'error.main',
}
const CASH_COLOR: Record<CashFlowVerdict, string> = {
  'Cash Rich': 'success.main',
  'Cash Generative': 'success.main',
  'Thin Free Cash': AMBER,
  'Cash Burning': 'error.main',
}
// The two valuation reads share the three-way stance but label it differently —
// against peers vs. against the stock's own past — so the chip says which anchor.
const STANCE_COLOR: Record<IndustryPeStance, string> = {
  below: 'success.main',
  in_line: AMBER,
  above: 'error.main',
}
const PEER_LABEL: Record<IndustryPeStance, string> = {
  below: 'Below peers',
  in_line: 'In line',
  above: 'Above peers',
}
const HISTORY_LABEL: Record<IndustryPeStance, string> = {
  below: 'Below its avg',
  in_line: 'In its range',
  above: 'Above its avg',
}

type Chip = { label: string; color: string }

/** A small verdict pill — the evidence behind a panel's one-word answer, tinted
 *  to match the card it comes from. */
function VerdictChip({ label, color }: Chip) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        px: 1,
        py: 0.35,
        borderRadius: 999,
        border: '1px solid',
        borderColor: color,
        color,
        bgcolor: 'action.hover',
        fontSize: '0.72rem',
        fontWeight: 600,
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </Box>
  )
}

/** One of the two questions: the eyebrow, the big colour-coded answer, the
 *  contributing verdict chips, and a muted note on what fed the read. Falls back
 *  to an em dash and a "not enough data" note when nothing grades. */
function QuestionPanel({
  question,
  answer,
  answerColor,
  chips,
  basis,
  emptyNote,
}: {
  question: string
  answer: string
  answerColor: string
  chips: Chip[]
  basis: string
  emptyNote: string
}) {
  const graded = chips.length > 0
  return (
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography
        sx={{
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontSize: '0.68rem',
          fontWeight: 600,
          color: 'text.secondary',
        }}
      >
        {question}
      </Typography>
      <Typography
        sx={{
          mt: 0.5,
          fontWeight: 700,
          lineHeight: 1,
          letterSpacing: '-0.01em',
          fontSize: { xs: '1.6rem', sm: '1.75rem' },
          color: graded ? answerColor : 'text.secondary',
        }}
      >
        {answer}
      </Typography>
      {graded ? (
        <>
          <Stack
            direction="row"
            spacing={0}
            useFlexGap
            sx={{ mt: 1.25, flexWrap: 'wrap', gap: 0.75 }}
          >
            {chips.map((c) => (
              <VerdictChip key={c.label} label={c.label} color={c.color} />
            ))}
          </Stack>
          <Typography
            variant="caption"
            sx={{ display: 'block', mt: 1, color: 'text.secondary' }}
          >
            {basis}
          </Typography>
        </>
      ) : (
        <Typography
          variant="caption"
          sx={{ display: 'block', mt: 1, color: 'text.secondary' }}
        >
          {emptyNote}
        </Typography>
      )}
    </Box>
  )
}

/**
 * The read that heads the Fundamentals tab: fundamentals boil down to two
 * questions — is this a good *business*, and is the *price* fair? — and this
 * answers both by folding the same verdicts the cards below compute into one
 * word each, with the contributing verdicts shown as chips so the summary and
 * the evidence never disagree. Quality rides the ticker card's metrics (instant);
 * the price read fills in as the two best-effort valuation queries land. Renders
 * nothing only when neither question can be graded at all.
 */
export default function FundamentalsSummary({
  netMargin,
  fcfYield,
  industryStance,
  historyStance,
}: {
  netMargin: number | null
  fcfYield: number | null
  industryStance: IndustryPeStance | null
  historyStance: IndustryPeStance | null
}) {
  const profit = profitabilityVerdict(netMargin)
  const cash = cashFlowVerdict(fcfYield)
  const quality = qualityBand(profit, cash)
  const price = priceBand(industryStance, historyStance)

  // Nothing to summarise — let the tab fall through to its own empty state.
  if (quality == null && price == null) return null

  // The evidence chips behind each answer — only the verdicts that graded.
  const qualityChips: Chip[] = []
  if (profit) qualityChips.push({ label: profit, color: PROFIT_COLOR[profit] })
  if (cash) qualityChips.push({ label: cash, color: CASH_COLOR[cash] })

  const priceChips: Chip[] = []
  if (industryStance) {
    priceChips.push({
      label: PEER_LABEL[industryStance],
      color: STANCE_COLOR[industryStance],
    })
  }
  if (historyStance) {
    priceChips.push({
      label: HISTORY_LABEL[historyStance],
      color: STANCE_COLOR[historyStance],
    })
  }

  const q = quality ? QUALITY[quality] : null
  const p = price ? PRICE[price] : null

  return (
    <Card
      variant="outlined"
      sx={{
        borderColor: 'divider',
        overflow: 'hidden',
        backgroundImage: (theme) => heroWash(theme),
      }}
    >
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
          <Typography variant="h6" component="h2" sx={{ fontWeight: 700 }}>
            Good business, fair price?
          </Typography>
          <InfoHint title="A plain-language summary of the reads below — profitability and cash generation for the business, P/E versus peers and its own history for the price. A rough, non-sector-aware guide, not advice." />
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Fundamentals boil down to two questions.
        </Typography>

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={{ xs: 2, sm: 3 }}
          divider={
            <Box
              aria-hidden
              sx={{
                alignSelf: 'stretch',
                flexShrink: 0,
                bgcolor: 'divider',
                width: { xs: '100%', sm: '1px' },
                height: { xs: '1px', sm: 'auto' },
              }}
            />
          }
          sx={{ mt: 2.5 }}
        >
          <QuestionPanel
            question="Is it a good business?"
            answer={q?.word ?? '—'}
            answerColor={q?.color ?? 'text.secondary'}
            chips={qualityChips}
            basis="From profitability & cash generation"
            emptyNote="Not enough data to judge the business yet."
          />
          <QuestionPanel
            question="Is the price fair?"
            answer={p?.word ?? '—'}
            answerColor={p?.color ?? 'text.secondary'}
            chips={priceChips}
            basis="From P/E vs. peers & its own history"
            emptyNote="Not enough peer or history data to gauge the price yet."
          />
        </Stack>
      </CardContent>
    </Card>
  )
}
