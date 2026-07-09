import {
  Box,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import { useMarketSummary } from '@/lib/queries'
import type {
  MarketIndexReturn,
  MarketPeriod,
  MarketPeriodName,
  MarketSummary as MarketSummaryData,
  MarketTone,
} from '@/lib/api'

/** Signed percent, e.g. +1.84% / -0.64% — matching SectorPulse's formatting. */
const fmtPct = (n: number | null) =>
  n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`

const moveColor = (n: number | null) =>
  n == null ? 'text.secondary' : n >= 0 ? 'success.main' : 'error.main'

/** How each risk posture renders: a coloured chip + a plain-language gloss. */
const TONE: Record<
  MarketTone,
  { label: string; color: 'success' | 'warning' | 'default'; help: string }
> = {
  risk_on: {
    label: 'Risk-On',
    color: 'success',
    help: 'The market is rising and growth is leading — an appetite for risk.',
  },
  risk_off: {
    label: 'Risk-Off',
    color: 'warning',
    help: 'The market is under pressure or turning defensive — a cautious mood.',
  },
  mixed: {
    label: 'Mixed',
    color: 'default',
    help: 'No clear lean between risk-taking and caution.',
  },
}

/** The heading shown for each timeframe, longest-lookback first. */
const PERIOD_LABEL: Record<MarketPeriodName, string> = {
  year: 'Past year',
  month: 'Past month',
  week: 'Past week',
}

/** One index's move over a timeframe: its name and the coloured, real return. */
function IndexReturn({ r }: { r: MarketIndexReturn }) {
  return (
    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'baseline' }}>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {r.name}
      </Typography>
      <Typography
        sx={{
          fontWeight: 700,
          color: moveColor(r.change_percent),
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {fmtPct(r.change_percent)}
      </Typography>
    </Stack>
  )
}

/** One timeframe: its label + each index's real return, then the AI's note. */
function PeriodRow({ p }: { p: MarketPeriod }) {
  return (
    <Box>
      <Stack
        direction="row"
        spacing={1.5}
        sx={{
          alignItems: 'baseline',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
        }}
      >
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'text.secondary',
          }}
        >
          {PERIOD_LABEL[p.period] ?? p.period}
        </Typography>
        <Stack
          direction="row"
          spacing={{ xs: 2, sm: 3 }}
          sx={{ flexWrap: 'wrap', flexShrink: 0 }}
        >
          {p.indexes.map((r) => (
            <IndexReturn key={r.symbol} r={r} />
          ))}
        </Stack>
      </Stack>
      {p.note && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {p.note}
        </Typography>
      )}
    </Box>
  )
}

/** The loaded card body: tone + summary, the period rows, then the disclaimer. */
function Loaded({ data }: { data: MarketSummaryData }) {
  const tone = TONE[data.tone] ?? TONE.mixed
  return (
    <Stack spacing={2.5}>
      <Box>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          sx={{
            alignItems: { xs: 'flex-start', sm: 'center' },
            justifyContent: 'space-between',
            mb: 1,
          }}
        >
          <Chip label={tone.label} color={tone.color} size="small" />
          <Typography variant="caption" color="text.secondary">
            {tone.help}
          </Typography>
        </Stack>
        <Typography sx={{ fontSize: '1.05rem', lineHeight: 1.6 }}>
          {data.summary}
        </Typography>
      </Box>

      <Divider />

      <Stack spacing={2.5}>
        {data.periods.map((p) => (
          <PeriodRow key={p.period} p={p} />
        ))}
      </Stack>

      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', pt: 0.5 }}
      >
        {data.disclaimer}
      </Typography>
    </Stack>
  )
}

/** Placeholder while the model read is generating. */
function LoadingState() {
  return (
    <Stack spacing={2}>
      <Skeleton variant="rounded" width={88} height={24} />
      <Skeleton variant="text" width="100%" />
      <Skeleton variant="text" width="85%" />
      <Divider />
      <Stack spacing={2}>
        {[0, 1, 2].map((r) => (
          <Stack key={r} spacing={0.5}>
            <Skeleton variant="text" width={120} />
            <Skeleton variant="text" width="70%" />
          </Stack>
        ))}
      </Stack>
    </Stack>
  )
}

/**
 * Home-page "Market summary" widget: an AI read of how the US market — the
 * S&P 500 and the Nasdaq — has moved over the past year, month and week, with
 * the risk posture those moves imply. Best-effort, like the sector pulse: if the
 * model is briefly unavailable or not configured (a 502/503), the query doesn't
 * retry and the whole widget quietly hides rather than showing a broken card.
 */
export default function MarketSummary() {
  const { data, isLoading, isError } = useMarketSummary()
  if (isError) return null
  return (
    <Box sx={{ borderTop: 1, borderColor: 'divider' }}>
      <Container maxWidth="lg" sx={{ py: { xs: 4, sm: 6 } }}>
        <Box sx={{ mb: 3 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <AutoAwesomeIcon fontSize="small" sx={{ color: 'primary.main' }} />
            <Typography variant="h5" component="h2" sx={{ fontWeight: 600 }}>
              Market summary
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            An AI read of how the US market — the S&amp;P 500 and the Nasdaq —
            has moved over the past year, month, and week.
          </Typography>
        </Box>

        <Card variant="outlined" sx={{ borderColor: 'divider' }}>
          <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
            {isLoading || !data ? <LoadingState /> : <Loaded data={data} />}
          </CardContent>
        </Card>
      </Container>
    </Box>
  )
}
