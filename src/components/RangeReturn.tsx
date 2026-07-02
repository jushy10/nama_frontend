import { Typography } from '@mui/material'
import { rangeReturnPct, type Candle } from '@/lib/api'

/**
 * The percent gained or lost across a charted candle series, signed and
 * colored by direction. Sits beside a price chart's title so the selected
 * range always carries its bottom line; renders nothing without candles.
 */
export default function RangeReturn({ candles }: { candles: Candle[] }) {
  const pct = rangeReturnPct(candles)
  if (pct == null) return null
  return (
    <Typography
      component="span"
      sx={{
        fontWeight: 600,
        color: pct >= 0 ? 'success.main' : 'error.main',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {pct >= 0 ? '+' : ''}
      {pct.toFixed(2)}%
    </Typography>
  )
}
