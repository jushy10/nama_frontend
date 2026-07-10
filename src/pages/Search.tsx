import { useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Container,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { errorMessage, useTickerType } from '@/lib/queries'
import {
  renderUniverseOption,
  SEARCH_DEBOUNCE_MS,
  useDebounced,
  useUniverseSearchOptions,
  type SearchOption,
} from '@/lib/universeSearch'
import { trackEvent } from '@/lib/analytics'
import StockDetail from '@/components/StockDetail'
import EtfDetail from '@/components/EtfDetail'

// How many suggestions to pull per kind — enough to surface the obvious names
// without a wall of options. Stocks lead (they're what people search most), ETFs
// fill the rest.
const STOCK_SUGGESTIONS = 7
const ETF_SUGGESTIONS = 5

/**
 * The one search page for the whole app: type a company name or ticker and pick
 * from live matches — "Nv" surfaces Nvidia (NVDA), "gold" the gold funds — for a
 * stock or fund alike. As you type, the screened universe is searched by name OR
 * ticker (`GET /stocks/ticker` and `GET /stocks/etfs`); picking a row (or typing
 * an exact ticker and hitting Enter) writes it to the URL (`?symbol=`). A cheap
 * classifier call (`GET /stocks/type/{ticker}`) then decides stock vs fund and
 * hands the symbol to the matching detail. The ticker living in the URL keeps a
 * result shareable and lets every screener, sector, and holdings link deep-link
 * straight in.
 */
export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams()
  const urlSymbol = (searchParams.get('symbol') ?? '').trim().toUpperCase()

  // What's typed in the box (free text — a name or a ticker). Seeded from the URL
  // ticker so a deep link shows its symbol in the field.
  const [input, setInput] = useState(urlSymbol)
  const debounced = useDebounced(input, SEARCH_DEBOUNCE_MS)
  const query = debounced.trim()

  // Search both universes as you type — but not until something's typed, so an
  // empty box loads no default page for a failed keystroke to fall back on. The
  // twin search + merge lives in the shared universe-search hook (also backing
  // the home hero), so the two surfaces can't drift.
  const { options, searching } = useUniverseSearchOptions(query, {
    stockLimit: STOCK_SUGGESTIONS,
    etfLimit: ETF_SUGGESTIONS,
  })

  // A cheap classifier call decides stock vs fund; the matching detail fetches
  // its own data. Idle until a ticker is set.
  const typeQuery = useTickerType(urlSymbol || null)

  // Keep the search box in sync with the URL ticker on deep links / back-forward.
  useEffect(() => {
    if (urlSymbol) setInput(urlSymbol)
  }, [urlSymbol])

  // Record which tickers actually get opened — fires once per resolved symbol
  // (keyed off the classified result, so a half-typed search sends nothing).
  // Autocapture covers clicks/pageviews; this names the app's core action so
  // "most-viewed tickers" becomes answerable.
  useEffect(() => {
    const resolved = typeQuery.data
    if (resolved) {
      trackEvent('ticker_viewed', {
        ticker: resolved.ticker,
        asset_type: resolved.asset_type,
      })
    }
  }, [typeQuery.data])

  // Route to a ticker: normalise and write it to the URL, which the detail below
  // keys off. Manual searches, picks, deep links, and back/forward all run this.
  function go(raw: string) {
    const ticker = raw.trim().toUpperCase()
    if (ticker) setSearchParams({ symbol: ticker })
  }

  // Submitting the form (the button, or Enter with nothing highlighted) searches
  // the typed text as a raw ticker — so an exact symbol outside the screened
  // universe still resolves.
  function onSubmit(e: FormEvent) {
    e.preventDefault()
    go(input)
  }

  const loading = typeQuery.isLoading
  const type = typeQuery.data
  const isEtf = type?.asset_type === 'etf'

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 4, md: 6 } }}>
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
        Search stocks and ETFs by company name or ticker — one place for a live
        snapshot, chart, and the fundamentals.
      </Typography>

      <Stack
        component="form"
        direction="row"
        spacing={1}
        onSubmit={onSubmit}
        sx={{ maxWidth: 520, mx: 'auto' }}
      >
        <Autocomplete<SearchOption, false, false, true>
          freeSolo
          fullWidth
          // The server already filtered by name/ticker; don't let MUI re-filter.
          filterOptions={(opts) => opts}
          options={options}
          groupBy={(o) => (o.kind === 'etf' ? 'ETFs' : 'Stocks')}
          getOptionLabel={(o) => (typeof o === 'string' ? o : o.ticker)}
          loading={searching}
          // Controlled input; never hold a selected value (a pick navigates away).
          value={null}
          inputValue={input}
          onInputChange={(_, value, reason) => {
            // Ignore the post-selection 'reset' so a pick doesn't wipe the box.
            if (reason !== 'reset') setInput(value)
          }}
          onChange={(_, value) => {
            if (!value) return
            go(typeof value === 'string' ? value : value.ticker)
          }}
          blurOnSelect
          autoHighlight
          noOptionsText={query ? 'No matching stocks or ETFs' : 'Start typing…'}
          renderOption={renderUniverseOption}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Search by name or ticker"
              placeholder="e.g. Nvidia, NVDA, or VOO"
              autoFocus
              slotProps={{
                ...params.slotProps,
                input: {
                  ...params.slotProps.input,
                  endAdornment: (
                    <>
                      {searching && <CircularProgress size={18} />}
                      {params.slotProps.input.endAdornment}
                    </>
                  ),
                },
              }}
            />
          )}
        />
        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={loading || !input.trim()}
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
        {typeQuery.isError && (
          <Alert severity="error" variant="outlined">
            {errorMessage(typeQuery.error)}
          </Alert>
        )}
        {type &&
          (isEtf ? (
            <EtfDetail symbol={type.ticker} />
          ) : (
            <StockDetail symbol={type.ticker} />
          ))}
      </Box>
    </Container>
  )
}
