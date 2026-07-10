import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Autocomplete,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import { humanizeClassification, stockLogoUrl } from '@/lib/api'
import { useEtfSearch, useStockSearch } from '@/lib/queries'

// Match the Search page: settle the query a beat after the last keystroke, and
// keep the suggestion counts modest so the dropdown reads at a glance.
const SEARCH_DEBOUNCE_MS = 250
const STOCK_SUGGESTIONS = 6
const ETF_SUGGESTIONS = 4

/** Debounce a fast-changing value (the search box) so the query settles. */
function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])
  return debounced
}

/** One row in the dropdown — a stock or fund matched by name or ticker. */
interface SearchOption {
  kind: 'stock' | 'etf'
  ticker: string
  name: string | null
  meta: string | null
}

/**
 * The hero's primary call to action: a live type-ahead over the whole screened
 * universe — the same stock/ETF search the dedicated Search page runs, hoisted
 * onto the landing page so the front door *is* the product. Typing surfaces
 * matching names and tickers; picking one (or hitting Enter on an exact symbol)
 * routes to `/search?symbol=…`, where the full detail loads. Kept deliberately
 * self-contained so the hero stays a thin presentational shell.
 */
export default function HomeSearchBar() {
  const navigate = useNavigate()
  const [input, setInput] = useState('')
  const debounced = useDebounced(input, SEARCH_DEBOUNCE_MS)
  const query = debounced.trim()

  const stockSearch = useStockSearch({
    q: query || null,
    sectors: [],
    industries: [],
    inSp500: false,
    inNasdaq100: false,
    marketCaps: [],
    sort: 'market_cap',
    order: 'desc',
    limit: STOCK_SUGGESTIONS,
    offset: 0,
    enabled: !!query,
  })
  const etfSearch = useEtfSearch({
    q: query || null,
    categories: [],
    sort: 'net_assets',
    order: 'desc',
    limit: ETF_SUGGESTIONS,
    offset: 0,
    enabled: !!query,
  })

  // Stocks first, then funds — the same grouped order the Search page uses.
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

  /** Route to a ticker's detail page. */
  function go(raw: string) {
    const ticker = raw.trim().toUpperCase()
    if (ticker) navigate(`/search?symbol=${encodeURIComponent(ticker)}`)
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    go(input)
  }

  return (
    <Stack
      component="form"
      direction="row"
      spacing={1}
      onSubmit={onSubmit}
      sx={{ width: '100%', maxWidth: 560 }}
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
        value={null}
        inputValue={input}
        onInputChange={(_, value, reason) => {
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
            placeholder="Search a stock or ETF — e.g. Nvidia, NVDA, VOO"
            sx={{
              '& .MuiOutlinedInput-root': { bgcolor: 'background.paper' },
            }}
            slotProps={{
              ...params.slotProps,
              input: {
                ...params.slotProps.input,
                startAdornment: (
                  <SearchIcon sx={{ color: 'text.secondary', mr: 1 }} />
                ),
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
        disabled={!input.trim()}
        sx={{ flexShrink: 0, px: { xs: 2, sm: 3 } }}
      >
        Search
      </Button>
    </Stack>
  )
}
