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
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { type ChartRange } from '@/lib/api'
import {
  errorMessage,
  useCandles,
  useEarnings,
  useFiveYearReturn,
  useRecommendations,
  useRsi,
  useStock,
} from '@/lib/queries'
import StockCard from '@/components/StockCard'
import PerformanceCard from '@/components/PerformanceCard'
import DcaCard from '@/components/DcaCard'
import ProfitabilityCard from '@/components/ProfitabilityCard'
import CandleChart from '@/components/CandleChart'
import RsiCard from '@/components/RsiCard'
import AnalystCard from '@/components/AnalystCard'
import EarningsCard from '@/components/EarningsCard'

// Curated subset of the API's ranges — the ones worth a one-tap button.
const RANGE_OPTIONS: ChartRange[] = [
  '1D',
  '5D',
  '1M',
  '3M',
  '6M',
  '1Y',
  '5Y',
  'YTD',
]

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
  const earningsQuery = useEarnings(loadedSymbol, 8)

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
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <Typography
        variant="h4"
        component="h1"
        sx={{ color: 'primary.light', fontWeight: 700 }}
      >
        Stock Search
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
        Enter a ticker symbol for a live snapshot and candlestick chart from
        Alpaca.
      </Typography>

      <Stack
        component="form"
        direction="row"
        spacing={1}
        onSubmit={onSubmit}
        sx={{ maxWidth: 520 }}
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
                (md+) and stacks on mobile; the chart-heavy cards below keep the
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

            <DcaCard drawdown={stock.drawdown_from_high} />

            {/* Bottom-line profitability from trailing net margin; rides the
                earnings query's metrics, so it pops in once those resolve. */}
            {earningsQuery.data?.metrics && (
              <ProfitabilityCard
                netMargin={earningsQuery.data.metrics.net_margin}
              />
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
                  <Typography
                    variant="h6"
                    component="h2"
                    sx={{ fontWeight: 600 }}
                  >
                    Price chart
                  </Typography>
                  <ToggleButtonGroup
                    size="small"
                    exclusive
                    value={range}
                    onChange={(_, value: ChartRange | null) =>
                      value && setRange(value)
                    }
                    aria-label="Chart range"
                    sx={{ flexWrap: 'wrap' }}
                  >
                    {RANGE_OPTIONS.map((r) => (
                      <ToggleButton
                        key={r}
                        value={r}
                        sx={{ px: 1.5, py: 0.25 }}
                      >
                        {r}
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>
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

            {earningsQuery.isLoading && (
              <Stack sx={{ alignItems: 'center', py: 2 }}>
                <CircularProgress size={28} />
              </Stack>
            )}
            {earningsQuery.isError && (
              <Alert severity="warning" variant="outlined">
                {errorMessage(
                  earningsQuery.error,
                  'Could not load earnings data.',
                )}
              </Alert>
            )}
            {earningsQuery.data && (
              <EarningsCard
                earnings={earningsQuery.data}
                growth={stock.growth}
                estimates={stock.analyst_estimates}
                forwardPe={stock.forward_pe}
                forwardPs={stock.forward_ps}
              />
            )}
          </Stack>
        )}
      </Box>
    </Container>
  )
}
