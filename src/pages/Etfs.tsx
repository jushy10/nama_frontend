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
import { ApiError, type ChartRange } from '@/lib/api'
import { errorMessage, useCandles, useEtfDetail } from '@/lib/queries'
import EtfCard from '@/components/EtfCard'
import FundReturnsCard from '@/components/FundReturnsCard'
import TopHoldingsCard from '@/components/TopHoldingsCard'
import SectorWeightingsCard from '@/components/SectorWeightingsCard'
import CandleChart from '@/components/CandleChart'
import ChartRangeToggle from '@/components/ChartRangeToggle'
import RangeReturn from '@/components/RangeReturn'

export default function Etfs() {
  // The fund ticker lives in the URL (?symbol=VOO) so a snapshot is shareable
  // and the ETF screener can deep-link straight into a fund.
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const urlSymbol = (searchParams.get('symbol') ?? '').trim().toUpperCase()
  const [symbol, setSymbol] = useState(urlSymbol)
  const [range, setRange] = useState<ChartRange>('6M')

  // The fund detail keys off the URL ticker; the chart rides the *loaded*
  // symbol, so it only fires once the detail resolves and a bad ticker never
  // kicks off a doomed candle request.
  const etfQuery = useEtfDetail(urlSymbol || null)
  const loadedSymbol = etfQuery.data?.ticker ?? null
  const candleQuery = useCandles(loadedSymbol, range)

  // A 404 means the ticker isn't a fund — it's a stock that landed on the ETF
  // page (a hand-typed symbol or a stale link). Bounce it to the stock page,
  // replacing history so Back doesn't ping-pong between the two.
  const notAFund =
    etfQuery.error instanceof ApiError && etfQuery.error.status === 404
  useEffect(() => {
    if (notAFund && urlSymbol) {
      navigate(`/stocks?symbol=${encodeURIComponent(urlSymbol)}`, {
        replace: true,
      })
    }
  }, [notAFund, urlSymbol, navigate])

  // Keep the search box in sync with the URL ticker on deep links / back-forward.
  useEffect(() => {
    if (urlSymbol) setSymbol(urlSymbol)
  }, [urlSymbol])

  // Submitting just writes the ticker to the URL; the detail query keys off
  // that, so manual searches, deep links, and back/forward all run one path.
  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const query = symbol.trim().toUpperCase()
    if (!query) return
    setSearchParams(query ? { symbol: query } : {})
  }

  const loading = etfQuery.isLoading
  const etf = etfQuery.data

  return (
    <Container maxWidth="xl" sx={{ py: 6 }}>
      <Typography
        variant="h4"
        component="h1"
        sx={{ color: 'primary.light', fontWeight: 700, textAlign: 'center' }}
      >
        ETF Search
      </Typography>
      <Typography
        color="text.secondary"
        sx={{ mt: 1, mb: 3, textAlign: 'center' }}
      >
        Enter a fund ticker for a live snapshot, top holdings, and its sector
        breakdown.
      </Typography>

      <Stack
        component="form"
        direction="row"
        spacing={1}
        onSubmit={onSubmit}
        sx={{ maxWidth: 520, mx: 'auto' }}
      >
        <TextField
          label="Fund ticker"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          placeholder="e.g. VOO"
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
        {/* A 404 is mid-redirect to /stocks — keep the spinner up rather than
            flashing a "not found" error the user never needs to see. */}
        {(loading || notAFund) && (
          <Stack sx={{ alignItems: 'center', py: 2 }}>
            <CircularProgress />
          </Stack>
        )}
        {etfQuery.isError && !notAFund && (
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

            {/* Holdings + sector mix share a row on desktop; each self-hides
                when its breakdown is missing, so auto-fit lets whichever
                remains take the full width. */}
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
          </Stack>
        )}
      </Box>
    </Container>
  )
}
