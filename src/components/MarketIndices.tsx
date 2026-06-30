import { Box, Container, Typography } from '@mui/material'
import QuoteGrid, { type QuoteDef } from '@/components/QuoteGrid'

// The API is fed by Alpaca, which only quotes tradeable securities — the raw
// index tickers (^GSPC, ^NDX, ^DJI) 400 out. So each index is tracked through
// the most liquid ETF that mirrors it; the day's move on the ETF tracks the
// index's.
const INDICES: QuoteDef[] = [
  { label: 'S&P 500', symbol: 'SPY' },
  { label: 'Nasdaq 100', symbol: 'QQQ' },
  { label: 'Dow Jones', symbol: 'DIA' },
  { label: 'Russell 2000', symbol: 'IWM' },
]

/**
 * Home-page band of major US index proxies with their move for the day. Loads
 * on mount and quietly re-polls every minute; a failed symbol shows a dash
 * rather than blanking the row.
 */
export default function MarketIndices() {
  return (
    <Box sx={{ borderTop: 1, borderColor: 'divider' }}>
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" component="h2" sx={{ fontWeight: 600 }}>
            Markets today
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Major US indices and their move for the day, tracked via liquid ETF
            proxies.
          </Typography>
        </Box>

        <QuoteGrid items={INDICES} />
      </Container>
    </Box>
  )
}
