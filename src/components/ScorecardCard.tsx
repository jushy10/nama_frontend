import {
  Box,
  Card,
  CardContent,
  Chip,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'

// Confidence on the scorecard is a read of *data coverage* — how much of the
// analysis was backed by real figures — not the model's conviction. The label alone
// ("Medium confidence") doesn't convey that, so an info tooltip spells it out.
const CONFIDENCE_HELP =
  'How much data this read could draw on — higher when more of the figures ' +
  '(fundamentals, earnings, and analyst coverage) were available for this stock.'
import type {
  AnalysisConfidence,
  AnalysisRecommendation,
  AnalysisSection,
  AnalysisStance,
  StockAnalysis,
} from '@/lib/api'

// Amber for a neutral read — the theme defines only green (up) and red (down), so
// this fills the cautious middle, the shared amber the other verdict cards use.
const NEUTRAL_COLOR = '#fbbf24' // amber-400

// Verdict-pill styling keyed by the five-point call — the same green/amber/red
// language the other verdict cards use. The conviction calls render as solid pills so
// the read lands at a glance, with the 'strong' ends a deeper shade than the plain
// buy/sell; Hold stays outlined amber (the neutral middle).
const VERDICT: Record<
  AnalysisRecommendation,
  { label: string; color: string; filled?: { bg: string; fg: string } }
> = {
  strong_buy: {
    label: 'Strong Buy',
    color: 'success.dark',
    filled: { bg: 'success.dark', fg: 'success.contrastText' },
  },
  buy: {
    label: 'Buy',
    color: 'success.main',
    filled: { bg: 'success.main', fg: 'success.contrastText' },
  },
  hold: { label: 'Hold', color: NEUTRAL_COLOR },
  sell: {
    label: 'Sell',
    color: 'error.main',
    filled: { bg: 'error.main', fg: 'error.contrastText' },
  },
  strong_sell: {
    label: 'Strong Sell',
    color: 'error.dark',
    filled: { bg: 'error.dark', fg: 'error.contrastText' },
  },
}

const CONFIDENCE_LABEL: Record<AnalysisConfidence, string> = {
  low: 'Low confidence',
  medium: 'Medium confidence',
  high: 'High confidence',
}

// Per-section favourability colour — a point in the stock's favour reads green, a
// point against red, mixed/unremarkable amber. Mirrors the verdict language so the
// card colours consistently across the overall call and each section.
const STANCE: Record<AnalysisStance, string> = {
  positive: 'success.main',
  neutral: NEUTRAL_COLOR,
  negative: 'error.main',
}

/**
 * The overall verdict pill (Buy/Hold/Sell) with the confidence caption beneath —
 * the card's headline, shared shape with the other AI verdict cards.
 */
function VerdictPill({
  recommendation,
  confidence,
}: {
  recommendation: AnalysisRecommendation
  confidence: AnalysisConfidence
}) {
  const verdict = VERDICT[recommendation]
  if (!verdict) return null
  return (
    <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
      <Box
        sx={{
          display: 'inline-block',
          px: 1.5,
          py: 0.5,
          borderRadius: 2,
          border: '1px solid',
          borderColor: verdict.color,
          fontWeight: 700,
          fontSize: '1rem',
          letterSpacing: '0.02em',
          whiteSpace: 'nowrap',
          ...(verdict.filled
            ? { bgcolor: verdict.filled.bg, color: verdict.filled.fg }
            : { bgcolor: 'action.hover', color: verdict.color }),
        }}
      >
        {verdict.label}
      </Box>
      <Tooltip title={CONFIDENCE_HELP} enterTouchDelay={0}>
        <Typography
          component="span"
          variant="caption"
          aria-label={`${CONFIDENCE_LABEL[confidence]} — ${CONFIDENCE_HELP}`}
          sx={{
            color: 'text.secondary',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 0.25,
            mt: 0.75,
            fontSize: '0.8125rem',
            cursor: 'help',
          }}
        >
          {CONFIDENCE_LABEL[confidence]}
          <InfoOutlinedIcon sx={{ fontSize: 13 }} aria-hidden="true" />
        </Typography>
      </Tooltip>
    </Box>
  )
}

/**
 * One graded section: the facet title, a stance-coloured label pill, the
 * plain-language summary, and the supporting metric chips. The pill and its colour
 * carry the at-a-glance read; the chips carry the figures behind it.
 */
function Section({ section }: { section: AnalysisSection }) {
  const color = STANCE[section.stance] ?? NEUTRAL_COLOR
  return (
    <Box>
      <Stack
        direction="row"
        spacing={1.5}
        sx={{ justifyContent: 'space-between', alignItems: 'center' }}
      >
        <Typography
          variant="subtitle2"
          sx={{ fontWeight: 600, fontSize: '1rem' }}
        >
          {section.title}
        </Typography>
        {section.label && (
          <Box
            sx={{
              flexShrink: 0,
              px: 1.25,
              py: 0.5,
              borderRadius: 1.5,
              border: '1px solid',
              borderColor: color,
              color,
              bgcolor: 'action.hover',
              fontSize: '0.875rem',
              fontWeight: 700,
              whiteSpace: 'nowrap',
            }}
          >
            {section.label}
          </Box>
        )}
      </Stack>

      {section.summary && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 0.75, fontSize: '0.9375rem', lineHeight: 1.55 }}
        >
          {section.summary}
        </Typography>
      )}

      {section.metrics.length > 0 && (
        <Stack
          direction="row"
          spacing={0}
          sx={{ mt: 1, flexWrap: 'wrap', gap: 0.75 }}
        >
          {section.metrics.map((m, i) => (
            <Chip
              key={`${m.label}-${i}`}
              size="small"
              variant="outlined"
              label={`${m.label}: ${m.value}`}
            />
          ))}
        </Stack>
      )}
    </Box>
  )
}

/**
 * The AI stock scorecard — a plain-language buy/hold/sell read broken into graded
 * sections: the headline verdict + confidence, a one-line thesis, then each facet
 * (business quality, valuation, earnings, the analyst view) with its own stance,
 * summary, and supporting figures, over the service's not-advice disclaimer. Purely
 * presentational; the (slow) model call happens upstream in the detail view, which
 * shows this once it lands.
 */
export default function ScorecardCard({
  analysis,
}: {
  analysis: StockAnalysis
}) {
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
              <AutoAwesomeIcon
                fontSize="small"
                sx={{ color: 'primary.main' }}
              />
              <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
                AI Overview Analysis
              </Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              An AI-generated overview
            </Typography>
          </Box>

          <VerdictPill
            recommendation={analysis.recommendation}
            confidence={analysis.confidence}
          />
        </Stack>

        {analysis.thesis && (
          <Typography
            variant="body1"
            sx={{ mt: 2, fontSize: '1.0625rem', lineHeight: 1.6 }}
          >
            {analysis.thesis}
          </Typography>
        )}

        {/* The graded facets in a grid: a single column on phones and narrow
            cards, two columns once the card is wide enough (lg), so the four
            reads sit 2×2 instead of a tall stack — the card no longer towers
            over the snapshot beside it on the Overview tab. */}
        {analysis.sections.length > 0 && (
          <Box
            sx={{
              mt: 2,
              display: 'grid',
              gap: { xs: 2, lg: 2.5 },
              alignItems: 'start',
              gridTemplateColumns: {
                xs: '1fr',
                lg: 'repeat(2, minmax(0, 1fr))',
              },
            }}
          >
            {analysis.sections.map((section) => (
              <Section key={section.key} section={section} />
            ))}
          </Box>
        )}

        {analysis.disclaimer && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mt: 2 }}
          >
            {analysis.disclaimer}
          </Typography>
        )}
      </CardContent>
    </Card>
  )
}
