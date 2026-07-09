import { useState } from 'react'
import {
  Alert,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Stack,
  Typography,
} from '@mui/material'
import ShowChartIcon from '@mui/icons-material/ShowChart'
import type { ChartRange } from '@/lib/api'
import { errorMessage, useCandles } from '@/lib/queries'
import QuoteGrid, { type QuoteDef } from '@/components/QuoteGrid'
import CandleChart from '@/components/CandleChart'
import ChartRangeToggle from '@/components/ChartRangeToggle'
import RangeReturn from '@/components/RangeReturn'

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
 * Home-page band of major US index proxies with their move for the day, plus a
 * candlestick chart of whichever index is selected. Each tile is a toggle —
 * picking one swaps the chart under it — and the chart carries the same range
 * row as the stock page. The tile strip loads on mount and quietly re-polls
 * every minute; a failed symbol shows a dash rather than blanking the row.
 */
export default function MarketIndices() {
  const [selected, setSelected] = useState(INDICES[0].symbol)
  // 1D by default: this section is about the day's session, unlike the stock
  // page's longer default horizon.
  const [range, setRange] = useState<ChartRange>('1D')
  const candleQuery = useCandles(selected, range)
  const active = INDICES.find((i) => i.symbol === selected) ?? INDICES[0]

  return (
    <Box sx={{ borderTop: 1, borderColor: 'divider' }}>
      <Container maxWidth="lg" sx={{ py: { xs: 4, sm: 6 } }}>
        <Box sx={{ mb: 3 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <ShowChartIcon fontSize="small" sx={{ color: 'primary.main' }} />
            <Typography variant="h5" component="h2" sx={{ fontWeight: 600 }}>
              Markets today
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Major US indices tracked via liquid ETF proxies. Select one to chart
            it below.
          </Typography>
        </Box>

        <QuoteGrid
          items={INDICES}
          etf
          selectedSymbol={selected}
          onSelect={setSelected}
        />

        <Card variant="outlined" sx={{ borderColor: 'divider', mt: 3 }}>
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.5}
              sx={{
                justifyContent: 'space-between',
                alignItems: { sm: 'center' },
                mb: 2,
              }}
            >
              <Stack
                direction="row"
                spacing={1}
                sx={{ alignItems: 'baseline' }}
              >
                <Typography
                  variant="h6"
                  component="h3"
                  sx={{ fontWeight: 600 }}
                >
                  {active.label} · {active.symbol}
                </Typography>
                {candleQuery.data && (
                  <RangeReturn candles={candleQuery.data.candles} />
                )}
              </Stack>
              <ChartRangeToggle value={range} onChange={setRange} />
            </Stack>

            {candleQuery.isLoading && (
              <Stack
                sx={{
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 280,
                }}
              >
                <CircularProgress />
              </Stack>
            )}
            {candleQuery.isError && (
              <Alert severity="warning" variant="outlined">
                {errorMessage(candleQuery.error, 'Could not load chart data.')}
              </Alert>
            )}
            {candleQuery.data && (
              <CandleChart
                candles={candleQuery.data.candles}
                timeframe={candleQuery.data.timeframe}
              />
            )}
          </CardContent>
        </Card>
      </Container>
    </Box>
  )
}
