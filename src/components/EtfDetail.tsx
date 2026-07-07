import { useState } from 'react'
import {
  Alert,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material'
import { type ChartRange } from '@/lib/api'
import { errorMessage, useCandles, useEtfDetail } from '@/lib/queries'
import EtfCard from '@/components/EtfCard'
import FundReturnsCard from '@/components/FundReturnsCard'
import TopHoldingsCard from '@/components/TopHoldingsCard'
import SectorWeightingsCard from '@/components/SectorWeightingsCard'
import CandleChart from '@/components/CandleChart'
import ChartRangeToggle from '@/components/ChartRangeToggle'
import RangeReturn from '@/components/RangeReturn'
import EtfBenchmarkCard from '@/components/EtfBenchmarkCard'

/**
 * The fund detail view — the ETF snapshot card, its YTD/3Y/5Y returns and an
 * "About" blurb, the top-holdings and sector-weighting breakdowns, and the
 * price chart. Rendered by the Search page once a ticker resolves to an ETF; it
 * fetches the fund's full detail (holdings/sectors aren't on the ticker card)
 * and the chart rides the loaded fund.
 */
export default function EtfDetail({ symbol }: { symbol: string }) {
  const [range, setRange] = useState<ChartRange>('6M')
  const etfQuery = useEtfDetail(symbol)
  const loadedSymbol = etfQuery.data?.ticker ?? null
  const candleQuery = useCandles(loadedSymbol, range)
  const etf = etfQuery.data

  return (
    <Box>
      {etfQuery.isLoading && (
        <Stack sx={{ alignItems: 'center', py: 2 }}>
          <CircularProgress />
        </Stack>
      )}
      {etfQuery.isError && (
        <Alert severity="error" variant="outlined">
          {errorMessage(etfQuery.error)}
        </Alert>
      )}
      {etf && (
        <Stack spacing={3}>
          {/* Snapshot beside the returns + about stack on desktop; stacks on
              mobile. The snapshot card stretches to match this column. */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
              gap: 3,
              alignItems: 'stretch',
            }}
          >
            <EtfCard etf={etf} />

            <Stack spacing={3}>
              <FundReturnsCard etf={etf} />
              {etf.description && (
                <Card variant="outlined" sx={{ borderColor: 'divider' }}>
                  <CardContent sx={{ p: 3 }}>
                    <Typography
                      variant="h6"
                      component="h2"
                      sx={{ fontWeight: 600, mb: 1 }}
                    >
                      About
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ lineHeight: 1.6 }}
                    >
                      {etf.description}
                    </Typography>
                  </CardContent>
                </Card>
              )}
            </Stack>
          </Box>

          {/* Holdings + sector mix share a row on desktop; each self-hides when
              its breakdown is missing, so auto-fit lets whichever remains take
              the full width. */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(min(360px, 100%), 1fr))',
              gap: 3,
              alignItems: 'stretch',
            }}
          >
            <TopHoldingsCard holdings={etf.top_holdings} />
            <SectorWeightingsCard weightings={etf.sector_weightings} />
          </Box>

          <Card variant="outlined" sx={{ borderColor: 'divider' }}>
            <CardContent sx={{ p: 3 }}>
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
                    component="h2"
                    sx={{ fontWeight: 600 }}
                  >
                    Price chart
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
                  {errorMessage(
                    candleQuery.error,
                    'Could not load chart data.',
                  )}
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

          {/* How the fund has tracked the S&P 500 over a chosen range — the
              rebased overlay plus the out/under-performance gap. */}
          <EtfBenchmarkCard symbol={etf.ticker} />
        </Stack>
      )}
    </Box>
  )
}
