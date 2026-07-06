import {
  Box,
  Card,
  CardContent,
  Stack,
  Typography,
  useTheme,
} from '@mui/material'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat'
import type { Theme } from '@mui/material/styles'
import type {
  AnalystRecommendations,
  Recommendation,
  RecommendationTrend,
} from '@/lib/api'

// Amber for the neutral "Hold" call — the theme defines only green (up) and red
// (down), so this fills the cautious middle, the shared amber the verdict cards
// use for a neutral read.
const HOLD_COLOR = '#fbbf24' // amber-400

// Consensus-chip styling keyed by the five-step label — the five-step palette
// shared across the app's verdict chips, so ratings read consistently with the
// other cards. `filled` (the Strong calls) renders a solid pill so the
// strongest conviction reads at a glance.
const CONSENSUS_STYLE: Record<
  Recommendation,
  { color: string; filled?: { bg: string; fg: string } }
> = {
  'Strong Buy': {
    color: 'success.main',
    filled: { bg: 'success.main', fg: 'success.contrastText' },
  },
  Buy: { color: 'success.main' },
  Hold: { color: HOLD_COLOR },
  Sell: { color: 'error.main' },
  'Strong Sell': {
    color: 'error.main',
    filled: { bg: 'error.main', fg: 'error.contrastText' },
  },
}

// The distribution buckets, ordered most → least bullish. The colour resolver
// reads the theme so the green/red shades track dark/light mode; the Strong
// calls take the darker shade, the plain ones the main shade.
const BUCKETS: {
  key: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell'
  label: Recommendation
  color: (t: Theme) => string
}[] = [
  {
    key: 'strong_buy',
    label: 'Strong Buy',
    color: (t) => t.palette.success.dark,
  },
  { key: 'buy', label: 'Buy', color: (t) => t.palette.success.main },
  { key: 'hold', label: 'Hold', color: () => HOLD_COLOR },
  { key: 'sell', label: 'Sell', color: (t) => t.palette.error.main },
  {
    key: 'strong_sell',
    label: 'Strong Sell',
    color: (t) => t.palette.error.dark,
  },
]

const DIRECTION = {
  upgraded: {
    Icon: TrendingUpIcon,
    color: 'success.main',
    text: 'Upgraded from last month',
  },
  downgraded: {
    Icon: TrendingDownIcon,
    color: 'error.main',
    text: 'Downgraded from last month',
  },
  unchanged: {
    Icon: TrendingFlatIcon,
    color: 'text.secondary',
    text: 'Unchanged from last month',
  },
} as const

/** "Jun 2026" from the snapshot's ISO period. Parsed as a *local* date so a
 *  UTC-midnight ISO string doesn't format a day early in negative offsets — the
 *  same care EarningsCard takes with date-only fields. */
function monthLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  })
}

/** The stacked distribution bar: one coloured segment per stance, width ∝ its
 *  share of the analyst count. Zero-count buckets don't show. */
function DistributionBar({ trend }: { trend: RecommendationTrend }) {
  const theme = useTheme()
  const total = trend.total || 1
  return (
    <Box
      role="img"
      aria-label="Analyst rating distribution"
      sx={{
        display: 'flex',
        height: 12,
        borderRadius: 1,
        overflow: 'hidden',
        bgcolor: 'action.hover',
      }}
    >
      {BUCKETS.map((b) => {
        const count = trend[b.key]
        if (count <= 0) return null
        return (
          <Box
            key={b.key}
            sx={{ width: `${(count / total) * 100}%`, bgcolor: b.color(theme) }}
          />
        )
      })}
    </Box>
  )
}

/** Legend beneath the bar: a swatch, the stance label, and its analyst count. */
function Legend({ trend }: { trend: RecommendationTrend }) {
  const theme = useTheme()
  return (
    <Box
      sx={{
        mt: 1.5,
        display: 'grid',
        gridTemplateColumns: { xs: 'repeat(2, auto)', sm: 'repeat(5, auto)' },
        columnGap: 2,
        rowGap: 0.75,
        justifyContent: { xs: 'start', sm: 'space-between' },
      }}
    >
      {BUCKETS.map((b) => (
        <Stack
          key={b.key}
          direction="row"
          spacing={0.75}
          sx={{ alignItems: 'center' }}
        >
          <Box
            sx={{
              width: 10,
              height: 10,
              borderRadius: 0.5,
              bgcolor: b.color(theme),
              flexShrink: 0,
            }}
          />
          <Typography variant="caption" color="text.secondary">
            {b.label}
          </Typography>
          <Typography
            variant="caption"
            sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
          >
            {trend[b.key]}
          </Typography>
        </Stack>
      ))}
    </Box>
  )
}

export default function AnalystCard({
  recommendations,
}: {
  recommendations: AnalystRecommendations
}) {
  const latest = recommendations.latest
  const consensus = latest?.consensus ?? null
  const style = consensus ? CONSENSUS_STYLE[consensus] : null
  const direction = recommendations.direction
    ? DIRECTION[recommendations.direction]
    : null
  const DirectionIcon = direction?.Icon

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
              Analyst Ratings
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {latest
                ? `${latest.total} ${
                    latest.total === 1 ? 'analyst' : 'analysts'
                  } · ${monthLabel(latest.period)}`
                : 'Sell-side consensus'}
            </Typography>
          </Box>

          {consensus && style && (
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
                Consensus
              </Typography>
              <Box
                sx={{
                  mt: 0.5,
                  display: 'inline-block',
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: style.color,
                  fontWeight: 700,
                  fontSize: '1rem',
                  letterSpacing: '0.02em',
                  whiteSpace: 'nowrap',
                  ...(style.filled
                    ? { bgcolor: style.filled.bg, color: style.filled.fg }
                    : { bgcolor: 'action.hover', color: style.color }),
                }}
              >
                {consensus}
              </Box>
            </Box>
          )}
        </Stack>

        {latest && latest.total > 0 ? (
          <>
            <Box sx={{ mt: 2.5 }}>
              <DistributionBar trend={latest} />
              <Legend trend={latest} />
            </Box>
            {direction && DirectionIcon && (
              <Stack
                direction="row"
                spacing={0.75}
                sx={{ mt: 2.5, alignItems: 'center', color: direction.color }}
              >
                <DirectionIcon fontSize="small" />
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {direction.text}
                </Typography>
              </Stack>
            )}
          </>
        ) : (
          <Typography color="text.secondary" sx={{ mt: 2 }}>
            No analyst coverage for this stock.
          </Typography>
        )}
      </CardContent>
    </Card>
  )
}
