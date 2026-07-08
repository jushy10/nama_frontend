import { Box, Card, CardContent, Stack, Typography } from '@mui/material'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import type { SvgIconComponent } from '@mui/icons-material'
import type {
  AnalysisBase,
  AnalysisConfidence,
  AnalysisRecommendation,
} from '@/lib/api'

// Amber for the neutral "Hold" call — the theme defines only green (up) and red
// (down), so this fills the cautious middle, the shared amber the other verdict
// cards (AnalystCard, OptionsCard) use for a neutral read.
const HOLD_COLOR = '#fbbf24' // amber-400

// Verdict-chip styling keyed by the buy/hold/sell call — the same green/amber/red
// language the other verdict cards use, so the AI read sits consistently beside
// them. Buy and Sell render as solid pills so the conviction reads at a glance;
// Hold stays outlined amber (the custom amber has no theme contrast pairing).
const VERDICT: Record<
  AnalysisRecommendation,
  { label: string; color: string; filled?: { bg: string; fg: string } }
> = {
  buy: {
    label: 'Buy',
    color: 'success.main',
    filled: { bg: 'success.main', fg: 'success.contrastText' },
  },
  hold: { label: 'Hold', color: HOLD_COLOR },
  sell: {
    label: 'Sell',
    color: 'error.main',
    filled: { bg: 'error.main', fg: 'error.contrastText' },
  },
}

const CONFIDENCE_LABEL: Record<AnalysisConfidence, string> = {
  low: 'Low confidence',
  medium: 'Medium confidence',
  high: 'High confidence',
}

/**
 * A labelled column of plain-language points (the strengths or the risks), each
 * led by an icon in the point's colour. Renders nothing when the list is empty,
 * so a lopsided read (all upside, no stated risks) doesn't leave a bare heading.
 */
function PointList({
  title,
  points,
  color,
  Icon,
}: {
  title: string
  points: string[]
  color: string
  Icon: SvgIconComponent
}) {
  if (points.length === 0) return null
  return (
    <Box>
      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          fontWeight: 700,
        }}
      >
        {title}
      </Typography>
      <Stack spacing={1} sx={{ mt: 1 }}>
        {points.map((point, i) => (
          <Stack
            key={i}
            direction="row"
            spacing={1}
            sx={{ alignItems: 'flex-start' }}
          >
            <Icon fontSize="small" sx={{ color, mt: '2px', flexShrink: 0 }} />
            <Typography variant="body2">{point}</Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  )
}

/**
 * The AI analysis card — a plain-language buy/hold/sell read on a stock or fund:
 * the headline verdict chip and confidence, a short thesis, and the bull/bear
 * points (strengths and risks), with the service's not-advice disclaimer as a
 * footnote. Purely presentational and asset-agnostic — it reads only the shared
 * `AnalysisBase` fields, so both the stock and ETF analyses render through it.
 * The (slow) model call happens upstream in the detail view, which shows this
 * once it lands. Framed as an AI-generated overview.
 */
export default function AnalysisCard({ analysis }: { analysis: AnalysisBase }) {
  const verdict = VERDICT[analysis.recommendation]

  return (
    <Card variant="outlined" sx={{ borderColor: 'divider' }}>
      <CardContent sx={{ p: 3 }}>
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
                AI Analysis
              </Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              An AI-generated overview
            </Typography>
          </Box>

          {verdict && (
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
              <Typography
                variant="caption"
                sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}
              >
                {CONFIDENCE_LABEL[analysis.confidence]}
              </Typography>
            </Box>
          )}
        </Stack>

        {analysis.thesis && (
          <Typography variant="body1" sx={{ mt: 2.5 }}>
            {analysis.thesis}
          </Typography>
        )}

        <Box
          sx={{
            mt: 2.5,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
            gap: 2.5,
          }}
        >
          <PointList
            title="Strengths"
            points={analysis.strengths}
            color="success.main"
            Icon={CheckCircleIcon}
          />
          <PointList
            title="Risks"
            points={analysis.risks}
            color="error.main"
            Icon={WarningAmberIcon}
          />
        </Box>

        {analysis.disclaimer && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mt: 2.5 }}
          >
            {analysis.disclaimer}
          </Typography>
        )}
      </CardContent>
    </Card>
  )
}
