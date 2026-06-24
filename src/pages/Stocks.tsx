import { useState, type FormEvent } from 'react'
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
import { ApiError, getStock, type Stock } from '@/lib/api'
import StockCard from '@/components/StockCard'

type Status =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'success'; stock: Stock }

export default function Stocks() {
  const [symbol, setSymbol] = useState('')
  const [status, setStatus] = useState<Status>({ state: 'idle' })

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

  const loading = status.state === 'loading'

  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Typography variant="h4" component="h1" sx={{ color: 'primary.light', fontWeight: 700 }}>
        Stock Search
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
        Enter a ticker symbol to see a live snapshot from Alpaca.
      </Typography>

      <Stack component="form" direction="row" spacing={1} onSubmit={onSubmit}>
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
        {status.state === 'success' && <StockCard stock={status.stock} />}
      </Box>
    </Container>
  )
}
