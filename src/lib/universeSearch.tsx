import {
  useEffect,
  useMemo,
  useState,
  type HTMLAttributes,
  type Key,
  type ReactNode,
} from 'react'
import { Avatar, Box, Chip, Typography } from '@mui/material'
import { humanizeClassification, stockLogoUrl } from '@/lib/api'
import { useEtfSearch, useStockSearch } from '@/lib/queries'

// The shared type-ahead over the whole screened universe, backing both the home
// hero and the Search page. Keeping the hook, the row renderer, and the option
// type in one place is what stops the two search surfaces from drifting apart —
// only their limits, chrome (label vs. placeholder), and navigation differ.

// Wait this long after the last keystroke before searching, so typing a name
// doesn't fire a request per letter (matching the screener pages).
export const SEARCH_DEBOUNCE_MS = 250

/** Debounce a fast-changing value (the search box) so the query settles. */
export function useDebounced<T>(value: T, delayMs: number): T {
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
export interface SearchOption {
  kind: 'stock' | 'etf'
  ticker: string
  name: string | null
  meta: string | null
}

/** Per-kind suggestion counts — how many stocks vs. funds to pull into the list. */
interface UniverseSearchLimits {
  stockLimit: number
  etfLimit: number
}

/**
 * Run the twin stock/ETF universe searches for a (pre-trimmed) query and merge
 * them into one grouped list — stocks first, then funds — plus a `searching`
 * flag. Idle (empty list, no request fired) until something's typed. Stocks sort
 * by market cap (so "nv" floats Nvidia to the top), funds by AUM.
 */
export function useUniverseSearchOptions(
  query: string,
  { stockLimit, etfLimit }: UniverseSearchLimits,
): { options: SearchOption[]; searching: boolean } {
  const stockSearch = useStockSearch({
    q: query || null,
    sectors: [],
    industries: [],
    inSp500: false,
    inNasdaq100: false,
    marketCaps: [],
    sort: 'market_cap',
    order: 'desc',
    limit: stockLimit,
    offset: 0,
    enabled: !!query,
  })
  const etfSearch = useEtfSearch({
    q: query || null,
    categories: [],
    sort: 'net_assets',
    order: 'desc',
    limit: etfLimit,
    offset: 0,
    enabled: !!query,
  })

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

  return { options, searching }
}

/**
 * Resolve the free text a user *submits* (the Search button, or Enter with no
 * suggestion highlighted) to the ticker we should route to. Prefer an exact
 * ticker match among the live suggestions, then fall back to the best match —
 * the top, highest-cap row — so typing a company name like "nvidia" lands on
 * NVDA instead of a dead `?symbol=NVIDIA` lookup. With no suggestions loaded
 * (e.g. an exact symbol outside the screened universe), pass the raw text
 * through uppercased so it can still resolve. Returns '' for empty input.
 */
export function resolveSubmittedTicker(
  raw: string,
  options: SearchOption[],
): string {
  const upper = raw.trim().toUpperCase()
  if (!upper) return ''
  const exact = options.find((o) => o.ticker.toUpperCase() === upper)
  if (exact) return exact.ticker
  return options[0]?.ticker ?? upper
}

/**
 * Render one dropdown row — logo avatar, name over its muted classification, and
 * the ticker chip. Wired straight into `<Autocomplete renderOption>`; MUI passes
 * a `key` inside `props` that must be lifted out of the spread onto the element.
 */
export function renderUniverseOption(
  props: HTMLAttributes<HTMLLIElement> & { key?: Key },
  option: SearchOption,
): ReactNode {
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
}
