import { useEffect, useState, type FormEvent } from 'react'
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
  getRsi,
  getStock,
  type CandleSeries,
  type ChartRange,
  type RsiSeries,
  type Stock,
} from '@/lib/api'
import StockCard from '@/components/StockCard'
import CandleChart from '@/components/CandleChart'
import RsiCard from '@/components/RsiCard'

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

// Curated subset of the API's ranges — the ones worth a one-tap button.
const RANGE_OPTIONS: ChartRange[] = ['1D', '5D', '1M', '3M', '6M', '1Y', 'YTD']

export default function Stocks() {
  const [symbol, setSymbol] = useState('')
  const [status, setStatus] = useState<Status>({ state: 'idle' })
  const [range, setRange] = useState<ChartRange>('6M')
  const [candle, setCandle] = useState<CandleStatus>({ state: 'idle' })
  const [rsi, setRsi] = useState<RsiStatus>({ state: 'idle' })

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const query = symbol.trim().toUpperCase()
    if (!query) return

    setStatus({ state: 'loading' })
    try {
      const stock = await getStock(query)
      setStatus({ state: 'success', stock })
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Could not reach the server. Please try again.'
      setStatus({ state: 'error', message })
    }
  }

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
            <StockCard stock={status.stock} />

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

            <Card
              variant="outlined"
              sx={{ borderColor: 'rgba(255,255,255,0.12)' }}
            >
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
          </Stack>
        )}
      </Box>
    </Container>
  )
}
