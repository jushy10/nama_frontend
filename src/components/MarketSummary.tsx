import { Box, Divider, Skeleton, Stack, Typography } from '@mui/material'
import AiReadHeader from '@/components/AiReadHeader'
import { sleekCardSx } from '@/components/homeCard'
import { fontFamilyMono } from '@/theme'
import { useMarketSummary } from '@/lib/queries'
import type {
  MarketIndexReturn,
  MarketPeriod,
  MarketPeriodName,
  MarketSummary as MarketSummaryData,
} from '@/lib/api'

/** Signed percent, e.g. +1.84% / -0.64%. */
const fmtPct = (n: number | null) =>
  n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`

const moveColor = (n: number | null) =>
  n == null ? 'text.secondary' : n >= 0 ? 'success.main' : 'error.main'

/** The heading shown for each timeframe, longest-lookback first. */
const PERIOD_LABEL: Record<MarketPeriodName, string> = {
  year: 'Past year',
  month: 'Past month',
  week: 'Past week',
}

/** One index's move over a timeframe: its name and the coloured, mono return. */
function IndexReturn({ r }: { r: MarketIndexReturn }) {
  return (
    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'baseline' }}>
      <Typography
        variant="caption"
        sx={{ color: 'text.secondary', fontWeight: 600 }}
      >
        {r.name}
      </Typography>
      <Typography
        sx={{
          fontFamily: fontFamilyMono,
          fontWeight: 700,
          fontSize: '0.95rem',
          color: moveColor(r.change_percent),
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {fmtPct(r.change_percent)}
      </Typography>
    </Stack>
  )
}

/** One timeframe: its label + each index's real return on a line, the AI's note
 *  beneath. */
function PeriodBlock({ p }: { p: MarketPeriod }) {
  return (
    <Box>
      <Stack
        direction="row"
        spacing={1.5}
        sx={{
          alignItems: 'baseline',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          rowGap: 0.5,
        }}
      >
        <Typography
          sx={{
            fontFamily: fontFamilyMono,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            fontSize: '0.68rem',
            color: 'text.secondary',
          }}
        >
          {PERIOD_LABEL[p.period] ?? p.period}
        </Typography>
        <Stack
          direction="row"
          spacing={{ xs: 2, sm: 2.5 }}
          sx={{ flexWrap: 'wrap' }}
        >
          {p.indexes.map((r) => (
            <IndexReturn key={r.symbol} r={r} />
          ))}
        </Stack>
      </Stack>
      {p.note && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 0.75, lineHeight: 1.5 }}
        >
          {p.note}
        </Typography>
      )}
    </Box>
  )
}

/** The loaded card body: the summary lede, the per-timeframe moves, then the
 *  service disclaimer. The risk posture rides in the header as a `TonePill`. */
function Loaded({ data }: { data: MarketSummaryData }) {
  return (
    <Stack spacing={2.5}>
      <Typography sx={{ fontSize: '1.02rem', lineHeight: 1.65 }}>
        {data.summary}
      </Typography>

      <Divider />

      <Stack spacing={2} divider={<Divider flexItem />}>
        {data.periods.map((p) => (
          <PeriodBlock key={p.period} p={p} />
        ))}
      </Stack>

      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block' }}
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
      <Skeleton variant="text" width="100%" />
      <Skeleton variant="text" width="85%" />
      <Divider />
      <Stack spacing={2}>
        {[0, 1, 2].map((r) => (
          <Stack key={r} spacing={0.5}>
            <Skeleton variant="text" width={140} />
            <Skeleton variant="text" width="70%" />
          </Stack>
        ))}
      </Stack>
    </Stack>
  )
}

/**
 * Home-page "Market summary" widget: an AI read of how the US market — the
 * S&P 500 and the Nasdaq — has moved over the past year, month and week, with the
 * risk posture those moves imply (shown as the header's `TonePill`). Best-effort,
 * like the sector pulse: if the model is briefly unavailable or not configured (a
 * 502/503), the query doesn't retry and the whole widget quietly hides rather
 * than showing a broken card.
 */
export default function MarketSummary() {
  const { data, isLoading, isError } = useMarketSummary()
  if (isError) return null
  return (
    <Box>
      <AiReadHeader title="Market summary" tone={data?.tone} />
      <Box sx={(theme) => ({ ...sleekCardSx(theme), p: { xs: 2.5, sm: 3 } })}>
        {isLoading || !data ? <LoadingState /> : <Loaded data={data} />}
      </Box>
    </Box>
  )
}
