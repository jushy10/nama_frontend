import { Container, Stack } from '@mui/material'
import AutoAwesomeOutlined from '@mui/icons-material/AutoAwesomeOutlined'
import QuoteGrid, { type QuoteDef } from '@/components/QuoteGrid'
import Mag7ComparisonCard from '@/components/Mag7ComparisonCard'
import PageHero from '@/components/PageHero'
import { usePageMeta } from '@/lib/usePageMeta'

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

// Benchmark index to overlay. The backend 400s the raw index ticker (^NDX), so
// we use the QQQ ETF proxy — the same path the rest of the app takes. It's the
// correlation reference for every member line.
const BENCHMARKS: QuoteDef[] = [{ label: 'Nasdaq 100', symbol: 'QQQ' }]

/** Dedicated page for the Magnificent 7 mega-caps and their move for the day. */
export default function Mag7() {
  usePageMeta(
    'Magnificent 7 Stocks — Live Prices & Performance | Nama Insights',
    'Apple, Microsoft, Alphabet, Amazon, Nvidia, Meta and Tesla — live prices and the intraday move for the seven mega-caps driving the market.',
  )

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 3, sm: 5 } }}>
      <PageHero
        eyebrowIcon={AutoAwesomeOutlined}
        eyebrow="Mega-cap leaders"
        title="The Magnificent 7"
        subtitle="Apple, Microsoft, Alphabet, Amazon, Nvidia, Meta and Tesla, with their move for the day and how they track the Nasdaq 100."
      />

      <Stack spacing={4} sx={{ mt: { xs: 2.5, sm: 3 } }}>
        <QuoteGrid items={MAG7} linkToStock />
        <Mag7ComparisonCard items={MAG7} benchmarks={BENCHMARKS} />
      </Stack>
    </Container>
  )
}
