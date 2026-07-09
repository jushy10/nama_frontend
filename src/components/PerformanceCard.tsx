import { Box, Card, CardContent, Typography } from '@mui/material'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import { PERF_WINDOWS, type StockPerformance } from '@/lib/api'
import SectionHeading from '@/components/SectionHeading'

/** Signed percent for directional figures (returns/changes). */
const fmtPct = (n: number | null) =>
  n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`

/** A single color-coded return pill. */
function PerfPill({ label, value }: { label: string; value: number | null }) {
  const color =
    value == null
      ? 'text.secondary'
      : value >= 0
        ? 'success.main'
        : 'error.main'
  return (
    <Box
      sx={{
        borderRadius: 2,
        bgcolor: 'action.hover',
        px: 1,
        py: 0.75,
        textAlign: 'center',
      }}
    >
      <Typography
        variant="caption"
        sx={{ color: 'text.secondary', display: 'block' }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          fontWeight: 600,
          color,
          fontVariantNumeric: 'tabular-nums',
          fontSize: '0.85rem',
        }}
      >
        {fmtPct(value)}
      </Typography>
    </Box>
  )
}

/**
 * Trailing-return pills, color-coded green/red by sign. The 5Y return isn't in
 * the snapshot's `performance` object — it's derived from 5Y candles upstream
 * and passed in, so it loads a beat later and shows `—` until ready.
 */
export default function PerformanceCard({
  perf,
  fiveYearReturn,
}: {
  perf: StockPerformance
  fiveYearReturn?: number | null
}) {
  const entries: { label: string; value: number | null }[] = [
    ...PERF_WINDOWS.map(({ key, label }) => ({ label, value: perf[key] })),
    { label: '5Y', value: fiveYearReturn ?? null },
  ]
  return (
    <Card variant="outlined" sx={{ borderColor: 'divider' }}>
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        <SectionHeading
          icon={<TrendingUpIcon fontSize="small" />}
          title="Performance"
          subtitle="Trailing total return by window"
        />
        <Box
          sx={{
            mt: 2,
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(3, minmax(0, 1fr))',
              sm: 'repeat(7, minmax(0, 1fr))',
            },
            gap: 1,
          }}
        >
          {entries.map((e) => (
            <PerfPill key={e.label} label={e.label} value={e.value} />
          ))}
        </Box>
      </CardContent>
    </Card>
  )
}
