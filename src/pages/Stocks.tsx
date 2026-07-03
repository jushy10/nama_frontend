import { useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import {
  quarterlyToEarningsHistory,
  quarterlyUpcoming,
  type ChartRange,
} from '@/lib/api'
import {
  errorMessage,
  useAnnualEarnings,
  useCandles,
  useFiveYearReturn,
  useQuarterlyEarnings,
  useRecommendations,
  useRsi,
  useStock,
} from '@/lib/queries'
import StockCard from '@/components/StockCard'
import PerformanceCard from '@/components/PerformanceCard'
import ProfitabilityCard from '@/components/ProfitabilityCard'
import PegCard from '@/components/PegCard'
import CandleChart from '@/components/CandleChart'
import ChartRangeToggle from '@/components/ChartRangeToggle'
import RangeReturn from '@/components/RangeReturn'
import RsiCard from '@/components/RsiCard'
import AnalystCard from '@/components/AnalystCard'
import EarningsCard from '@/components/EarningsCard'
import ForwardPeCard from '@/components/ForwardPeCard'

export default function Stocks() {
  // The ticker lives in the URL (?symbol=AAPL) so a snapshot is shareable and
  // links from elsewhere (e.g. the home-page screener) deep-link straight in.
  const [searchParams, setSearchParams] = useSearchParams()
  const urlSymbol = (searchParams.get('symbol') ?? '').trim().toUpperCase()
  const [symbol, setSymbol] = useState(urlSymbol)
  const [range, setRange] = useState<ChartRange>('6M')

  // The snapshot keys off the URL ticker; the chart, RSI, 5Y pill, and earnings
  // ride the *loaded* symbol, so they only fire once a snapshot resolves and a
  // bad ticker never kicks off four more doomed requests. Each hook aborts its
  // in-flight request when the symbol/range moves on.
  const stockQuery = useStock(urlSymbol || null)
  const loadedSymbol = stockQuery.data?.symbol ?? null
  const candleQuery = useCandles(loadedSymbol, range)
  const fiveYearReturn = useFiveYearReturn(loadedSymbol)
  const rsiQuery = useRsi(loadedSymbol)
  const recommendationsQuery = useRecommendations(loadedSymbol)
  // The earnings card runs entirely off the consolidated quarterly endpoint;
  // the profitability and PEG reads ride on the snapshot's `metrics`/`growth`
  // blocks (the legacy /earnings call is gone).
  const quarterlyQuery = useQuarterlyEarnings(loadedSymbol)
  // The yearly series behind the card's Quarterly/Annual toggle. Best-effort:
  // if it fails the toggle simply doesn't appear, so no error state is shown.
  const annualQuery = useAnnualEarnings(loadedSymbol)

  // Keep the search box in sync with the URL ticker on deep links / back-forward.
  useEffect(() => {
    if (urlSymbol) setSymbol(urlSymbol)
  }, [urlSymbol])

  // Submitting just writes the ticker to the URL; the snapshot query keys off
  // that, so manual searches, deep links, and back/forward all run one path.
  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const query = symbol.trim().toUpperCase()
    if (!query) return
    setSearchParams(query ? { symbol: query } : {})
  }

  const loading = stockQuery.isLoading
  const stock = stockQuery.data

  return (
    // xl (not lg) so wide monitors actually get the side-by-side rows at a
    // useful width instead of a 1200px column between big empty margins.
    <Container maxWidth="xl" sx={{ py: 6 }}>
      <Typography
        variant="h4"
        component="h1"
        sx={{ color: 'primary.light', fontWeight: 700, textAlign: 'center' }}
      >
        Stock Search
      </Typography>
      <Typography
        color="text.secondary"
        sx={{ mt: 1, mb: 3, textAlign: 'center' }}
      >
        Enter a ticker symbol for a live snapshot and candlestick chart from
        Alpaca.
      </Typography>

      <Stack
        component="form"
        direction="row"
        spacing={1}
        onSubmit={onSubmit}
        sx={{ maxWidth: 520, mx: 'auto' }}
      >
        <TextField
          label="Ticker symbol"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          placeholder="e.g. AAPL"
          autoFocus
          fullWidth
          slotProps={{ htmlInput: { style: { textTransform: 'uppercase' } } }}
        />
        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={loading || !symbol.trim()}
          sx={{ flexShrink: 0 }}
        >
          {loading ? 'Searching…' : 'Search'}
        </Button>
      </Stack>

      <Box sx={{ mt: 4 }}>
        {loading && (
          <Stack sx={{ alignItems: 'center', py: 2 }}>
            <CircularProgress />
          </Stack>
        )}
        {stockQuery.isError && (
          <Alert severity="error" variant="outlined">
            {errorMessage(stockQuery.error)}
          </Alert>
        )}
        {stock && (
          <Stack spacing={3}>
            {/* Snapshot rides beside the Performance + RSI stack on desktop
                (md+) and stacks on mobile; the price chart below keeps the
                full page width. */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                gap: 3,
                alignItems: 'stretch',
              }}
            >
              <StockCard stock={stock} />

              {/* Performance sits directly above RSI in the right-hand column;
                  both ride the loaded snapshot. */}
              <Stack spacing={3}>
                {stock.performance && (
                  <PerformanceCard
                    perf={stock.performance}
                    fiveYearReturn={fiveYearReturn}
                  />
                )}
                <Box>
                  {rsiQuery.isLoading && (
                    <Stack sx={{ alignItems: 'center', py: 2 }}>
                      <CircularProgress size={28} />
                    </Stack>
                  )}
                  {rsiQuery.isError && (
                    <Alert severity="warning" variant="outlined">
                      {errorMessage(rsiQuery.error, 'Could not load RSI data.')}
                    </Alert>
                  )}
                  {rsiQuery.data && <RsiCard rsi={rsiQuery.data} />}
                </Box>
              </Stack>
            </Box>

            {/* Profitability and PEG share one row on desktop: "is it making
                money?" beside "is the price fair for the growth?". Both ride
                the snapshot's metrics block, so they render with the rest;
                auto-fit lets either take the full row on narrow screens. */}
            {stock.metrics && (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fit, minmax(min(480px, 100%), 1fr))',
                  gap: 3,
                  alignItems: 'stretch',
                }}
              >
                <ProfitabilityCard netMargin={stock.metrics.net_margin} />
                <PegCard
                  peg={stock.metrics.peg}
                  pe={stock.metrics.pe}
                  epsGrowth={stock.growth?.eps_yoy ?? null}
                />
              </Box>
            )}

            {recommendationsQuery.isLoading && (
              <Stack sx={{ alignItems: 'center', py: 2 }}>
                <CircularProgress size={28} />
              </Stack>
            )}
            {recommendationsQuery.isError && (
              <Alert severity="warning" variant="outlined">
                {errorMessage(
                  recommendationsQuery.error,
                  'Could not load analyst ratings.',
                )}
              </Alert>
            )}
            {recommendationsQuery.data && (
              <AnalystCard recommendations={recommendationsQuery.data} />
            )}

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

            {/* Earnings and Forward P/E share one full-width row on desktop.
                auto-fit (rather than a fixed 1fr 1fr) lets whichever card is
                present take the whole row when the other is missing — the
                Forward P/E card self-hides without a forward consensus, and
                the earnings slot is empty while its query loads or errors. */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit, minmax(min(480px, 100%), 1fr))',
                gap: 3,
                alignItems: 'stretch',
              }}
            >
              {quarterlyQuery.isLoading && (
                <Stack
                  sx={{ alignItems: 'center', justifyContent: 'center', py: 2 }}
                >
                  <CircularProgress size={28} />
                </Stack>
              )}
              {quarterlyQuery.isError && (
                <Alert severity="warning" variant="outlined">
                  {errorMessage(
                    quarterlyQuery.error,
                    'Could not load earnings data.',
                  )}
                </Alert>
              )}
              {quarterlyQuery.data && (
                <EarningsCard
                  earnings={quarterlyToEarningsHistory(quarterlyQuery.data)}
                  upcoming={quarterlyUpcoming(quarterlyQuery.data)}
                  annual={annualQuery.data ?? null}
                />
              )}

              {/* Forward P/E, walked from the last reported period through
                  today's trailing multiple across the two forecast years and
                  the upcoming quarters. Self-hides until a forward consensus
                  (annual estimates, upcoming quarters, or the snapshot's
                  forward P/E) is available. */}
              <ForwardPeCard
                price={stock.price}
                quarterly={quarterlyQuery.data ?? null}
                annual={annualQuery.data ?? null}
                forwardPe={stock.forward_pe}
                trailingPe={stock.metrics?.pe ?? null}
              />
            </Box>
          </Stack>
        )}
      </Box>
    </Container>
  )
}
