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
import {
  ApiError,
  getCandles,
  getEarnings,
  getRsi,
  getStock,
  type CandleSeries,
  type ChartRange,
  type EarningsHistory,
  type RsiSeries,
  type Stock,
} from '@/lib/api'
import StockCard from '@/components/StockCard'
import CandleChart from '@/components/CandleChart'
import RsiCard from '@/components/RsiCard'
import EarningsCard from '@/components/EarningsCard'

type Status =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'success'; stock: Stock }

type CandleStatus =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'success'; series: CandleSeries }

type RsiStatus =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'success'; series: RsiSeries }

type EarningsStatus =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'success'; history: EarningsHistory }

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
  const [status, setStatus] = useState<Status>({ state: 'idle' })
  const [range, setRange] = useState<ChartRange>('6M')
  const [candle, setCandle] = useState<CandleStatus>({ state: 'idle' })
  const [rsi, setRsi] = useState<RsiStatus>({ state: 'idle' })
  const [earnings, setEarnings] = useState<EarningsStatus>({ state: 'idle' })
  // 5Y trailing return — the snapshot's `performance` object stops at 1Y, so we
  // derive it from the first vs last close of the 5Y daily candle series.
  const [fiveYearReturn, setFiveYearReturn] = useState<number | null>(null)

  // Submitting just writes the ticker to the URL; the fetch below keys off that,
  // so manual searches, deep links, and back/forward all run one code path.
  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const query = symbol.trim().toUpperCase()
    if (!query) return
    setSearchParams(query ? { symbol: query } : {})
  }

  // Fetch the snapshot whenever the URL ticker changes.
  useEffect(() => {
    if (!urlSymbol) {
      setStatus({ state: 'idle' })
      return
    }
    setSymbol(urlSymbol)
    const ac = new AbortController()
    setStatus({ state: 'loading' })
    getStock(urlSymbol, { signal: ac.signal })
      .then((stock) => {
        if (!ac.signal.aborted) setStatus({ state: 'success', stock })
      })
      .catch((err) => {
        if (ac.signal.aborted) return
        const message =
          err instanceof ApiError
            ? err.message
            : 'Could not reach the server. Please try again.'
        setStatus({ state: 'error', message })
      })
    return () => ac.abort()
  }, [urlSymbol])

  // Load candles whenever a stock is showing or the range changes. Kept
  // separate from the snapshot fetch so a chart hiccup never blanks the card,
  // and stale responses are aborted when the symbol/range moves on.
  const loadedSymbol = status.state === 'success' ? status.stock.symbol : null
  useEffect(() => {
    if (!loadedSymbol) {
      setCandle({ state: 'idle' })
      return
    }
    const ac = new AbortController()
    setCandle({ state: 'loading' })
    getCandles(loadedSymbol, { range, signal: ac.signal })
      .then((series) => setCandle({ state: 'success', series }))
      .catch((err) => {
        if (ac.signal.aborted) return
        const message =
          err instanceof ApiError ? err.message : 'Could not load chart data.'
        setCandle({ state: 'error', message })
      })
    return () => ac.abort()
  }, [loadedSymbol, range])

  // 5Y return rides the symbol, independent of the chart's range selector. A
  // failed/short series is non-fatal — the pill just falls back to "—".
  useEffect(() => {
    if (!loadedSymbol) {
      setFiveYearReturn(null)
      return
    }
    const ac = new AbortController()
    setFiveYearReturn(null)
    getCandles(loadedSymbol, { range: '5Y', signal: ac.signal })
      .then((series) => {
        if (ac.signal.aborted) return
        const c = series.candles
        const first = c[0]?.close
        const last = c[c.length - 1]?.close
        if (c.length >= 2 && first) {
          setFiveYearReturn(((last - first) / first) * 100)
        }
      })
      .catch(() => {
        /* non-fatal: the 5Y pill stays at "—" */
      })
    return () => ac.abort()
  }, [loadedSymbol])

  // RSI rides the snapshot, not the chart range — it's a fixed 14-period daily
  // read, so it only refetches when the symbol changes.
  useEffect(() => {
    if (!loadedSymbol) {
      setRsi({ state: 'idle' })
      return
    }
    const ac = new AbortController()
    setRsi({ state: 'loading' })
    getRsi(loadedSymbol, { signal: ac.signal })
      .then((series) => setRsi({ state: 'success', series }))
      .catch((err) => {
        if (ac.signal.aborted) return
        const message =
          err instanceof ApiError ? err.message : 'Could not load RSI data.'
        setRsi({ state: 'error', message })
      })
    return () => ac.abort()
  }, [loadedSymbol])

  // Earnings history also rides the symbol. We ask for up to 8 quarters; the
  // backend's free Finnhub tier currently returns the last 4, and the chart
  // renders whatever comes back — so it widens on its own if that source ever
  // deepens, with no change needed here.
  useEffect(() => {
    if (!loadedSymbol) {
      setEarnings({ state: 'idle' })
      return
    }
    const ac = new AbortController()
    setEarnings({ state: 'loading' })
    getEarnings(loadedSymbol, { limit: 8, signal: ac.signal })
      .then((history) => setEarnings({ state: 'success', history }))
      .catch((err) => {
        if (ac.signal.aborted) return
        const message =
          err instanceof ApiError
            ? err.message
            : 'Could not load earnings data.'
        setEarnings({ state: 'error', message })
      })
    return () => ac.abort()
  }, [loadedSymbol])

  const loading = status.state === 'loading'

  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
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
        {status.state === 'error' && (
          <Alert severity="error" variant="outlined">
            {status.message}
          </Alert>
        )}
        {status.state === 'success' && (
          <Stack spacing={3}>
            <StockCard stock={status.stock} fiveYearReturn={fiveYearReturn} />

            {rsi.state === 'loading' && (
              <Stack sx={{ alignItems: 'center', py: 2 }}>
                <CircularProgress size={28} />
              </Stack>
            )}
            {rsi.state === 'error' && (
              <Alert severity="warning" variant="outlined">
                {rsi.message}
              </Alert>
            )}
            {rsi.state === 'success' && <RsiCard rsi={rsi.series} />}

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

                {candle.state === 'loading' && (
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
                {candle.state === 'error' && (
                  <Alert severity="warning" variant="outlined">
                    {candle.message}
                  </Alert>
                )}
                {candle.state === 'success' && (
                  <CandleChart
                    candles={candle.series.candles}
                    timeframe={candle.series.timeframe}
                  />
                )}
              </CardContent>
            </Card>

            {earnings.state === 'loading' && (
              <Stack sx={{ alignItems: 'center', py: 2 }}>
                <CircularProgress size={28} />
              </Stack>
            )}
            {earnings.state === 'error' && (
              <Alert severity="warning" variant="outlined">
                {earnings.message}
              </Alert>
            )}
            {earnings.state === 'success' && (
              <EarningsCard earnings={earnings.history} />
            )}
          </Stack>
        )}
      </Box>
    </Container>
  )
}
