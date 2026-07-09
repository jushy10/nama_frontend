import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Avatar,
  Box,
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
  Tooltip,
  Typography,
} from '@mui/material'
import type { SxProps, Theme } from '@mui/material/styles'
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
  display: { xs: 'none'; sm?: 'table-cell'; md?: 'table-cell' }
}
const HIDE_SM = { display: { xs: 'none', sm: 'table-cell' } } as const
const HIDE_MD = { display: { xs: 'none', md: 'table-cell' } } as const

/** Compact dollar magnitude, e.g. $2.31T / $845B / $12.4M. */
const fmtMoney = (n: number | null) =>
  n == null
    ? '—'
    : '$' +
      n.toLocaleString('en-US', {
        notation: 'compact',
        maximumFractionDigits: 2,
      })

/** A percent to two decimals, e.g. 0.03 → "0.03%" — the API's already-percent
 *  expense ratio and distribution yield (a genuine 0% zero-fee fund reads "0.00%",
 *  a non-distributing fund's null yield reads "—"). */
const fmtPercent = (n: number | null) => (n == null ? '—' : `${n.toFixed(2)}%`)

// One metric column, the single source of truth its header, body and skeleton
// cells read from. `value` pulls the figure off a row, `format` renders it, `tip`
// explains the header, and `hide` is an optional responsive-hide rule (dropped
// when the column is the active sort, so the metric you're sorting by is never
// hidden). Every header doubles as a sort toggle (see `onSort`).
type EtfMetricColumn = {
  key: EtfSearchSort
  label: string
  tip: string
  value: (e: EtfSearchResult) => number | null
  format: (n: number | null) => string
  hide?: ResponsiveHide
}

// The metric columns, left to right. Net assets and expense ratio show at every
// width; the newer distribution-yield column joins from `sm` up but reveals
// itself whenever it's the active sort.
const METRIC_COLUMNS: EtfMetricColumn[] = [
  {
    key: 'net_assets',
    label: 'Net Assets',
    tip: 'Assets under management (AUM)',
    value: (e) => e.net_assets,
    format: fmtMoney,
  },
  {
    key: 'expense_ratio',
    label: 'Expense Ratio',
    tip: 'Annual fee as a percent of assets — lower is cheaper',
    value: (e) => e.expense_ratio,
    format: fmtPercent,
  },
  {
    key: 'dividend_yield',
    label: 'Div Yield',
    tip: 'Trailing 12-month distribution yield',
    value: (e) => e.dividend_yield,
    format: fmtPercent,
    hide: HIDE_SM,
  },
]

// The always-available "Sort by" menu — one entry per metric column, so every
// sort is reachable on phones where the header labels are hidden.
const SORT_OPTIONS: { key: EtfSearchSort; label: string }[] = [
  { key: 'net_assets', label: 'Net assets' },
  { key: 'expense_ratio', label: 'Expense ratio' },
  { key: 'dividend_yield', label: 'Dividend yield' },
]

// Total number of columns, for the empty/skeleton rows' colSpan: symbol,
// category, exchange, + the metric columns.
const COLSPAN = 3 + METRIC_COLUMNS.length

/** A metric column's structural sx: its responsive-hide rule, dropped when the
 *  column is the active sort so you never hide the metric you're sorting by. */
const metricColumnSx = (
  col: EtfMetricColumn,
  active: boolean,
): SxProps<Theme> => (col.hide && !active ? col.hide : {})

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
 *  / expense-ratio / dividend-yield metrics. Clicking opens the fund's detail
 *  page. `sort` is passed through so a responsive-hidden metric column reveals
 *  itself when it's the one being sorted on. */
function EtfRow({
  etf,
  onSelect,
  sort,
}: {
  etf: EtfSearchResult
  onSelect: (ticker: string) => void
  sort: EtfSearchSort
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
      {METRIC_COLUMNS.map((col) => {
        const value = col.value(etf)
        return (
          <TableCell
            key={col.key}
            align="right"
            sx={{
              ...metricColumnSx(col, sort === col.key),
              color: value == null ? 'text.secondary' : 'text.primary',
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {col.format(value)}
          </TableCell>
        )
      })}
    </TableRow>
  )
}

/** Placeholder row shown per expected result while the first page loads. Takes
 *  `sort` so its metric cells hide/reveal in lockstep with the header. */
function SkeletonRow({ sort }: { sort: EtfSearchSort }) {
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
      {METRIC_COLUMNS.map((col) => (
        <TableCell
          key={col.key}
          align="right"
          sx={metricColumnSx(col, sort === col.key)}
        >
          <Skeleton width={56} sx={{ ml: 'auto' }} />
        </TableCell>
      ))}
    </TableRow>
  )
}

/**
 * ETF Screener page: search and filter the screened top US ETF universe by
 * name/ticker and one or more fund categories, sorted by net assets (AUM),
 * expense ratio, or distribution yield. Rows are stored facts (no live price)
 * served straight from the DB, so a page is one cheap query; clicking a row opens
 * that fund's live detail on `/search`.
 */
export default function EtfScreener() {
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebounced(searchInput, SEARCH_DEBOUNCE_MS)
  const [categories, setCategories] = useState<string[]>([])
  const [sort, setSort] = useState<EtfSearchSort>('net_assets')
  const [order, setOrder] = useState<SortOrder>('desc')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(ROWS_PER_PAGE[0])
  const navigate = useNavigate()

  // Any filter/sort change starts a new result set, so jump back to page 1 —
  // otherwise a narrow filter could leave you stranded past its last page.
  useEffect(() => {
    setPage(0)
  }, [debouncedSearch, categories, sort, order])

  const query = useEtfSearch({
    q: debouncedSearch.trim() || null,
    categories,
    sort,
    order,
    limit: rowsPerPage,
    offset: page * rowsPerPage,
  })
  const categoriesQuery = useEtfCategories()
  const categoryOptions = useMemo<FilterOption[]>(
    () =>
      (categoriesQuery.data?.categories ?? []).map((c) => ({
        value: c,
        label: humanizeClassification(c),
      })),
    [categoriesQuery.data],
  )

  const data = query.data ?? null
  const rows = data?.results ?? []
  // Only the very first load (nothing on screen yet) surfaces an error.
  const showError = query.isError && !data
  const hasFilters = !!searchInput || categories.length > 0

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
    setCategories([])
  }

  // Every applied narrowing as a one-click-removable chip — the categories the
  // compact multi-select only shows as a count, plus the search term — so the row
  // is a complete, honest summary of what's applied.
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
    ...categories.map((c) => ({
      key: `category:${c}`,
      label: humanizeClassification(c),
      onDelete: () => setCategories((xs) => xs.filter((x) => x !== c)),
    })),
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
            ETF Screener
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            Search the top US ETF universe by name and category — sorted by net
            assets, expense ratio, or distribution yield.
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

      {/* Filter card */}
      <Paper
        variant="outlined"
        sx={{
          mt: 4,
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
            placeholder="e.g. gold"
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
            label="Category"
            options={categoryOptions}
            value={categories}
            onChange={(next) => setCategories(next)}
            minWidth={220}
          />

          {/* Explicit sort control: the column-header sort labels are hidden on the
              narrowest screens, so this keeps every metric sortable on mobile. */}
          <Stack
            direction="row"
            spacing={0.5}
            sx={{ alignItems: 'center', ml: { md: 'auto' } }}
          >
            <TextField
              select
              size="small"
              label="Sort by"
              value={sort}
              onChange={(e) => setSort(e.target.value as EtfSearchSort)}
              sx={{ minWidth: 150 }}
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
          {`${data.total.toLocaleString()} ${data.total === 1 ? 'ETF' : 'ETFs'}`}
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
              maxHeight: 'calc(100vh - 260px)',
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
                '& tbody tr:hover': { bgcolor: 'action.hover' },
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
                      backgroundColor: 'background.paper',
                      borderBottom: 2,
                      borderBottomColor: 'divider',
                    },
                  }}
                >
                  <TableCell>Symbol</TableCell>
                  <TableCell sx={HIDE_SM}>Category</TableCell>
                  <TableCell sx={HIDE_MD}>Exchange</TableCell>
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
                      No ETFs match these filters.
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((etf) => (
                  <EtfRow
                    key={etf.ticker}
                    etf={etf}
                    onSelect={openEtf}
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
