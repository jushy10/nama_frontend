import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Alert,
  Autocomplete,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { humanizeClassification, stockLogoUrl } from '@/lib/api'
import {
  errorMessage,
  useEtfSearch,
  useStockSearch,
  useTickerType,
} from '@/lib/queries'
import StockDetail from '@/components/StockDetail'
import EtfDetail from '@/components/EtfDetail'

// Wait this long after the last keystroke before searching, so typing a name
// doesn't fire a request per letter (matching the screener pages).
const SEARCH_DEBOUNCE_MS = 250
// How many suggestions to pull per kind — enough to surface the obvious names
// without a wall of options. Stocks lead (they're what people search most), ETFs
// fill the rest.
const STOCK_SUGGESTIONS = 7
const ETF_SUGGESTIONS = 5

/** Debounce a fast-changing value (the search box) so the query settles. */
function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])
  return debounced
}

/**
 * One row in the search dropdown — a stock or fund matched by name or ticker.
 * `meta` is the muted secondary line (a stock's sector, a fund's category slug);
 * `kind` drives the group header and the Stock/ETF badge.
 */
interface SearchOption {
  kind: 'stock' | 'etf'
  ticker: string
  name: string | null
  meta: string | null
}

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
  // empty box loads no default page for a failed keystroke to fall back on.
  // Stocks sort by market cap (so "nv" floats Nvidia to the top), funds by AUM.
  const stockSearch = useStockSearch({
    q: query || null,
    sector: null,
    industry: null,
    inSp500: false,
    inNasdaq100: false,
    marketCap: null,
    sort: 'market_cap',
    order: 'desc',
    limit: STOCK_SUGGESTIONS,
    offset: 0,
    enabled: !!query,
  })
  const etfSearch = useEtfSearch({
    q: query || null,
    category: null,
    sort: 'net_assets',
    order: 'desc',
    limit: ETF_SUGGESTIONS,
    offset: 0,
    enabled: !!query,
  })

  // Merge the two result sets into one grouped list — stocks first, then funds —
  // so the dropdown reads top-down by kind. Blank while the box is empty.
  const options = useMemo<SearchOption[]>(() => {
    if (!query) return []
    const stocks: SearchOption[] = (stockSearch.data?.results ?? []).map(
      (s) => ({
        kind: 'stock',
        ticker: s.ticker,
        name: s.name,
        meta: s.sector,
      }),
    )
    const etfs: SearchOption[] = (etfSearch.data?.results ?? []).map((e) => ({
      kind: 'etf',
      ticker: e.ticker,
      name: e.name,
      meta: e.category,
    }))
    return [...stocks, ...etfs]
  }, [query, stockSearch.data, etfSearch.data])

  const searching = !!query && (stockSearch.isFetching || etfSearch.isFetching)

  // A cheap classifier call decides stock vs fund; the matching detail fetches
  // its own data. Idle until a ticker is set.
  const typeQuery = useTickerType(urlSymbol || null)

  // Keep the search box in sync with the URL ticker on deep links / back-forward.
  useEffect(() => {
    if (urlSymbol) setInput(urlSymbol)
  }, [urlSymbol])

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
          renderOption={(props, option) => {
            const { key, ...rest } = props
            return (
              <Box
                component="li"
                key={key}
                {...rest}
                sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}
              >
                <Avatar
                  src={stockLogoUrl(option.ticker)}
                  sx={{
                    width: 28,
                    height: 28,
                    fontSize: 13,
                    bgcolor: 'action.selected',
                    color: 'text.secondary',
                  }}
                >
                  {option.ticker.charAt(0)}
                </Avatar>
                <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                  <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                    {option.name ?? option.ticker}
                  </Typography>
                  {option.meta && (
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {humanizeClassification(option.meta)}
                    </Typography>
                  )}
                </Box>
                <Chip
                  label={option.ticker}
                  size="small"
                  variant="outlined"
                  sx={{ fontWeight: 600, flexShrink: 0 }}
                />
              </Box>
            )
          }}
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
