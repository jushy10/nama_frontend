import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Skeleton,
  Stack,
  Typography,
  useTheme,
} from '@mui/material'
import SpeedIcon from '@mui/icons-material/Speed'
import BandHeader from '@/components/BandHeader'
import FearGreedGauge from '@/components/FearGreedGauge'
import { fontFamilyMono } from '@/theme'
import { useMarketSentiment } from '@/hooks/queries'
import type {
  FearGreedSnapshot,
  MarketSentiment as MarketSentimentData,
  VixSnapshot,
} from '@/lib/api'

/** Short date, e.g. "Jul 13" — for the as-of stamps. */
const fmtDate = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** How each VIX regime renders: a coloured chip + a plain-language gloss. Calm
 *  reads green, stress red. */
const REGIME: Record<
  string,
  {
    label: string
    color: 'success' | 'warning' | 'error' | 'default'
    help: string
  }
> = {
  low: {
    label: 'Low',
    color: 'success',
    help: 'Volatility is unusually low — the market is calm.',
  },
  normal: {
    label: 'Normal',
    color: 'success',
    help: 'Volatility is around its typical range.',
  },
  elevated: {
    label: 'Elevated',
    color: 'warning',
    help: 'Volatility is picking up — some nerves showing.',
  },
  high: {
    label: 'High',
    color: 'error',
    help: 'Volatility is high — the market is on edge.',
  },
  extreme: {
    label: 'Extreme',
    color: 'error',
    help: 'Volatility is extreme — fear is running the tape.',
  },
}

/** The label under each trailing Fear & Greed comparison, longest-ago last. */
const COMPARISONS: { key: keyof FearGreedSnapshot; label: string }[] = [
  { key: 'previous_close', label: 'Prev close' },
  { key: 'previous_1_week', label: '1 week' },
  { key: 'previous_1_month', label: '1 month' },
  { key: 'previous_1_year', label: '1 year' },
]

/** The colour a Fear & Greed score paints in, on the same bands as the dial. */
function useFearGreedColor() {
  const theme = useTheme()
  return (score: number): string => {
    if (score < 25) return theme.palette.error.main
    if (score < 45) return theme.palette.warning.main
    if (score <= 55) return theme.palette.text.secondary
    if (score <= 75) return theme.palette.success.light
    return theme.palette.success.main
  }
}

/** A panel's header: a status-coloured dot, a mono title, and the muted source
 *  it comes from — the same shape on both sides so the two reads read as a pair
 *  and every figure stays attributable. */
function PanelHeader({
  title,
  source,
  dotColor,
}: {
  title: string
  source: string
  dotColor: string
}) {
  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{ alignItems: 'center', justifyContent: 'space-between' }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Box
          sx={{
            width: 9,
            height: 9,
            borderRadius: '50%',
            bgcolor: dotColor,
            flexShrink: 0,
          }}
        />
        <Typography
          sx={{
            fontFamily: fontFamilyMono,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.09em',
            fontSize: '0.74rem',
          }}
        >
          {title}
        </Typography>
      </Stack>
      <Typography
        variant="caption"
        sx={{
          color: 'text.disabled',
          fontWeight: 600,
          letterSpacing: '0.02em',
        }}
      >
        {source}
      </Typography>
    </Stack>
  )
}

/** One trailing Fear & Greed reading: its label and the score, in its band colour. */
function Comparison({
  label,
  value,
  color,
}: {
  label: string
  value: number | null
  color: string
}) {
  return (
    <Box>
      <Typography
        variant="caption"
        sx={{
          display: 'block',
          color: 'text.secondary',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          fontSize: '0.62rem',
          mb: 0.25,
        }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          fontFamily: fontFamilyMono,
          fontWeight: 700,
          fontSize: '1.05rem',
          fontVariantNumeric: 'tabular-nums',
          color: value == null ? 'text.secondary' : color,
        }}
      >
        {value == null ? '—' : Math.round(value)}
      </Typography>
    </Box>
  )
}

/** The left panel: the Fear & Greed dial with its trailing then-vs-now scores. */
function FearGreedPanel({ data }: { data: FearGreedSnapshot }) {
  const colorFor = useFearGreedColor()
  const activeColor = colorFor(data.score)
  return (
    <Stack spacing={2.5} sx={{ height: '100%' }}>
      <PanelHeader title="Fear & Greed" source="CNN" dotColor={activeColor} />
      <FearGreedGauge score={data.score} label={data.label} />
      <Box sx={{ mt: 'auto', borderTop: 1, borderColor: 'divider', pt: 1.75 }}>
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            color: 'text.secondary',
            fontWeight: 600,
            mb: 1,
          }}
        >
          Recent readings
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 1.5,
          }}
        >
          {COMPARISONS.map(({ key, label }) => {
            const value = data[key] as number | null
            return (
              <Comparison
                key={key}
                label={label}
                value={value}
                color={value == null ? '' : colorFor(value)}
              />
            )
          })}
        </Box>
      </Box>
    </Stack>
  )
}

/** The right panel: the VIX level, its day move, regime, and a calm→turbulent bar. */
function VixPanel({ data }: { data: VixSnapshot }) {
  const theme = useTheme()
  const regime = REGIME[data.regime] ?? {
    label: data.regime,
    color: 'default' as const,
    help: '',
  }
  const regimeColor =
    regime.color === 'success'
      ? theme.palette.success.main
      : regime.color === 'warning'
        ? theme.palette.warning.main
        : regime.color === 'error'
          ? theme.palette.error.main
          : theme.palette.text.secondary
  // A rising VIX is rising fear, so up reads red and down reads calm-green —
  // the inverse of a price move.
  const changeColor =
    data.change == null
      ? 'text.secondary'
      : data.change > 0
        ? 'error.main'
        : data.change < 0
          ? 'success.main'
          : 'text.secondary'
  const arrow =
    data.change == null || data.change === 0 ? '' : data.change > 0 ? '▲' : '▼'

  // Position on a 0–50 calm→turbulent scale (VIX rarely prints above 50).
  const pct = Math.max(0, Math.min(1, data.value / 50)) * 100

  return (
    <Stack spacing={2.5} sx={{ height: '100%' }}>
      <PanelHeader
        title="Volatility"
        source="VIX · CBOE"
        dotColor={regimeColor}
      />

      {/* The reading + scale, centred in the space beside the dial. */}
      <Stack spacing={2.5} sx={{ flex: 1, justifyContent: 'center' }}>
        <Box>
          <Stack
            direction="row"
            spacing={1.5}
            sx={{ alignItems: 'baseline', flexWrap: 'wrap' }}
          >
            <Typography
              sx={{
                fontFamily: fontFamilyMono,
                fontSize: { xs: '2.75rem', sm: '3.25rem' },
                fontWeight: 700,
                lineHeight: 1,
                letterSpacing: '-0.02em',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {data.value.toFixed(2)}
            </Typography>
            <Chip label={regime.label} color={regime.color} size="small" />
          </Stack>
          {data.change != null && (
            <Typography
              sx={{
                mt: 1,
                fontFamily: fontFamilyMono,
                fontWeight: 600,
                color: changeColor,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {arrow} {data.change > 0 ? '+' : ''}
              {data.change.toFixed(2)}
              {data.change_percent != null &&
                ` (${data.change_percent > 0 ? '+' : ''}${data.change_percent.toFixed(1)}%)`}{' '}
              <Typography
                component="span"
                variant="caption"
                color="text.secondary"
                sx={{ fontFamily: (t) => t.typography.fontFamily }}
              >
                vs prev close
              </Typography>
            </Typography>
          )}
          {regime.help && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ display: 'block', mt: 1, lineHeight: 1.5 }}
            >
              {regime.help}
            </Typography>
          )}
        </Box>

        {/* Calm → turbulent scale with a marker at the current level. */}
        <Box>
          <Box
            sx={{
              position: 'relative',
              height: 8,
              borderRadius: 4,
              background: `linear-gradient(90deg, ${theme.palette.success.main} 0%, ${theme.palette.warning.main} 55%, ${theme.palette.error.main} 100%)`,
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                left: `${pct}%`,
                width: 16,
                height: 16,
                borderRadius: '50%',
                transform: 'translate(-50%, -50%)',
                bgcolor: 'background.paper',
                border: 2,
                borderColor: 'text.primary',
                boxShadow: 1,
              }}
            />
          </Box>
          <Stack
            direction="row"
            sx={{ justifyContent: 'space-between', mt: 0.75 }}
          >
            <Typography variant="caption" color="text.secondary">
              Calm
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Turbulent
            </Typography>
          </Stack>
        </Box>
      </Stack>
    </Stack>
  )
}

/** The loaded card: the two panels side by side (stacked on phones). */
function Loaded({ data }: { data: MarketSentimentData }) {
  const asOf = data.vix?.as_of ?? data.fear_greed?.as_of
  return (
    <Stack spacing={3}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: 'stretch',
          gap: { xs: 3, md: 5 },
        }}
      >
        {data.fear_greed && (
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <FearGreedPanel data={data.fear_greed} />
          </Box>
        )}
        {data.fear_greed && data.vix && (
          <>
            {/* Horizontal rule between the stacked panels on phones; a vertical
                rule between the columns from md up. */}
            <Divider sx={{ display: { xs: 'block', md: 'none' } }} />
            <Divider
              orientation="vertical"
              flexItem
              sx={{ display: { xs: 'none', md: 'block' } }}
            />
          </>
        )}
        {data.vix && (
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <VixPanel data={data.vix} />
          </Box>
        )}
      </Box>

      <Divider />
      <Typography variant="caption" color="text.secondary">
        Fear &amp; Greed is CNN&apos;s index (0 = extreme fear, 100 = extreme
        greed). VIX is CBOE&apos;s volatility index
        {asOf ? `, as of ${fmtDate(asOf)}` : ''}. For information only, not
        financial advice.
      </Typography>
    </Stack>
  )
}

/** Placeholder while the read loads. */
function LoadingState() {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        gap: { xs: 3, md: 5 },
      }}
    >
      <Box sx={{ flex: 1 }}>
        <Stack spacing={2.5} sx={{ alignItems: 'center' }}>
          <Skeleton variant="text" width="100%" height={20} />
          <Skeleton variant="rounded" width={240} height={140} />
          <Skeleton variant="rounded" width="100%" height={44} />
        </Stack>
      </Box>
      <Box sx={{ flex: 1 }}>
        <Stack spacing={2}>
          <Skeleton variant="text" width={140} />
          <Skeleton variant="rounded" width={160} height={52} />
          <Skeleton variant="text" width={200} />
          <Skeleton variant="rounded" width="100%" height={8} />
        </Stack>
      </Box>
    </Box>
  )
}

/**
 * Home-page "Market sentiment" widget: the market's mood at a glance — the CNN
 * Fear & Greed Index on a dial beside the VIX volatility gauge, each in a titled,
 * sourced panel so the two reads balance and every figure stays attributable.
 * Best-effort, like the AI cards: the two legs come from separate keyless
 * sources, so the backend serves whichever it has and the widget renders each
 * leg only when it's present. If both are briefly down (a 502) the query doesn't
 * retry and the whole widget quietly hides rather than showing a broken card.
 */
export default function MarketSentiment() {
  const { data, isLoading, isError } = useMarketSentiment()
  if (isError) return null
  return (
    <Box>
      <BandHeader
        icon={<SpeedIcon />}
        title="Market sentiment"
        subtitle="How the market feels right now: the Fear & Greed Index and the VIX volatility gauge, at a glance."
      />

      <Card variant="outlined" sx={{ borderColor: 'divider' }}>
        <CardContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
          {isLoading || !data ? <LoadingState /> : <Loaded data={data} />}
        </CardContent>
      </Card>
    </Box>
  )
}
