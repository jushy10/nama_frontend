import { Box, Container, Typography } from '@mui/material'
import QuoteGrid, { type QuoteDef } from '@/components/QuoteGrid'

// The "Magnificent 7" mega-caps. These are tradeable tickers Alpaca quotes
// directly, so no ETF proxy is needed — each tile is the stock itself.
const MAG7: QuoteDef[] = [
  { label: 'Apple', symbol: 'AAPL' },
  { label: 'Microsoft', symbol: 'MSFT' },
  { label: 'Alphabet', symbol: 'GOOGL' },
  { label: 'Amazon', symbol: 'AMZN' },
  { label: 'Nvidia', symbol: 'NVDA' },
  { label: 'Meta', symbol: 'META' },
  { label: 'Tesla', symbol: 'TSLA' },
]

/** Dedicated page for the Magnificent 7 mega-caps and their move for the day. */
export default function Mag7() {
  return (
    <Container maxWidth="lg" sx={{ py: { xs: 4, sm: 6 } }}>
      <Box sx={{ mb: 4 }}>
        <Typography
          variant="h4"
          component="h1"
          sx={{ color: 'primary.light', fontWeight: 700 }}
        >
          Magnificent 7
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          The seven mega-cap stocks driving the market — Apple, Microsoft,
          Alphabet, Amazon, Nvidia, Meta and Tesla — with their move for the
          day.
        </Typography>
      </Box>

      <QuoteGrid items={MAG7} />
    </Container>
  )
}
