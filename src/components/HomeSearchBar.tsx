import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Autocomplete,
  Button,
  CircularProgress,
  Stack,
  TextField,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import {
  renderUniverseOption,
  resolveSubmittedTicker,
  SEARCH_DEBOUNCE_MS,
  useDebounced,
  useUniverseSearchOptions,
  type SearchOption,
} from '@/hooks/universeSearch'

// Keep the suggestion counts modest so the hero dropdown reads at a glance.
const STOCK_SUGGESTIONS = 6
const ETF_SUGGESTIONS = 4

/**
 * The hero's primary call to action: a live type-ahead over the whole screened
 * universe — the same stock/ETF search the dedicated Search page runs, hoisted
 * onto the landing page so the front door *is* the product. Typing surfaces
 * matching names and tickers; picking one (or hitting Enter on an exact symbol)
 * routes to `/search?symbol=…`, where the full detail loads. The type-ahead
 * logic itself lives in `@/hooks/universeSearch`, shared with the Search page so
 * the two can't drift; the hero stays a thin presentational shell.
 */
export default function HomeSearchBar() {
  const navigate = useNavigate()
  const [input, setInput] = useState('')
  const debounced = useDebounced(input, SEARCH_DEBOUNCE_MS)
  const query = debounced.trim()

  const { options, searching } = useUniverseSearchOptions(query, {
    stockLimit: STOCK_SUGGESTIONS,
    etfLimit: ETF_SUGGESTIONS,
  })

  /** Route to a ticker's detail page. */
  function go(raw: string) {
    const ticker = raw.trim().toUpperCase()
    if (ticker) navigate(`/search?symbol=${encodeURIComponent(ticker)}`)
  }

  // Resolve the typed text to the best matching ticker on submit, so a company
  // name like "nvidia" routes to NVDA instead of a dead `?symbol=NVIDIA` lookup;
  // an exact symbol with no suggestions still passes through.
  function onSubmit(e: FormEvent) {
    e.preventDefault()
    go(resolveSubmittedTicker(input, options))
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
        renderOption={renderUniverseOption}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder="Search a stock or ETF — e.g. Nvidia, NVDA, VOO"
            sx={{
              '& .MuiOutlinedInput-root': { bgcolor: 'background.paper' },
            }}
            slotProps={{
              ...params.slotProps,
              // A placeholder is not a programmatic label, so name the native
              // input for assistive tech (the field carries no visible label).
              htmlInput: {
                ...params.slotProps.htmlInput,
                'aria-label': 'Search a stock or ETF',
              },
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
