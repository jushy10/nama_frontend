import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import type { SxProps, Theme } from '@mui/material/styles'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import RefreshIcon from '@mui/icons-material/Refresh'
import SearchIcon from '@mui/icons-material/Search'
import {
  humanizeClassification,
  stockLogoUrl,
  type AiScreenInterpretation,
  type MarketCapTier,
  type SortOrder,
  type StockSearchResult,
  type StockSearchSort,
} from '@/lib/api'
import {
  errorMessage,
  useAiStockScreen,
  useClassifications,
  useStockSearch,
} from '@/lib/queries'
import MultiSelectFilter, {
  type FilterOption,
} from '@/components/MultiSelectFilter'
import ActiveFilters, { type ActiveChip } from '@/components/ActiveFilters'

// Wait this long after the last keystroke before searching, so typing a ticker
// doesn't fire a request per letter.
const SEARCH_DEBOUNCE_MS = 300
// Page sizes, matching the API's 1–100 limit.
const ROWS_PER_PAGE = [25, 50, 100]

// Responsive helpers: hide a cell below a breakpoint while keeping the header and
// its body cells in lockstep as the table narrows. Typed as a plain style object
// (not `SxProps`) so a column's `hide` rule can be spread into a merged cell sx.
type ResponsiveHide = {
  display: {
    xs: 'none'
    sm?: 'table-cell'
    md?: 'table-cell'
    lg?: 'table-cell'
  }
}
const HIDE_SM = { display: { xs: 'none', sm: 'table-cell' } } as const
const HIDE_MD = { display: { xs: 'none', md: 'table-cell' } } as const
const HIDE_LG = { display: { xs: 'none', lg: 'table-cell' } } as const

// One metric column, the single source of truth its header, body and skeleton
// cells all read from — so adding a column is a one-line change and the three
// stay in lockstep. `variant` picks how the value formats and colours (a compact
// dollar magnitude, a bare multiple, or a signed/coloured percent); `value` pulls
// the figure off a row; `tip` explains the header; `hide` is an optional
// responsive-hide rule (dropped when the column is the active sort, so the metric
// you're sorting by is never hidden); `groupStart` draws the divider that sets the
// forward block off from the trailing one.
type MetricColumn = {
  key: StockSearchSort
  label: string
  tip: string
  variant: 'money' | 'multiple' | 'growth'
  value: (s: StockSearchResult) => number | null
  hide?: ResponsiveHide
  groupStart?: boolean
}

// The metric columns, left to right, revealed progressively as the screen widens so
// the table never overflows a phone: market cap + P/E (the core valuation pair) show
// at every width; the trailing-growth pair joins from `sm` up; the two forward-growth
// columns from `lg` up (they're the newest and the most often empty, needing two years
// of estimates). Any hidden column still reveals itself whenever it's the active sort,
// so the metric you sort by is always on screen. Every header doubles as a sort toggle
// (see `onSort`).
const METRIC_COLUMNS: MetricColumn[] = [
  {
    key: 'market_cap',
    label: 'Mkt Cap',
    tip: 'Market capitalization',
    variant: 'money',
    value: (s) => s.market_cap,
  },
  {
    key: 'pe',
    label: 'P/E',
    tip: 'Trailing price-to-earnings, on the analyst-consensus EPS basis',
    variant: 'multiple',
    value: (s) => s.pe_ratio,
  },
  {
    key: 'revenue_growth',
    label: 'Rev Growth',
    tip: 'Latest reported revenue growth, year over year',
    variant: 'growth',
    value: (s) => s.revenue_growth_yoy,
    hide: HIDE_SM,
  },
  {
    key: 'eps_growth',
    label: 'EPS Growth',
    tip: 'Latest reported EPS growth, year over year (consensus basis)',
    variant: 'growth',
    value: (s) => s.eps_growth_yoy,
    hide: HIDE_SM,
  },
  {
    key: 'forward_revenue_growth',
    label: 'Fwd Rev',
    tip: 'Forward revenue growth — next fiscal year to the one after (analyst consensus)',
    variant: 'growth',
    value: (s) => s.forward_revenue_growth_yoy,
    hide: HIDE_LG,
    groupStart: true,
  },
  {
    key: 'forward_eps_growth',
    label: 'Fwd EPS',
    tip: 'Forward EPS growth — next fiscal year to the one after (analyst consensus)',
    variant: 'growth',
    value: (s) => s.forward_eps_growth_yoy,
    hide: HIDE_LG,
  },
]

// The always-available "Sort by" menu — every column plus the two server-side
// blends that have no column of their own: `growth` (equal-weight trailing
// revenue + EPS) and `forward_growth` (the same for the forward pair), each
// reordering the list by both figures at once.
const SORT_OPTIONS: { key: StockSearchSort; label: string }[] = [
  { key: 'market_cap', label: 'Market cap' },
  { key: 'pe', label: 'P/E ratio' },
  { key: 'revenue_growth', label: 'Revenue growth' },
  { key: 'eps_growth', label: 'EPS growth' },
  { key: 'growth', label: 'Growth (EPS + Rev)' },
  { key: 'forward_revenue_growth', label: 'Forward revenue growth' },
  { key: 'forward_eps_growth', label: 'Forward EPS growth' },
  { key: 'forward_growth', label: 'Forward growth (EPS + Rev)' },
]

// Sentinel for the "Sort by" dropdown's no-sort choice. A `null` sort omits the
// API's `sort`/`order` params, so rows arrive in the backend's own default order
// (it's server-paginated, so ordering can't be a client-side concern). The page
// lands on a market-cap sort; this is how you drop back to that unsorted order.
const NO_SORT = 'none'

// The market-cap tier filter's options. `label` rides the dropdown (with the
// bounds for context); `short` is the concise form the active-filter chip shows.
// No "all" entry — an empty selection already means "every size".
const MARKET_CAP_TIERS: {
  value: MarketCapTier
  label: string
  short: string
}[] = [
  { value: 'mega', label: 'Mega-cap · $200B+', short: 'Mega-cap' },
  { value: 'large', label: 'Large-cap · $10–200B', short: 'Large-cap' },
  { value: 'mid', label: 'Mid-cap · $2–10B', short: 'Mid-cap' },
  { value: 'small', label: 'Small-cap · under $2B', short: 'Small-cap' },
]
const MARKET_CAP_OPTIONS: FilterOption[] = MARKET_CAP_TIERS.map((t) => ({
  value: t.value,
  label: t.label,
}))
const capShort = (tier: MarketCapTier) =>
  MARKET_CAP_TIERS.find((t) => t.value === tier)?.short ?? tier

// The sort keys and cap tiers the AI screen may name in its interpreted filters. The
// API types those as raw strings (it can only ever return known slugs, but the shape
// doesn't prove it), so validate against these before they drive the typed controls —
// an off-vocabulary value is simply dropped rather than forced into a union.
const VALID_SORTS = new Set<string>(SORT_OPTIONS.map((o) => o.key))
const VALID_TIERS = new Set<string>(MARKET_CAP_TIERS.map((t) => t.value))

// A few plain-English prompts, shown under the AI box as one-tap starters.
const AI_EXAMPLES = [
  'Mega-cap technology stocks',
  'Top S&P 500 names by revenue growth',
  'Cheap large-cap semiconductor companies',
] as const

// Total number of columns, for the empty/skeleton rows' colSpan: symbol, sector,
// industry, indices, + the metric columns.
const COLSPAN = 4 + METRIC_COLUMNS.length

// Cap the free-text classification columns so a long sector/industry name
// ellipsizes instead of blowing the table width out — keeping every metric column
// on screen without a horizontal scroll (the full label rides a hover title).
const CLIP = { overflow: 'hidden', textOverflow: 'ellipsis' } as const
const SECTOR_MAX = 150
const INDUSTRY_MAX = 168

/** Compact dollar magnitude, e.g. $3.21T / $845B / $12.4M. */
const fmtMoney = (n: number | null) =>
  n == null
    ? '—'
    : '$' +
      n.toLocaleString('en-US', {
        notation: 'compact',
        maximumFractionDigits: 2,
      })

/** Signed percent to one decimal — growth reads best with its direction. */
const fmtPct = (n: number | null) =>
  n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`

/** A bare P/E multiple to two decimals (matching the stock card's valuation
 *  grid); a dash for a loss-maker or an uncovered name. */
const fmtMultiple = (n: number | null) => (n == null ? '—' : n.toFixed(2))

const growthColor = (n: number | null) =>
  n == null ? 'text.secondary' : n >= 0 ? 'success.main' : 'error.main'

/** Structural sx shared by a metric column's header, body and skeleton cells: its
 *  responsive-hide rule — dropped when the column is the active sort, so you never
 *  hide the metric you're sorting by — plus the left divider that groups the
 *  forward block apart from the trailing one. */
const metricColumnSx = (
  col: MetricColumn,
  active: boolean,
): SxProps<Theme> => ({
  ...(col.hide && !active ? col.hide : null),
  ...(col.groupStart ? { borderLeft: 1, borderLeftColor: 'divider' } : null),
})

/** A metric value rendered for its column's variant: a compact dollar magnitude,
 *  a bare multiple, or a signed percent. */
const fmtMetric = (variant: MetricColumn['variant'], n: number | null) =>
  variant === 'money'
    ? fmtMoney(n)
    : variant === 'multiple'
      ? fmtMultiple(n)
      : fmtPct(n)

/** The body-cell text colour for a metric: growth is directional (green/red, dim
 *  when absent), a multiple dims only when absent (cheap isn't universally good),
 *  money stays neutral. */
const metricValueColor = (
  variant: MetricColumn['variant'],
  n: number | null,
) =>
  variant === 'growth'
    ? growthColor(n)
    : variant === 'multiple' && n == null
      ? 'text.secondary'
      : 'text.primary'

/** Debounce a fast-changing value (the search box) so effects downstream settle. */
function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])
  return debounced
}

/** Company logo in a white rounded tile, falling back to the ticker's initial. */
function StockLogo({ symbol, size = 32 }: { symbol: string; size?: number }) {
  return (
    <Avatar
      variant="rounded"
      src={stockLogoUrl(symbol)}
      alt={`${symbol} logo`}
      slotProps={{ img: { loading: 'lazy', style: { objectFit: 'contain' } } }}
      sx={{ width: size, height: size, bgcolor: '#fff', color: '#111', p: 0.5 }}
    >
      {symbol.charAt(0)}
    </Avatar>
  )
}

/** The S&P 500 / Nasdaq-100 membership badges, or a dash when in neither. */
function IndexChips({ stock }: { stock: StockSearchResult }) {
  if (!stock.in_sp500 && !stock.in_nasdaq100) {
    return <Box sx={{ color: 'text.secondary' }}>—</Box>
  }
  return (
    <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', rowGap: 0.5 }}>
      {stock.in_sp500 && (
        <Chip label="S&P 500" size="small" variant="outlined" />
      )}
      {stock.in_nasdaq100 && (
        <Chip label="N100" size="small" variant="outlined" />
      )}
    </Stack>
  )
}

/** One screened name: logo + ticker/name, sector, industry, indices, and the
 *  market-cap, valuation and trailing/forward growth metrics. Clicking opens the
 *  stock's detail page. `sort` is passed through so a responsive-hidden metric
 *  column reveals itself when it's the one being sorted on. */
function StockRow({
  stock,
  onSelect,
  sort,
}: {
  stock: StockSearchResult
  onSelect: (ticker: string) => void
  sort: StockSearchSort | null
}) {
  const sectorLabel = stock.sector ? humanizeClassification(stock.sector) : null
  const industryLabel = stock.industry
    ? humanizeClassification(stock.industry)
    : null
  return (
    <TableRow
      hover
      onClick={() => onSelect(stock.ticker)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(stock.ticker)
        }
      }}
      tabIndex={0}
      role="link"
      aria-label={`View ${stock.ticker} details`}
      sx={{ cursor: 'pointer', '&:last-child td': { border: 0 } }}
    >
      <TableCell>
        <Stack
          direction="row"
          spacing={{ xs: 0, sm: 1.5 }}
          sx={{ alignItems: 'center', minWidth: 0 }}
        >
          {/* Logo hidden on phones to keep ticker + metrics on one screen. */}
          <Box sx={{ display: { xs: 'none', sm: 'flex' } }}>
            <StockLogo symbol={stock.ticker} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              {stock.ticker}
            </Typography>
            {stock.name && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  display: 'block',
                  maxWidth: { xs: 120, sm: 220 },
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {stock.name}
              </Typography>
            )}
          </Box>
        </Stack>
      </TableCell>
      <TableCell
        title={sectorLabel ?? undefined}
        sx={{
          ...HIDE_MD,
          ...CLIP,
          maxWidth: SECTOR_MAX,
          color: 'text.secondary',
        }}
      >
        {sectorLabel ?? '—'}
      </TableCell>
      <TableCell
        title={industryLabel ?? undefined}
        sx={{
          ...HIDE_LG,
          ...CLIP,
          maxWidth: INDUSTRY_MAX,
          color: 'text.secondary',
        }}
      >
        {industryLabel ?? '—'}
      </TableCell>
      <TableCell sx={HIDE_SM}>
        <IndexChips stock={stock} />
      </TableCell>
      {METRIC_COLUMNS.map((col) => {
        const value = col.value(stock)
        return (
          <TableCell
            key={col.key}
            align="right"
            sx={{
              ...metricColumnSx(col, sort === col.key),
              color: metricValueColor(col.variant, value),
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {fmtMetric(col.variant, value)}
          </TableCell>
        )
      })}
    </TableRow>
  )
}

/** Placeholder row shown per expected result while the first page loads. Takes
 *  `sort` so its metric cells hide/reveal in lockstep with the header. */
function SkeletonRow({ sort }: { sort: StockSearchSort | null }) {
  return (
    <TableRow>
      <TableCell>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <Skeleton variant="rounded" width={32} height={32} />
          <Box sx={{ flex: 1 }}>
            <Skeleton width={56} />
            <Skeleton width={120} />
          </Box>
        </Stack>
      </TableCell>
      <TableCell sx={HIDE_MD}>
        <Skeleton width={110} />
      </TableCell>
      <TableCell sx={HIDE_LG}>
        <Skeleton width={110} />
      </TableCell>
      <TableCell sx={HIDE_SM}>
        <Skeleton width={64} />
      </TableCell>
      {METRIC_COLUMNS.map((col) => (
        <TableCell
          key={col.key}
          align="right"
          sx={metricColumnSx(col, sort === col.key)}
        >
          <Skeleton
            width={col.variant === 'money' ? 56 : 44}
            sx={{ ml: 'auto' }}
          />
        </TableCell>
      ))}
    </TableRow>
  )
}

/**
 * Screener page: search and filter the screened ≥$1B US universe by name/ticker,
 * one or more sectors and industries, market-cap tier(s), and index membership.
 * Lands sorted by market cap (largest first); pick another metric — or "None" for
 * the backend's own order — via a column header or the "Sort by" menu. Rows are
 * stored facts (no live price) served straight from the DB, so a page is one cheap
 * query; clicking a row opens that stock's live detail page.
 */
export default function Screener() {
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebounced(searchInput, SEARCH_DEBOUNCE_MS)
  const [sectors, setSectors] = useState<string[]>([])
  const [industries, setIndustries] = useState<string[]>([])
  const [sp500, setSp500] = useState(false)
  const [nasdaq100, setNasdaq100] = useState(false)
  const [marketCaps, setMarketCaps] = useState<MarketCapTier[]>([])
  // Default to market cap so the largest names lead on landing; "None" (null)
  // drops to the backend's own order, any other key re-sorts.
  const [sort, setSort] = useState<StockSearchSort | null>('market_cap')
  const [order, setOrder] = useState<SortOrder>('desc')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(ROWS_PER_PAGE[0])
  // The AI-screen box: its own text (separate from the name/ticker filter, which the
  // AI populates) and the mutation that translates it into filters.
  const [aiInput, setAiInput] = useState('')
  const aiScreen = useAiStockScreen()
  const navigate = useNavigate()

  // Apply the AI's interpreted filters to the manual controls — a fresh screen, so it
  // replaces every axis (clearing ones the request didn't set) rather than layering on
  // top of whatever was there. The result then flows through the ordinary useStockSearch
  // and the user can tweak any control. Each value is validated before it drives a typed
  // control; an off-vocabulary sort/tier falls back to the page's default.
  const applyInterpretation = (interp: AiScreenInterpretation) => {
    setSearchInput(interp.query ?? '')
    setSectors(interp.sectors)
    setIndustries(interp.industries)
    setMarketCaps(
      interp.market_cap_tiers.filter((t): t is MarketCapTier =>
        VALID_TIERS.has(t),
      ),
    )
    setSp500(interp.in_sp500 === true)
    setNasdaq100(interp.in_nasdaq100 === true)
    setSort(
      interp.sort && VALID_SORTS.has(interp.sort)
        ? (interp.sort as StockSearchSort)
        : 'market_cap',
    )
    setOrder(interp.direction === 'asc' ? 'asc' : 'desc')
  }

  const runAiScreen = (raw?: string) => {
    const request = (raw ?? aiInput).trim()
    if (!request || aiScreen.isPending) return
    if (raw != null) setAiInput(raw) // reflect a one-tap example in the box
    aiScreen.mutate(request, {
      onSuccess: (data) => applyInterpretation(data.interpreted),
    })
  }

  // Any filter/sort change starts a new result set, so jump back to page 1 —
  // otherwise a narrow filter could leave you stranded past its last page.
  useEffect(() => {
    setPage(0)
  }, [
    debouncedSearch,
    sectors,
    industries,
    sp500,
    nasdaq100,
    marketCaps,
    sort,
    order,
  ])

  const query = useStockSearch({
    q: debouncedSearch.trim() || null,
    sectors,
    industries,
    inSp500: sp500,
    inNasdaq100: nasdaq100,
    marketCaps,
    sort,
    order,
    limit: rowsPerPage,
    offset: page * rowsPerPage,
  })
  const classifications = useClassifications()
  const sectorOptions = useMemo<FilterOption[]>(
    () =>
      (classifications.data?.sectors ?? []).map((s) => ({
        value: s,
        label: humanizeClassification(s),
      })),
    [classifications.data],
  )
  const industryOptions = useMemo<FilterOption[]>(
    () =>
      (classifications.data?.industries ?? []).map((i) => ({
        value: i,
        label: humanizeClassification(i),
      })),
    [classifications.data],
  )

  const data = query.data ?? null
  const rows = data?.results ?? []
  // Only the very first load (nothing on screen yet) surfaces an error.
  const showError = query.isError && !data
  const hasFilters =
    !!searchInput ||
    sectors.length > 0 ||
    industries.length > 0 ||
    sp500 ||
    nasdaq100 ||
    marketCaps.length > 0

  // Clicking a sorted column flips its direction; a new column starts descending
  // (biggest / fastest-growing first, the useful default for each metric).
  const onSort = (col: StockSearchSort) => {
    if (sort === col) {
      setOrder((o) => (o === 'asc' ? 'desc' : 'asc'))
    } else {
      setSort(col)
      setOrder('desc')
    }
  }

  const openStock = (ticker: string) =>
    navigate(`/search?symbol=${encodeURIComponent(ticker)}`)

  const clearFilters = () => {
    setSearchInput('')
    setSectors([])
    setIndustries([])
    setSp500(false)
    setNasdaq100(false)
    setMarketCaps([])
  }

  const membership = [
    ...(sp500 ? ['sp500'] : []),
    ...(nasdaq100 ? ['nasdaq100'] : []),
  ]

  // Every applied narrowing as a one-click-removable chip — the specifics the
  // compact multi-select fields only show as a count, plus the search term and
  // index toggles, so the row is a complete, honest summary of what's applied.
  const activeChips: ActiveChip[] = [
    ...(debouncedSearch.trim()
      ? [
          {
            key: 'q',
            label: `“${debouncedSearch.trim()}”`,
            onDelete: () => setSearchInput(''),
          },
        ]
      : []),
    ...sectors.map((s) => ({
      key: `sector:${s}`,
      label: humanizeClassification(s),
      onDelete: () => setSectors((xs) => xs.filter((x) => x !== s)),
    })),
    ...industries.map((i) => ({
      key: `industry:${i}`,
      label: humanizeClassification(i),
      onDelete: () => setIndustries((xs) => xs.filter((x) => x !== i)),
    })),
    ...marketCaps.map((t) => ({
      key: `cap:${t}`,
      label: capShort(t),
      onDelete: () => setMarketCaps((xs) => xs.filter((x) => x !== t)),
    })),
    ...(sp500
      ? [{ key: 'sp500', label: 'S&P 500', onDelete: () => setSp500(false) }]
      : []),
    ...(nasdaq100
      ? [
          {
            key: 'nasdaq100',
            label: 'Nasdaq 100',
            onDelete: () => setNasdaq100(false),
          },
        ]
      : []),
  ]

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 4, sm: 6 } }}>
      <Stack
        direction="row"
        spacing={1}
        sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}
      >
        <Box>
          <Typography
            variant="h4"
            component="h1"
            sx={{ color: 'primary.light', fontWeight: 700 }}
          >
            Stock Screener
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            Search the $1B+ US universe by name, sector, industry and index —
            sorted by size, valuation, or trailing and forward growth.
          </Typography>
        </Box>
        <Tooltip title="Refresh">
          <IconButton
            onClick={() => query.refetch()}
            aria-label="Refresh screener"
            sx={{ color: 'text.secondary' }}
          >
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* AI screen box — ask in plain English; the model fills in the filters below,
          which you can then tweak by hand. */}
      <Paper
        variant="outlined"
        sx={{
          mt: 4,
          p: { xs: 1.5, sm: 2 },
          borderRadius: 3,
          borderColor: 'primary.dark',
          bgcolor: 'background.paper',
        }}
      >
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: 'center', mb: 1.5 }}
        >
          <AutoAwesomeIcon fontSize="small" sx={{ color: 'primary.light' }} />
          <Typography sx={{ fontWeight: 700 }}>
            Ask AI to Build a Screen
          </Typography>
        </Stack>
        <Box
          component="form"
          onSubmit={(e) => {
            e.preventDefault()
            runAiScreen()
          }}
          sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}
        >
          <TextField
            size="small"
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            placeholder="e.g. mega-cap technology stocks, or top S&P 500 names by revenue growth"
            disabled={aiScreen.isPending}
            sx={{ flex: '1 1 320px', minWidth: { xs: '100%', sm: 320 } }}
            slotProps={{
              // aria-label on the native input (a label-less field) so it has an
              // accessible name; the icon rides the input adornment.
              htmlInput: { 'aria-label': 'Describe the stocks you want' },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <AutoAwesomeIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
          <Button
            type="submit"
            variant="contained"
            disabled={!aiInput.trim() || aiScreen.isPending}
            startIcon={
              aiScreen.isPending ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <AutoAwesomeIcon />
              )
            }
            sx={{ whiteSpace: 'nowrap' }}
          >
            {aiScreen.isPending ? 'Screening…' : 'Screen'}
          </Button>
        </Box>
        {/* One-tap example prompts. */}
        <Stack
          direction="row"
          spacing={1}
          sx={{ mt: 1.5, flexWrap: 'wrap', rowGap: 1 }}
        >
          {AI_EXAMPLES.map((ex) => (
            <Chip
              key={ex}
              label={ex}
              size="small"
              variant="outlined"
              onClick={() => runAiScreen(ex)}
              disabled={aiScreen.isPending}
              sx={{ cursor: 'pointer' }}
            />
          ))}
        </Stack>
        {aiScreen.isError && (
          <Alert severity="error" variant="outlined" sx={{ mt: 1.5 }}>
            {errorMessage(aiScreen.error)}
          </Alert>
        )}
      </Paper>

      {/* Filter card */}
      <Paper
        variant="outlined"
        sx={{
          mt: 2,
          p: { xs: 1.5, sm: 2 },
          borderRadius: 3,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1.5,
            alignItems: 'center',
          }}
        >
          <TextField
            size="small"
            label="Search name or ticker"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="e.g. NV"
            sx={{
              minWidth: { xs: '100%', md: 240 },
              flex: { md: '1 1 240px' },
            }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
          <MultiSelectFilter
            label="Sector"
            options={sectorOptions}
            value={sectors}
            onChange={(next) => setSectors(next)}
            minWidth={{ xs: '100%', md: 180 }}
          />
          <MultiSelectFilter
            label="Industry"
            options={industryOptions}
            value={industries}
            onChange={(next) => setIndustries(next)}
            minWidth={{ xs: '100%', md: 190 }}
          />
          <MultiSelectFilter
            label="Market cap"
            options={MARKET_CAP_OPTIONS}
            value={marketCaps}
            onChange={(next) => setMarketCaps(next as MarketCapTier[])}
            minWidth={{ xs: '100%', md: 170 }}
          />

          <ToggleButtonGroup
            size="small"
            value={membership}
            onChange={(_, values: string[]) => {
              setSp500(values.includes('sp500'))
              setNasdaq100(values.includes('nasdaq100'))
            }}
            aria-label="Index membership"
            // Full width on phones so it lines up with the stacked fields above;
            // its natural width from `md` up where it sits inline.
            sx={{ width: { xs: '100%', md: 'auto' } }}
          >
            <ToggleButton
              value="sp500"
              sx={{ px: 2, py: 0.5, flex: { xs: 1, md: 'none' } }}
            >
              S&amp;P 500
            </ToggleButton>
            <ToggleButton
              value="nasdaq100"
              sx={{ px: 2, py: 0.5, flex: { xs: 1, md: 'none' } }}
            >
              Nasdaq 100
            </ToggleButton>
          </ToggleButtonGroup>

          {/* Explicit sort control: the column-header sort labels are hidden on the
              narrowest screens, so this keeps every metric sortable on mobile. */}
          <Stack
            direction="row"
            spacing={0.5}
            sx={{
              alignItems: 'center',
              width: { xs: '100%', md: 'auto' },
              ml: { md: 'auto' },
            }}
          >
            <TextField
              select
              size="small"
              label="Sort by"
              value={sort ?? NO_SORT}
              onChange={(e) => {
                const v = e.target.value
                setSort(v === NO_SORT ? null : (v as StockSearchSort))
              }}
              // Fill the row on phones (leaving the arrow its space); fixed width inline.
              sx={{ flex: { xs: 1, md: 'none' }, minWidth: 150 }}
            >
              <MenuItem value={NO_SORT}>None</MenuItem>
              {SORT_OPTIONS.map((opt) => (
                <MenuItem key={opt.key} value={opt.key}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>
            {/* Direction only means something once a sort is chosen. */}
            <Tooltip title={order === 'asc' ? 'Ascending' : 'Descending'}>
              <span>
                <IconButton
                  onClick={() =>
                    setOrder((o) => (o === 'asc' ? 'desc' : 'asc'))
                  }
                  disabled={sort == null}
                  aria-label={`Sort ${order === 'asc' ? 'descending' : 'ascending'}`}
                  sx={{ color: 'text.secondary' }}
                >
                  <ArrowDownwardIcon
                    sx={{
                      transition: 'transform 150ms ease',
                      transform: order === 'asc' ? 'rotate(180deg)' : 'none',
                    }}
                  />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Box>

        <ActiveFilters chips={activeChips} onClearAll={clearFilters} />
      </Paper>

      {/* Summary line */}
      {data && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 2.5 }}
          aria-live="polite"
        >
          {`${data.total.toLocaleString()} ${data.total === 1 ? 'stock' : 'stocks'}`}
          {hasFilters ? ' match your filters' : ' in the universe'}
        </Typography>
      )}

      {showError && (
        <Alert severity="error" variant="outlined" sx={{ mt: 3 }}>
          {errorMessage(query.error)}
        </Alert>
      )}

      {!showError && (
        <>
          <TableContainer
            sx={{
              mt: 1.5,
              border: 1,
              borderColor: 'divider',
              borderRadius: 3,
              bgcolor: 'background.paper',
              overflow: 'auto',
              // Cap the height on desktop so a long page scrolls inside the card
              // with the header pinned; on phones (xs) drop the cap so the page
              // scrolls naturally instead of trapping a short inner scroll region.
              maxHeight: { xs: 'none', md: 'calc(100vh - 260px)' },
              // Dim while a new page/sort loads (previous rows stay put).
              transition: 'opacity 150ms ease',
              opacity: query.isFetching && !query.isLoading ? 0.6 : 1,
            }}
          >
            <Table
              size="small"
              stickyHeader
              sx={{
                '& td, & th': {
                  borderColor: 'divider',
                  px: { xs: 1, sm: 2 },
                  whiteSpace: 'nowrap',
                },
                // A hovered row lifts on a subtle tint so the whole line reads as
                // one clickable target.
                '& tbody tr:hover': { bgcolor: 'action.hover' },
                // Pin the first column (ticker/name) so a row keeps its identity
                // while the metric columns scroll horizontally on a narrow screen.
                // The header corner (z-3) sits above both the sticky header row
                // (z-2) and the pinned body cells (z-1); the pinned body cell
                // carries an opaque background — matched to the row-hover tint —
                // so scrolled metrics never show through it.
                '& thead th:first-of-type': {
                  position: 'sticky',
                  left: 0,
                  zIndex: 3,
                },
                '& tbody td:first-of-type': {
                  position: 'sticky',
                  left: 0,
                  zIndex: 1,
                  bgcolor: 'background.paper',
                },
                '& tbody tr:hover td:first-of-type': {
                  bgcolor: 'action.hover',
                },
              }}
            >
              <TableHead>
                <TableRow
                  sx={{
                    '& th': {
                      color: 'text.secondary',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      fontSize: { xs: '0.75rem', sm: '0.7rem' },
                      // Opaque so scrolled rows don't bleed through the pinned
                      // header; a firmer bottom rule sets it off from the body.
                      backgroundColor: 'background.paper',
                      borderBottom: 2,
                      borderBottomColor: 'divider',
                    },
                  }}
                >
                  <TableCell>Symbol</TableCell>
                  <TableCell sx={HIDE_MD}>Sector</TableCell>
                  <TableCell sx={HIDE_LG}>Industry</TableCell>
                  <TableCell sx={HIDE_SM}>Index</TableCell>
                  {METRIC_COLUMNS.map((col) => {
                    const active = sort === col.key
                    return (
                      <TableCell
                        key={col.key}
                        align="right"
                        sortDirection={active ? order : false}
                        sx={metricColumnSx(col, active)}
                      >
                        <Tooltip
                          title={col.tip}
                          enterDelay={400}
                          placement="top"
                        >
                          <TableSortLabel
                            active={active}
                            direction={active ? order : 'desc'}
                            onClick={() => onSort(col.key)}
                          >
                            {col.label}
                          </TableSortLabel>
                        </Tooltip>
                      </TableCell>
                    )
                  })}
                </TableRow>
              </TableHead>
              <TableBody>
                {query.isLoading &&
                  Array.from({ length: Math.min(rowsPerPage, 10) }).map(
                    (_, i) => <SkeletonRow key={i} sort={sort} />,
                  )}
                {data && rows.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={COLSPAN}
                      sx={{
                        py: 5,
                        textAlign: 'center',
                        color: 'text.secondary',
                      }}
                    >
                      No stocks match these filters.
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((stock) => (
                  <StockRow
                    key={stock.ticker}
                    stock={stock}
                    onSelect={openStock}
                    sort={sort}
                  />
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            component="div"
            count={data?.total ?? 0}
            page={page}
            onPageChange={(_, next) => setPage(next)}
            rowsPerPage={rowsPerPage}
            rowsPerPageOptions={ROWS_PER_PAGE}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(Number(e.target.value))
              setPage(0)
            }}
            sx={{
              mt: 1,
              '& .MuiTablePagination-toolbar': { px: { xs: 0, sm: 2 } },
              // "Rows per page" label eats width on phones; the selector stays.
              '& .MuiTablePagination-selectLabel': {
                display: { xs: 'none', sm: 'block' },
              },
            }}
          />
        </>
      )}
    </Container>
  )
}
