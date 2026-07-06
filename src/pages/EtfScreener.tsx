import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Avatar,
  Box,
  Button,
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
  Tooltip,
  Typography,
} from '@mui/material'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import RefreshIcon from '@mui/icons-material/Refresh'
import SearchIcon from '@mui/icons-material/Search'
import {
  humanizeClassification,
  stockLogoUrl,
  type EtfSearchResult,
  type EtfSearchSort,
  type SortOrder,
} from '@/lib/api'
import { errorMessage, useEtfCategories, useEtfSearch } from '@/lib/queries'

// Wait this long after the last keystroke before searching, so typing a ticker
// doesn't fire a request per letter.
const SEARCH_DEBOUNCE_MS = 300
// Page sizes, matching the API's 1–100 limit.
const ROWS_PER_PAGE = [25, 50, 100]

// Responsive helpers: hide a cell below a breakpoint while keeping the header and
// its body cells in lockstep as the table narrows.
const HIDE_SM = { display: { xs: 'none', sm: 'table-cell' } } as const
const HIDE_MD = { display: { xs: 'none', md: 'table-cell' } } as const

// The two metric columns — both shown at every width so the metric you sort by is
// always visible. Their headers double as sort toggles (see `onSort`).
const METRIC_COLUMNS: { key: EtfSearchSort; label: string }[] = [
  { key: 'net_assets', label: 'Net Assets' },
  { key: 'expense_ratio', label: 'Expense Ratio' },
]

// The always-available "Sort by" menu. The ETF search has no blended metric (the
// stock screener's `growth`), so this mirrors the two columns one-to-one — it
// exists to reach both sorts on phones, where the header labels are hidden.
const SORT_OPTIONS: { key: EtfSearchSort; label: string }[] = [
  { key: 'net_assets', label: 'Net assets' },
  { key: 'expense_ratio', label: 'Expense ratio' },
]

// Total number of columns, for the empty/skeleton rows' colSpan: symbol,
// category, exchange, + the two metrics.
const COLSPAN = 3 + METRIC_COLUMNS.length

/** Compact dollar magnitude, e.g. $2.31T / $845B / $12.4M. */
const fmtMoney = (n: number | null) =>
  n == null
    ? '—'
    : '$' +
      n.toLocaleString('en-US', {
        notation: 'compact',
        maximumFractionDigits: 2,
      })

/** Annual expense ratio to two decimals, e.g. 0.03 → "0.03%" (the API's percent). */
const fmtExpense = (n: number | null) => (n == null ? '—' : `${n.toFixed(2)}%`)

/** Debounce a fast-changing value (the search box) so effects downstream settle. */
function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])
  return debounced
}

/** Fund logo in a white rounded tile, falling back to the ticker's initial. */
function EtfLogo({ symbol, size = 32 }: { symbol: string; size?: number }) {
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

/** One screened fund: logo + ticker/name, category, exchange, and the net-assets
 *  / expense-ratio metrics. Clicking opens the fund's detail page. */
function EtfRow({
  etf,
  onSelect,
}: {
  etf: EtfSearchResult
  onSelect: (ticker: string) => void
}) {
  return (
    <TableRow
      hover
      onClick={() => onSelect(etf.ticker)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(etf.ticker)
        }
      }}
      tabIndex={0}
      role="link"
      aria-label={`View ${etf.ticker} details`}
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
            <EtfLogo symbol={etf.ticker} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              {etf.ticker}
            </Typography>
            {etf.name && (
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
                {etf.name}
              </Typography>
            )}
          </Box>
        </Stack>
      </TableCell>
      <TableCell sx={{ ...HIDE_SM, color: 'text.secondary' }}>
        {etf.category ? humanizeClassification(etf.category) : '—'}
      </TableCell>
      <TableCell sx={{ ...HIDE_MD, color: 'text.secondary' }}>
        {etf.exchange ?? '—'}
      </TableCell>
      <TableCell
        align="right"
        sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
      >
        {fmtMoney(etf.net_assets)}
      </TableCell>
      <TableCell
        align="right"
        sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
      >
        {fmtExpense(etf.expense_ratio)}
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
      <TableCell sx={HIDE_SM}>
        <Skeleton width={110} />
      </TableCell>
      <TableCell sx={HIDE_MD}>
        <Skeleton width={56} />
      </TableCell>
      <TableCell align="right">
        <Skeleton width={64} sx={{ ml: 'auto' }} />
      </TableCell>
      <TableCell align="right">
        <Skeleton width={48} sx={{ ml: 'auto' }} />
      </TableCell>
    </TableRow>
  )
}

/**
 * ETF Screener page: search and filter the screened top US ETF universe by
 * name/ticker and fund category, sorted by net assets (AUM) or expense ratio.
 * Rows are stored facts (no live price) served straight from the DB, so a page is
 * one cheap query; clicking a row opens that fund's live detail on `/search`.
 */
export default function EtfScreener() {
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebounced(searchInput, SEARCH_DEBOUNCE_MS)
  const [category, setCategory] = useState('all')
  const [sort, setSort] = useState<EtfSearchSort>('net_assets')
  const [order, setOrder] = useState<SortOrder>('desc')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(ROWS_PER_PAGE[0])
  const navigate = useNavigate()

  // Any filter/sort change starts a new result set, so jump back to page 1 —
  // otherwise a narrow filter could leave you stranded past its last page.
  useEffect(() => {
    setPage(0)
  }, [debouncedSearch, category, sort, order])

  const query = useEtfSearch({
    q: debouncedSearch.trim() || null,
    category: category === 'all' ? null : category,
    sort,
    order,
    limit: rowsPerPage,
    offset: page * rowsPerPage,
  })
  const categoriesQuery = useEtfCategories()
  const categories = categoriesQuery.data?.categories ?? []

  const data = query.data ?? null
  const rows = data?.results ?? []
  // Only the very first load (nothing on screen yet) surfaces an error.
  const showError = query.isError && !data
  const hasFilters = !!searchInput || category !== 'all'

  // Clicking a sorted column flips its direction; a new column starts descending
  // (biggest / most first, the useful default for each metric).
  const onSort = (col: EtfSearchSort) => {
    if (sort === col) {
      setOrder((o) => (o === 'asc' ? 'desc' : 'asc'))
    } else {
      setSort(col)
      setOrder('desc')
    }
  }

  const openEtf = (ticker: string) =>
    navigate(`/search?symbol=${encodeURIComponent(ticker)}`)

  const clearFilters = () => {
    setSearchInput('')
    setCategory('all')
  }

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
            ETF Screener
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            Search the top US ETF universe by name and category — sorted by net
            assets or expense ratio.
          </Typography>
        </Box>
        <Tooltip title="Refresh">
          <IconButton
            onClick={() => query.refetch()}
            aria-label="Refresh ETF screener"
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
          placeholder="e.g. gold"
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
          label="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          sx={{ minWidth: 220 }}
        >
          <MenuItem value="all">All Categories</MenuItem>
          {categories.map((c) => (
            <MenuItem key={c} value={c}>
              {humanizeClassification(c)}
            </MenuItem>
          ))}
        </TextField>

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
            value={sort}
            onChange={(e) => setSort(e.target.value as EtfSearchSort)}
            sx={{ minWidth: 150, flexGrow: 1 }}
          >
            {SORT_OPTIONS.map((opt) => (
              <MenuItem key={opt.key} value={opt.key}>
                {opt.label}
              </MenuItem>
            ))}
          </TextField>
          <Tooltip title={order === 'asc' ? 'Ascending' : 'Descending'}>
            <IconButton
              onClick={() => setOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
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
          {`${data.total.toLocaleString()} ${data.total === 1 ? 'ETF' : 'ETFs'}`}
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
                  <TableCell sx={HIDE_SM}>Category</TableCell>
                  <TableCell sx={HIDE_MD}>Exchange</TableCell>
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
                      No ETFs match these filters.
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((etf) => (
                  <EtfRow key={etf.ticker} etf={etf} onSelect={openEtf} />
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
