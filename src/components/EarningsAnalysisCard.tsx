import { Box, Card, CardContent, Stack, Typography } from '@mui/material'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import type { SvgIconComponent } from '@mui/icons-material'
import type { EarningsAnalysis, EarningsTrend } from '@/lib/api'
import { heroWash } from '@/components/heroWash'

// Trend-chip styling keyed by the earnings direction — green when the story is
// accelerating, red when it's slowing, and the brand gold for a steady pace (the
// theme defines only up/green and down/red, so gold fills the neutral middle,
// echoing the amber the other verdict cards use). Accelerating and slowing render
// as solid pills so the read carries at a glance; steady stays outlined gold.
const TREND: Record<
  EarningsTrend,
  {
    label: string
    color: string
    Icon: SvgIconComponent
    filled?: { bg: string; fg: string }
  }
> = {
  accelerating: {
    label: 'Accelerating',
    color: 'success.main',
    Icon: TrendingUpIcon,
    filled: { bg: 'success.main', fg: 'success.contrastText' },
  },
  steady: { label: 'Steady', color: '#d7a739', Icon: TrendingFlatIcon },
  slowing: {
    label: 'Slowing',
    color: 'error.main',
    Icon: TrendingDownIcon,
    filled: { bg: 'error.main', fg: 'error.contrastText' },
  },
}

/**
 * The AI earnings-analysis card — a plain-language read of a company's earnings
 * story that leads the earnings tab: an "AI Analysis" header, a trend chip
 * (accelerating / steady / slowing), the summary, and a few short highlights,
 * with the service's not-advice disclaimer as a footnote. Wears the same blue→gold
 * hero wash as the earnings card beneath it. Purely presentational; the (slow)
 * model call happens upstream in the detail view, which shows this once it lands.
 */
export default function EarningsAnalysisCard({
  analysis,
}: {
  analysis: EarningsAnalysis
}) {
  const trend = TREND[analysis.trend]
  const TrendIcon = trend.Icon

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
                Earnings Analysis
              </Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              An AI-generated overview
            </Typography>
          </Box>

          <Box
            sx={{
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1.5,
              py: 0.5,
              borderRadius: 2,
              border: '1px solid',
              borderColor: trend.color,
              fontWeight: 700,
              fontSize: '0.95rem',
              letterSpacing: '0.02em',
              whiteSpace: 'nowrap',
              ...(trend.filled
                ? { bgcolor: trend.filled.bg, color: trend.filled.fg }
                : { bgcolor: 'action.hover', color: trend.color }),
            }}
          >
            <TrendIcon sx={{ fontSize: 18 }} />
            {trend.label}
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

        {analysis.highlights.length > 0 && (
          <Stack spacing={1.25} sx={{ mt: 2.5 }}>
            {analysis.highlights.map((highlight, i) => (
              <Stack
                key={i}
                direction="row"
                spacing={1.25}
                sx={{ alignItems: 'flex-start' }}
              >
                {/* Center the dot on the first text line: the wrapper is one
                    line-box tall (body1's 1.5 line-height) and centers the dot
                    within it, so the two stay aligned at any font size — a fixed
                    top margin drifts the moment the line-height changes. */}
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
                <Typography variant="body1">{highlight}</Typography>
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
