import { useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { type TickerCardInclude } from '@/lib/api'
import { errorMessage, useTickerCard } from '@/lib/queries'
import StockDetail from '@/components/StockDetail'
import EtfDetail from '@/components/EtfDetail'

// Every opt-in block the ticker-card endpoint serves, fetched in one request —
// enough to both classify the ticker (via `asset_type`) and drive the whole
// stock detail (dividend, performance, metrics, options) with no second call.
const SNAPSHOT_BLOCKS: TickerCardInclude[] = [
  'dividend',
  'performance',
  'metrics',
  'options_metrics',
]

/**
 * The one search page for the whole app: type any ticker and get its live
 * detail, stock or fund. A single ticker-card request classifies the symbol by
 * `asset_type` — an equity renders the stock detail off that same card, a fund
 * hands off to the ETF detail (which fetches its holdings/sectors). The ticker
 * lives in the URL (`?symbol=`) so a result is shareable and every screener,
 * sector, and holdings link deep-links straight in.
 */
export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams()
  const urlSymbol = (searchParams.get('symbol') ?? '').trim().toUpperCase()
  const [symbol, setSymbol] = useState(urlSymbol)

  // One request classifies the ticker and, for a stock, carries the whole
  // snapshot. Idle until a ticker is set.
  const cardQuery = useTickerCard(urlSymbol || null, SNAPSHOT_BLOCKS)

  // Keep the search box in sync with the URL ticker on deep links / back-forward.
  useEffect(() => {
    if (urlSymbol) setSymbol(urlSymbol)
  }, [urlSymbol])

  // Submitting just writes the ticker to the URL; the query keys off that, so
  // manual searches, deep links, and back/forward all run one path.
  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const query = symbol.trim().toUpperCase()
    if (!query) return
    setSearchParams(query ? { symbol: query } : {})
  }

  const loading = cardQuery.isLoading
  const card = cardQuery.data
  const isEtf = card?.asset_type === 'etf'

  return (
    <Container maxWidth="xl" sx={{ py: 6 }}>
      <Typography
        variant="h4"
        component="h1"
        sx={{ color: 'primary.light', fontWeight: 700, textAlign: 'center' }}
      >
        Search
      </Typography>
      <Typography
        color="text.secondary"
        sx={{ mt: 1, mb: 3, textAlign: 'center' }}
      >
        Search stocks and ETFs by ticker — one place for a live snapshot, chart,
        and the fundamentals.
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
          placeholder="e.g. AAPL or VOO"
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
        {cardQuery.isError && (
          <Alert severity="error" variant="outlined">
            {errorMessage(cardQuery.error)}
          </Alert>
        )}
        {card &&
          (isEtf ? (
            <EtfDetail symbol={card.ticker} />
          ) : (
            <StockDetail stock={card} />
          ))}
      </Box>
    </Container>
  )
}
