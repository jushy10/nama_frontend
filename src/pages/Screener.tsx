import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Container,
  IconButton,
  InputAdornment,
  MenuItem,
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
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import RefreshIcon from '@mui/icons-material/Refresh'
import SearchIcon from '@mui/icons-material/Search'
import {
  humanizeClassification,
  stockLogoUrl,
  type MarketCapTier,
  type SortOrder,
  type StockSearchResult,
  type StockSearchSort,
} from '@/lib/api'
import { errorMessage, useClassifications, useStockSearch } from '@/lib/queries'

// Wait this long after the last keystroke before searching, so typing a ticker
// doesn't fire a request per letter.
const SEARCH_DEBOUNCE_MS = 300
// Page sizes, matching the API's 1–100 limit.
const ROWS_PER_PAGE = [25, 50, 100]

// Responsive helpers: hide a cell below a breakpoint while keeping the header and
// its body cells in lockstep as the table narrows.
const HIDE_SM = { display: { xs: 'none', sm: 'table-cell' } } as const
const HIDE_MD = { display: { xs: 'none', md: 'table-cell' } } as const
const HIDE_LG = { display: { xs: 'none', lg: 'table-cell' } } as const

// The metric columns — all shown at every width so the metric you sort by is
// always visible. Their headers double as sort toggles (see `onSort`).
const METRIC_COLUMNS: { key: StockSearchSort; label: string }[] = [
  { key: 'market_cap', label: 'Mkt Cap' },
  { key: 'pe', label: 'P/E' },
  { key: 'revenue_growth', label: 'Rev Growth' },
  { key: 'eps_growth', label: 'EPS Growth' },
]

// The always-available "Sort by" menu — the four columns plus `growth`, the
// server-side equal-weight blend of trailing revenue + EPS growth. `growth` has no
// column of its own; it reorders the list by both figures at once.
const SORT_OPTIONS: { key: StockSearchSort; label: string }[] = [
  { key: 'market_cap', label: 'Market cap' },
  { key: 'pe', label: 'P/E ratio' },
  { key: 'revenue_growth', label: 'Revenue growth' },
  { key: 'eps_growth', label: 'EPS growth' },
  { key: 'growth', label: 'Growth (EPS + Rev)' },
]

// Sentinel for the "Sort by" dropdown's no-sort choice. A `null` sort omits the
// API's `sort`/`order` params, so rows arrive in the backend's own default order
// (it's server-paginated, so ordering can't be a client-side concern). The page
// lands on a market-cap sort; this is how you drop back to that unsorted order.
const NO_SORT = 'none'

// The market-cap tier filter's options, each mapping to the API's `market_cap`
// value; `all` clears the filter. Ranges are the API's half-open buckets.
const MARKET_CAP_TIERS: { value: MarketCapTier | 'all'; label: string }[] = [
  { value: 'all', label: 'All Caps' },
  { value: 'mega', label: 'Mega-cap (≥ $200B)' },
  { value: 'large', label: 'Large-cap ($10–200B)' },
  { value: 'mid', label: 'Mid-cap ($2–10B)' },
  { value: 'small', label: 'Small-cap ($250M–$2B)' },
]

// Total number of columns, for the empty/skeleton rows' colSpan: symbol, sector,
// industry, indices, + the metric columns.
const COLSPAN = 4 + METRIC_COLUMNS.length

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
 *  market-cap / trailing-growth metrics. Clicking opens the stock's detail page. */
function StockRow({
  stock,
  onSelect,
}: {
  stock: StockSearchResult
  onSelect: (ticker: string) => void
}) {
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
      <TableCell sx={{ ...HIDE_MD, color: 'text.secondary' }}>
        {stock.sector ? humanizeClassification(stock.sector) : '—'}
      </TableCell>
      <TableCell sx={{ ...HIDE_LG, color: 'text.secondary' }}>
        {stock.industry ? humanizeClassification(stock.industry) : '—'}
      </TableCell>
      <TableCell sx={HIDE_SM}>
        <IndexChips stock={stock} />
      </TableCell>
      <TableCell
        align="right"
        sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
      >
        {fmtMoney(stock.market_cap)}
      </TableCell>
      {/* P/E isn't directional (cheap isn't universally good), so it stays a
          neutral figure — only the empty dash is dimmed, like the other cells. */}
      <TableCell
        align="right"
        sx={{
          color: stock.pe_ratio == null ? 'text.secondary' : 'text.primary',
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {fmtMultiple(stock.pe_ratio)}
      </TableCell>
      <TableCell
        align="right"
        sx={{
          color: growthColor(stock.revenue_growth_yoy),
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {fmtPct(stock.revenue_growth_yoy)}
      </TableCell>
      <TableCell
        align="right"
        sx={{
          color: growthColor(stock.eps_growth_yoy),
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {fmtPct(stock.eps_growth_yoy)}
      </TableCell>
    </TableRow>
  )
}

/** Placeholder row shown per expected result while the first page loads. */
function SkeletonRow() {
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
      <TableCell align="right">
        <Skeleton width={56} sx={{ ml: 'auto' }} />
      </TableCell>
      <TableCell align="right">
        <Skeleton width={40} sx={{ ml: 'auto' }} />
      </TableCell>
      <TableCell align="right">
        <Skeleton width={48} sx={{ ml: 'auto' }} />
      </TableCell>
      <TableCell align="right">
        <Skeleton width={48} sx={{ ml: 'auto' }} />
      </TableCell>
    </TableRow>
  )
}

/**
 * Screener page: search and filter the screened ≥$1B US universe by name/ticker,
 * sector, industry and index membership. Lands sorted by market cap (largest
 * first); pick another metric — or "None" for the backend's own order — via a
 * column header or the "Sort by" menu. Rows are stored facts (no live price)
 * served straight from the DB, so a page is one cheap query; clicking a row opens
 * that stock's live detail page.
 */
export default function Screener() {
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebounced(searchInput, SEARCH_DEBOUNCE_MS)
  const [sector, setSector] = useState('all')
  const [industry, setIndustry] = useState('all')
  const [sp500, setSp500] = useState(false)
  const [nasdaq100, setNasdaq100] = useState(false)
  const [marketCap, setMarketCap] = useState<MarketCapTier | 'all'>('all')
  // Default to market cap so the largest names lead on landing; "None" (null)
  // drops to the backend's own order, any other key re-sorts.
  const [sort, setSort] = useState<StockSearchSort | null>('market_cap')
  const [order, setOrder] = useState<SortOrder>('desc')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(ROWS_PER_PAGE[0])
  const navigate = useNavigate()

  // Any filter/sort change starts a new result set, so jump back to page 1 —
  // otherwise a narrow filter could leave you stranded past its last page.
  useEffect(() => {
    setPage(0)
  }, [
    debouncedSearch,
    sector,
    industry,
    sp500,
    nasdaq100,
    marketCap,
    sort,
    order,
  ])

  const query = useStockSearch({
    q: debouncedSearch.trim() || null,
    sector: sector === 'all' ? null : sector,
    industry: industry === 'all' ? null : industry,
    inSp500: sp500,
    inNasdaq100: nasdaq100,
    marketCap: marketCap === 'all' ? null : marketCap,
    sort,
    order,
    limit: rowsPerPage,
    offset: page * rowsPerPage,
  })
  const classifications = useClassifications()
  const sectors = classifications.data?.sectors ?? []
  const industries = classifications.data?.industries ?? []

  const data = query.data ?? null
  const rows = data?.results ?? []
  // Only the very first load (nothing on screen yet) surfaces an error.
  const showError = query.isError && !data
  const hasFilters =
    !!searchInput ||
    sector !== 'all' ||
    industry !== 'all' ||
    sp500 ||
    nasdaq100 ||
    marketCap !== 'all'

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
    setSector('all')
    setIndustry('all')
    setSp500(false)
    setNasdaq100(false)
    setMarketCap('all')
  }

  const membership = [
    ...(sp500 ? ['sp500'] : []),
    ...(nasdaq100 ? ['nasdaq100'] : []),
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
            sorted by size or trailing growth.
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

      {/* Filters */}
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1.5}
        sx={{ mt: 4, flexWrap: 'wrap', alignItems: { md: 'center' } }}
      >
        <TextField
          size="small"
          label="Search name or ticker"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="e.g. NV"
          sx={{ minWidth: { xs: '100%', md: 260 } }}
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
        <TextField
          select
          size="small"
          label="Sector"
          value={sector}
          onChange={(e) => setSector(e.target.value)}
          sx={{ minWidth: 190 }}
        >
          <MenuItem value="all">All Sectors</MenuItem>
          {sectors.map((s) => (
            <MenuItem key={s} value={s}>
              {humanizeClassification(s)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Industry"
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          sx={{ minWidth: 210 }}
        >
          <MenuItem value="all">All Industries</MenuItem>
          {industries.map((i) => (
            <MenuItem key={i} value={i}>
              {humanizeClassification(i)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Market cap"
          value={marketCap}
          onChange={(e) =>
            setMarketCap(e.target.value as MarketCapTier | 'all')
          }
          sx={{ minWidth: 190 }}
        >
          {MARKET_CAP_TIERS.map((tier) => (
            <MenuItem key={tier.value} value={tier.value}>
              {tier.label}
            </MenuItem>
          ))}
        </TextField>

        <ToggleButtonGroup
          size="small"
          value={membership}
          onChange={(_, values: string[]) => {
            setSp500(values.includes('sp500'))
            setNasdaq100(values.includes('nasdaq100'))
          }}
          aria-label="Index membership"
        >
          <ToggleButton value="sp500" sx={{ px: 2, py: 0.5 }}>
            S&amp;P 500
          </ToggleButton>
          <ToggleButton value="nasdaq100" sx={{ px: 2, py: 0.5 }}>
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
            flex: { xs: '1 1 auto', md: '0 0 auto' },
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
            sx={{ minWidth: 150, flexGrow: 1 }}
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
                onClick={() => setOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
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

        {hasFilters && (
          <Button
            onClick={clearFilters}
            size="small"
            sx={{ color: 'text.secondary' }}
          >
            Clear
          </Button>
        )}
      </Stack>

      {/* Summary line */}
      {data && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 2 }}
          aria-live="polite"
        >
          {`${data.total.toLocaleString()} ${data.total === 1 ? 'stock' : 'stocks'}`}
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
              mt: 3,
              border: 1,
              borderColor: 'divider',
              borderRadius: 2,
              bgcolor: 'action.hover',
              // Dim while a new page/sort loads (previous rows stay put).
              transition: 'opacity 150ms ease',
              opacity: query.isFetching && !query.isLoading ? 0.6 : 1,
            }}
          >
            <Table
              size="small"
              sx={{
                '& td, & th': {
                  borderColor: 'divider',
                  px: { xs: 1, sm: 2 },
                  whiteSpace: 'nowrap',
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
                      fontSize: '0.7rem',
                    },
                  }}
                >
                  <TableCell>Symbol</TableCell>
                  <TableCell sx={HIDE_MD}>Sector</TableCell>
                  <TableCell sx={HIDE_LG}>Industry</TableCell>
                  <TableCell sx={HIDE_SM}>Index</TableCell>
                  {METRIC_COLUMNS.map((col) => (
                    <TableCell
                      key={col.key}
                      align="right"
                      sortDirection={sort === col.key ? order : false}
                    >
                      <TableSortLabel
                        active={sort === col.key}
                        direction={sort === col.key ? order : 'desc'}
                        onClick={() => onSort(col.key)}
                      >
                        {col.label}
                      </TableSortLabel>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {query.isLoading &&
                  Array.from({ length: Math.min(rowsPerPage, 10) }).map(
                    (_, i) => <SkeletonRow key={i} />,
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
