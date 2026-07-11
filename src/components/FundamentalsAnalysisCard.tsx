import { Box, Card, CardContent, Stack, Typography } from '@mui/material'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import type { SvgIconComponent } from '@mui/icons-material'
import type {
  AnalysisConfidence,
  FundamentalsAnalysis,
  FundamentalsVerdict,
} from '@/lib/api'
import { heroWash } from '@/components/heroWash'

// Verdict-chip styling keyed by the fundamentals read — green when the business's
// fundamentals clearly hold up, red when they clearly don't, and the brand gold for
// a mixed picture (the theme defines only up/green and down/red, so gold fills the
// neutral middle, echoing the other verdict cards). Strong and weak render as solid
// pills so the read carries at a glance; mixed stays outlined gold.
const VERDICT: Record<
  FundamentalsVerdict,
  {
    label: string
    color: string
    Icon: SvgIconComponent
    filled?: { bg: string; fg: string }
  }
> = {
  strong: {
    label: 'Strong',
    color: 'success.main',
    Icon: TrendingUpIcon,
    filled: { bg: 'success.main', fg: 'success.contrastText' },
  },
  mixed: { label: 'Mixed', color: '#d7a739', Icon: TrendingFlatIcon },
  weak: {
    label: 'Weak',
    color: 'error.main',
    Icon: TrendingDownIcon,
    filled: { bg: 'error.main', fg: 'error.contrastText' },
  },
}

const CONFIDENCE_LABEL: Record<AnalysisConfidence, string> = {
  low: 'Low confidence',
  medium: 'Medium confidence',
  high: 'High confidence',
}

/**
 * The AI fundamentals-analysis card — a plain-language read of a company's
 * fundamentals (profitability, growth, balance-sheet health and how its valuation
 * stacks up) that leads the Fundamentals tab: an "AI Analysis" header, a verdict
 * chip (strong / mixed / weak) with a confidence label, the summary, and a few
 * short findings, with the service's not-advice disclaimer as a footnote. Wears the
 * same blue→gold hero wash as the other AI cards. Purely presentational; the (slow)
 * model call happens upstream in the detail view, which shows this once it lands.
 */
export default function FundamentalsAnalysisCard({
  analysis,
}: {
  analysis: FundamentalsAnalysis
}) {
  const verdict = VERDICT[analysis.verdict]
  const VerdictIcon = verdict.Icon

  return (
    <Card
      variant="outlined"
      sx={{
        position: 'relative',
        overflow: 'hidden',
        borderColor: 'divider',
        backgroundImage: (theme) => heroWash(theme),
      }}
    >
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
                Fundamentals Analysis
              </Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              An AI-generated overview
            </Typography>
          </Box>

          <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                px: 1.5,
                py: 0.5,
                borderRadius: 2,
                border: '1px solid',
                borderColor: verdict.color,
                fontWeight: 700,
                fontSize: '0.95rem',
                letterSpacing: '0.02em',
                whiteSpace: 'nowrap',
                ...(verdict.filled
                  ? { bgcolor: verdict.filled.bg, color: verdict.filled.fg }
                  : { bgcolor: 'action.hover', color: verdict.color }),
              }}
            >
              <VerdictIcon sx={{ fontSize: 18 }} />
              {verdict.label}
            </Box>
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}
            >
              {CONFIDENCE_LABEL[analysis.confidence]}
            </Typography>
          </Box>
        </Stack>

        {analysis.summary && (
          <Typography
            variant="body1"
            sx={{ mt: 2.5, fontSize: '1.1rem', lineHeight: 1.6 }}
          >
            {analysis.summary}
          </Typography>
        )}

        {analysis.findings.length > 0 && (
          <Stack spacing={1.25} sx={{ mt: 2.5 }}>
            {analysis.findings.map((finding, i) => (
              <Stack
                key={i}
                direction="row"
                spacing={1.25}
                sx={{ alignItems: 'flex-start' }}
              >
                {/* Center the dot on the first text line: the wrapper is one
                    line-box tall (body1's 1.5 line-height) and centers the dot
                    within it, so the two stay aligned at any font size. */}
                <Box
                  sx={{
                    flexShrink: 0,
                    height: '1.5em',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <Box
                    sx={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      bgcolor: 'primary.main',
                    }}
                  />
                </Box>
                <Typography variant="body1">{finding}</Typography>
              </Stack>
            ))}
          </Stack>
        )}

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
