import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
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
  type TickerCardInclude,
} from '@/lib/api'
import {
  errorMessage,
  useAnnualEarnings,
  useCandles,
  useFiveYearReturn,
  useQuarterlyEarnings,
  useRecommendations,
  useTickerCard,
} from '@/lib/queries'
import StockCard from '@/components/StockCard'
import PerformanceCard from '@/components/PerformanceCard'
import ProfitabilityCard from '@/components/ProfitabilityCard'
import PegCard from '@/components/PegCard'
import OptionsCard from '@/components/OptionsCard'
import CandleChart from '@/components/CandleChart'
import ChartRangeToggle from '@/components/ChartRangeToggle'
import RangeReturn from '@/components/RangeReturn'
import AnalystCard from '@/components/AnalystCard'
import EarningsCard from '@/components/EarningsCard'
import ForwardPeCard from '@/components/ForwardPeCard'

// Every opt-in block the ticker-card endpoint serves, fetched in one request:
// the snapshot card needs the dividend, the Performance card the trailing
// returns, the Profitability/PEG cards the metrics, and the Options card the
// options read. Bundling them keeps the page to a single ticker-card call —
// the endpoint prices them all server-side and returns them together.
const SNAPSHOT_BLOCKS: TickerCardInclude[] = [
  'dividend',
  'performance',
  'metrics',
  'options_metrics',
]

export default function Stocks() {
  // The ticker lives in the URL (?symbol=AAPL) so a snapshot is shareable and
  // links from elsewhere (e.g. the home-page screener) deep-link straight in.
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const urlSymbol = (searchParams.get('symbol') ?? '').trim().toUpperCase()
  const [symbol, setSymbol] = useState(urlSymbol)
  const [range, setRange] = useState<ChartRange>('6M')

  // The snapshot keys off the URL ticker; the chart, 5Y pill, ratings, and
  // earnings ride the *loaded* symbol, so they only fire once a snapshot
  // resolves and a bad ticker never kicks off more doomed requests. Each hook
  // aborts its in-flight request when the symbol/range moves on.
  const stockQuery = useTickerCard(urlSymbol || null, SNAPSHOT_BLOCKS)
  const loadedSymbol = stockQuery.data?.ticker ?? null
  const candleQuery = useCandles(loadedSymbol, range)
  const fiveYearReturn = useFiveYearReturn(loadedSymbol)
  const recommendationsQuery = useRecommendations(loadedSymbol)
  // The earnings card runs entirely off the consolidated quarterly endpoint;
  // the profitability and PEG reads ride on the ticker card's `metrics` block
  // (the legacy /earnings call is gone).
  const quarterlyQuery = useQuarterlyEarnings(loadedSymbol)
  // The yearly series behind the card's Quarterly/Annual toggle. Best-effort:
  // if it fails the toggle simply doesn't appear, so no error state is shown.
  const annualQuery = useAnnualEarnings(loadedSymbol)

  // Keep the search box in sync with the URL ticker on deep links / back-forward.
  useEffect(() => {
    if (urlSymbol) setSymbol(urlSymbol)
  }, [urlSymbol])

  // A ticker that's actually a fund belongs on the ETF page — bounce it there
  // (replacing history so Back doesn't ping-pong), keyed off the card's
  // asset_type. The stock content below is gated on this so its cards never
  // flash for a fund mid-redirect.
  const loadedIsEtf = stockQuery.data?.asset_type === 'etf'
  useEffect(() => {
    if (loadedIsEtf && loadedSymbol) {
      navigate(`/etfs?symbol=${encodeURIComponent(loadedSymbol)}`, {
        replace: true,
      })
    }
  }, [loadedIsEtf, loadedSymbol, navigate])

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
        {(loading || loadedIsEtf) && (
          <Stack sx={{ alignItems: 'center', py: 2 }}>
            <CircularProgress />
          </Stack>
        )}
        {stockQuery.isError && (
          <Alert severity="error" variant="outlined">
            {errorMessage(stockQuery.error)}
          </Alert>
        )}
        {stock && !loadedIsEtf && (
          <Stack spacing={3}>
            {/* Snapshot rides beside the Performance + Profitability stack on
                desktop (md+) and stacks on mobile; the price chart below keeps
                the full page width. The snapshot card stretches to match this
                column's height, so keeping the column filled matters. */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                gap: 3,
                alignItems: 'stretch',
              }}
            >
              <StockCard stock={stock} />

              {/* Performance sits above Profitability in the right-hand column:
                  the trailing returns over the "is it making money?" read. Both
                  ride the loaded snapshot (Profitability off its metrics block). */}
              <Stack spacing={3}>
                {stock.performance && (
                  <PerformanceCard
                    perf={stock.performance}
                    fiveYearReturn={fiveYearReturn}
                  />
                )}
                {stock.metrics && (
                  <ProfitabilityCard
                    netMargin={stock.metrics.net_margin}
                    grossMargin={stock.metrics.gross_margin}
                    operatingMargin={stock.metrics.operating_margin}
                  />
                )}
              </Stack>
            </Box>

            {/* The growth-adjusted valuation read — "is the price fair for the
                growth?" — full width below the snapshot row, riding the card's
                metrics block. */}
            {stock.metrics && (
              <PegCard
                peg={stock.metrics.peg}
                forwardPeg={stock.metrics.forward_peg}
              />
            )}

            {/* Options-market read, riding the single snapshot request. A null
                block (no priceable options) simply hides the card. */}
            {stock.options_metrics && (
              <OptionsCard metrics={stock.options_metrics} />
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
                  revenueGrowth={stock.metrics?.revenue_growth_yoy ?? null}
                  epsGrowth={stock.metrics?.eps_growth_yoy ?? null}
                />
              )}

              {/* Forward P/E, walked from the last reported period across the
                  two forecast years and the upcoming quarters. Self-hides
                  until a forward consensus (annual estimates or upcoming
                  quarters) is available. */}
              <ForwardPeCard
                price={stock.price}
                quarterly={quarterlyQuery.data ?? null}
                annual={annualQuery.data ?? null}
                trailingPe={stock.metrics?.pe ?? null}
              />
            </Box>
          </Stack>
        )}
      </Box>
    </Container>
  )
}
