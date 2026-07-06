import { Box, Card, CardContent, Typography } from '@mui/material'
import { type EtfDetail } from '@/lib/api'

/** Signed percent for directional figures (returns). */
const fmtPct = (n: number | null) =>
  n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`

/** A single color-coded return pill. */
function ReturnPill({ label, value }: { label: string; value: number | null }) {
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
 * A fund's trailing returns, the way funds are actually compared: year-to-date
 * plus the annualized 3-year and 5-year figures (not the 1W–1Y windows a stock
 * shows). Color-coded green/red by sign; a window the vendor doesn't cover
 * shows `—`.
 */
export default function FundReturnsCard({ etf }: { etf: EtfDetail }) {
  const entries: { label: string; value: number | null }[] = [
    { label: 'YTD', value: etf.ytd_return },
    { label: '3Y (ann.)', value: etf.three_year_return },
    { label: '5Y (ann.)', value: etf.five_year_return },
  ]
  return (
    <Card variant="outlined" sx={{ borderColor: 'divider' }}>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
          Returns
        </Typography>
        <Box
          sx={{
            mt: 2,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 1,
          }}
        >
          {entries.map((e) => (
            <ReturnPill key={e.label} label={e.label} value={e.value} />
          ))}
        </Box>
      </CardContent>
    </Card>
  )
}
