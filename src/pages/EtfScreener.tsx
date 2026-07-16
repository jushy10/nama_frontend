import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePageMeta } from '@/lib/usePageMeta'
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
  useMediaQuery,
  useTheme,
} from '@mui/material'
import { alpha, type SxProps, type Theme } from '@mui/material/styles'
import { fontFamilyMono } from '@/theme'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import RefreshIcon from '@mui/icons-material/Refresh'
import SearchIcon from '@mui/icons-material/Search'
import LayersOutlined from '@mui/icons-material/LayersOutlined'
import TuneOutlined from '@mui/icons-material/TuneOutlined'
import {
  humanizeClassification,
  stockLogoUrl,
  type AiEtfScreenInterpretation,
  type EtfSearchResult,
  type EtfSearchSort,
  type SortOrder,
} from '@/lib/api'
import {
  errorMessage,
  useAiEtfScreen,
  useEtfCategories,
  useEtfSearch,
} from '@/lib/queries'
import MultiSelectFilter, {
  type FilterOption,
} from '@/components/MultiSelectFilter'
import ActiveFilters, { type ActiveChip } from '@/components/ActiveFilters'
import PageHero from '@/components/PageHero'
import AiScreenBox from '@/components/AiScreenBox'
import { MagnitudeBar, type BarTone } from '@/components/ScreenerBars'
import {
  linearFraction,
  magnitudeFraction,
  pageMax,
} from '@/lib/screenerScale'
import {
  readEnum,
  readInt,
  readList,
  readString,
  useUrlState,
  writeEnum,
  writeInt,
  writeList,
  writeString,
} from '@/lib/urlState'

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
// `bar` picks how the column's micro-bar scales its figure, and in which accent:
// `log` for AUM (it spans three decades, so a linear bar would leave everything
// under the biggest fund invisible), `linear` for the percent columns (they live
// inside one order of magnitude, where log would flatten the very spread the column
// exists to show). The expense ratio draws in the gold `secondary` tone because a
// long bar there means expensive — the blue "more is better" reading would be
// exactly backwards on a fee.
type EtfBar = { scale: 'log' | 'linear'; tone: BarTone }

type EtfMetricColumn = {
  key: EtfSearchSort
  label: string
  tip: string
  value: (e: EtfSearchResult) => number | null
  format: (n: number | null) => string
  bar: EtfBar
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
    bar: { scale: 'log', tone: 'primary' },
  },
  {
    key: 'expense_ratio',
    label: 'Expense Ratio',
    tip: 'Annual fee as a percent of assets — lower is cheaper',
    value: (e) => e.expense_ratio,
    format: fmtPercent,
    bar: { scale: 'linear', tone: 'secondary' },
  },
  {
    key: 'dividend_yield',
    label: 'Div Yield',
    tip: 'Trailing 12-month distribution yield',
    value: (e) => e.dividend_yield,
    format: fmtPercent,
    bar: { scale: 'linear', tone: 'primary' },
    hide: HIDE_SM,
  },
]

/** The fraction a column's bar draws, per its scale. */
const barFraction = (col: EtfMetricColumn, value: number | null, max: number) =>
  col.bar.scale === 'log'
    ? magnitudeFraction(value, max)
    : linearFraction(value, max)

// The always-available "Sort by" menu — one entry per metric column, so every
// sort is reachable on phones where the header labels are hidden.
const SORT_OPTIONS: { key: EtfSearchSort; label: string }[] = [
  { key: 'net_assets', label: 'Net assets' },
  { key: 'expense_ratio', label: 'Expense ratio' },
  { key: 'dividend_yield', label: 'Dividend yield' },
]

// The sort keys the AI screen may name in its interpreted filters. The API types
// `sort` as a raw string (it can only ever return a known slug, but the shape doesn't
// prove it), so validate against these before it drives the typed control — an
// off-vocabulary sort falls back to the page's default (net assets).
const VALID_SORTS = new Set<string>(SORT_OPTIONS.map((o) => o.key))

// The vocabulary the sort and direction live under in the URL, so a hand-edited or
// stale param can never drive a typed control — anything off-list falls back to the
// default (net assets, descending).
const SORT_VALUES: EtfSearchSort[] = SORT_OPTIONS.map((o) => o.key)
const ORDER_VALUES: SortOrder[] = ['asc', 'desc']

// A few plain-English prompts, shown under the AI box as one-tap starters.
const AI_EXAMPLES = [
  'Low-cost S&P 500 index funds',
  'High-yield dividend ETFs',
  'Technology sector funds by size',
] as const

// Total number of columns, for the empty/skeleton rows' colSpan: symbol,
// category, exchange, + the metric columns.
const COLSPAN = 3 + METRIC_COLUMNS.length

/** Page-relative bar denominators, keyed by metric column — the max the column's
 *  micro-bars scale against, recomputed per page of rows (see `screenerScale`). */
type BarScales = Partial<Record<EtfSearchSort, number>>

/** Figures ride the mono face with tabular figures: in a column of numbers, equal
 *  digit widths let the eye compare magnitudes by column position alone, and a
 *  proportional face's ragged digits defeat that. */
const NUMERIC = {
  fontFamily: fontFamilyMono,
  fontVariantNumeric: 'tabular-nums',
} as const

/** A metric column's structural sx: its responsive-hide rule, dropped when the
 *  column is the active sort so you never hide the metric you're sorting by, plus
 *  a faint wash on that active column so the metric ordering the page is legible
 *  as a band down the table. */
const metricColumnSx = (
  col: EtfMetricColumn,
  active: boolean,
): SxProps<Theme> => ({
  ...(col.hide && !active ? col.hide : null),
  ...(active
    ? { bgcolor: (t: Theme) => alpha(t.palette.primary.main, 0.04) }
    : null),
})

/** A clickable row: the whole line is one target, so it gets the pointer, a hover
 *  tint, and — the part MUI's `hover` prop doesn't cover — a visible keyboard focus
 *  ring, since the rows carry `tabIndex`/`role="link"`. */
const clickableRowSx: SxProps<Theme> = {
  cursor: 'pointer',
  '&:last-child td': { border: 0 },
  '&:focus-visible': {
    outline: (t: Theme) => `2px solid ${t.palette.primary.main}`,
    outlineOffset: '-2px',
  },
}

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
  rank,
  onSelect,
  sort,
  scales,
}: {
  etf: EtfSearchResult
  rank: number
  onSelect: (ticker: string) => void
  sort: EtfSearchSort
  scales: BarScales
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
      sx={clickableRowSx}
    >
      <TableCell>
        <Stack
          direction="row"
          spacing={{ xs: 0, sm: 1.5 }}
          sx={{ alignItems: 'center', minWidth: 0 }}
        >
          {/* Standing in the current sort. It rides inside the identity cell rather
              than a column of its own so it stays pinned with the ticker when the
              metrics scroll sideways. Carries the page offset, so page 2 starts at
              26, not 1. */}
          <Box
            aria-hidden
            sx={{
              ...NUMERIC,
              display: { xs: 'none', sm: 'block' },
              flexShrink: 0,
              width: 22,
              textAlign: 'right',
              color: 'text.disabled',
              fontSize: '0.72rem',
            }}
          >
            {rank}
          </Box>
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
              ...NUMERIC,
            }}
          >
            {col.format(value)}
            {/* The bar restates the figure above it as a length, so a page of funds
                reads as a shape rather than a column of near-identical percents. */}
            <MagnitudeBar
              fraction={barFraction(col, value, scales[col.key] ?? 0)}
              tone={col.bar.tone}
            />
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
          <Skeleton width={14} sx={{ flexShrink: 0 }} />
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
          {/* Matches the loaded row's bar, so the list doesn't jump height when the
              real figures land. */}
          <Skeleton width={52} height={3} sx={{ ml: 'auto', mt: 0.5 }} />
        </TableCell>
      ))}
    </TableRow>
  )
}

/** Mobile card for one screened fund: logo, ticker/name up top, the category·exchange line
 *  beneath, then every metric in a tidy grid — the full row's worth of data, sized for a phone
 *  (the table's per-column hiding and horizontal scroll don't apply here). The metric grid maps
 *  the same `METRIC_COLUMNS` the table reads, so the two never drift. Clicking opens the fund's
 *  detail page. */
function EtfListCard({
  etf,
  onSelect,
  scales,
}: {
  etf: EtfSearchResult
  onSelect: (ticker: string) => void
  scales: BarScales
}) {
  const categoryLabel = etf.category
    ? humanizeClassification(etf.category)
    : null
  const classLine = [categoryLabel, etf.exchange].filter(Boolean).join(' · ')
  return (
    <Box
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
      sx={{
        px: 1.5,
        py: 1.5,
        cursor: 'pointer',
        borderBottom: 1,
        borderColor: 'divider',
        transition: 'background-color 120ms ease',
        '&:last-of-type': { borderBottom: 0 },
        '&:hover': { bgcolor: 'action.hover' },
        // A visible ring, not just a tint: the card is a `role="link"` tab stop, and
        // the tint alone is too faint to locate a focused card by.
        '&:focus-visible': {
          bgcolor: 'action.hover',
          outline: (t) => `2px solid ${t.palette.primary.main}`,
          outlineOffset: '-2px',
        },
      }}
    >
      <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
        <EtfLogo symbol={etf.ticker} size={40} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.2 }}
          >
            {etf.ticker}
          </Typography>
          {etf.name && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: 'block',
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

      {classLine && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            display: 'block',
            mt: 0.75,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {classLine}
        </Typography>
      )}

      <Box
        sx={{
          mt: 1.25,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          columnGap: 1,
          rowGap: 1.25,
        }}
      >
        {METRIC_COLUMNS.map((col) => {
          const value = col.value(etf)
          return (
            <Box key={col.key} sx={{ minWidth: 0 }}>
              <Typography
                sx={{
                  color: 'text.secondary',
                  fontSize: '0.6rem',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  lineHeight: 1.4,
                }}
              >
                {col.label}
              </Typography>
              <Typography
                sx={{
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  ...NUMERIC,
                  color: value == null ? 'text.secondary' : 'text.primary',
                }}
              >
                {col.format(value)}
              </Typography>
              {/* The same encoding the table draws, left-anchored here: a card's
                  metrics read as a left-aligned grid, not a right-aligned column. */}
              <MagnitudeBar
                fraction={barFraction(col, value, scales[col.key] ?? 0)}
                tone={col.bar.tone}
                align="left"
              />
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}

/** Placeholder card shown per expected result while the first mobile page loads. */
function SkeletonCard() {
  return (
    <Box
      sx={{
        px: 1.5,
        py: 1.5,
        borderBottom: 1,
        borderColor: 'divider',
        '&:last-of-type': { borderBottom: 0 },
      }}
    >
      <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
        <Skeleton variant="rounded" width={40} height={40} />
        <Box sx={{ flex: 1 }}>
          <Skeleton width={64} />
          <Skeleton width={120} />
        </Box>
      </Stack>
      <Box
        sx={{
          mt: 1.25,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          columnGap: 1,
          rowGap: 1.25,
        }}
      >
        {METRIC_COLUMNS.map((col) => (
          <Box key={col.key}>
            <Skeleton width={40} />
            <Skeleton width={52} />
          </Box>
        ))}
      </Box>
    </Box>
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
  usePageMeta(
    'ETF Screener — Filter US ETFs by AUM & Expense Ratio | Nama Insights',
    'Screen the top US ETFs by category, assets under management and expense ratio.',
  )

  // The committed filters live in the URL (`/etf-screener?categories=…&sort=…`), so a
  // filtered view is shareable, bookmarkable, and restored on refresh and
  // Back/Forward. Each control reads from the query string and writes back through
  // `update`; defaults are omitted so a pristine screen keeps a clean `/etf-screener`.
  const { searchParams, update } = useUrlState()
  const urlQuery = readString(searchParams, 'q')
  const categories = readList(searchParams, 'categories')
  const sort = readEnum<EtfSearchSort>(
    searchParams,
    'sort',
    SORT_VALUES,
    'net_assets',
  )
  const order = readEnum<SortOrder>(searchParams, 'order', ORDER_VALUES, 'desc')
  // `page` rides the URL 1-based (human-friendly) but stays 0-based in code; `rows`
  // is validated against the offered page sizes.
  const page = Math.max(0, readInt(searchParams, 'page', 1) - 1)
  const rowsRaw = readInt(searchParams, 'rows', ROWS_PER_PAGE[0])
  const rowsPerPage = ROWS_PER_PAGE.includes(rowsRaw)
    ? rowsRaw
    : ROWS_PER_PAGE[0]

  // The search box keeps a local value for responsiveness; its debounced form is
  // what commits to the URL (and so drives the query). Seed it from the URL so a
  // deep link shows its term in the field.
  const [searchInput, setSearchInput] = useState(() =>
    readString(searchParams, 'q'),
  )
  const debouncedSearch = useDebounced(searchInput, SEARCH_DEBOUNCE_MS)
  const navigate = useNavigate()
  // The AI-screen box: its own text (separate from the name/ticker filter, which the
  // AI populates) and the mutation that translates it into filters.
  const [aiInput, setAiInput] = useState('')
  const aiScreen = useAiEtfScreen()

  const theme = useTheme()
  // Below `sm` the metrics table gives way to a card list that shows every field (logo
  // included) without a horizontal scroll. useMediaQuery has no matchMedia under jsdom, so
  // this stays false in tests and the table renders.
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  // A filter (or sort) change starts a new result set, so every write drops back to
  // page 1 — otherwise a narrow filter could strand you past its last page. Page-only
  // moves go through `update` directly and keep their page.
  const setFilter = (mutate: (params: URLSearchParams) => void) =>
    update((params) => {
      mutate(params)
      params.delete('page')
    })

  const setCategories = (next: string[]) =>
    setFilter((p) => writeList(p, 'categories', next))
  const setSort = (next: EtfSearchSort) =>
    setFilter((p) => writeEnum(p, 'sort', next, 'net_assets'))
  const setOrder = (next: SortOrder) =>
    setFilter((p) => writeEnum(p, 'order', next, 'desc'))
  const setPage = (next: number) =>
    update((p) => writeInt(p, 'page', next + 1, 1))
  const setRowsPerPage = (next: number) =>
    setFilter((p) => writeInt(p, 'rows', next, ROWS_PER_PAGE[0]))

  // Mirror the committed (debounced) search into the URL, resetting to page 1 on a new
  // term. Fires only on a real edit — not when the URL changes underneath us (an AI
  // screen, a cleared chip, Back/Forward), which would re-add a term the user just
  // dropped. So it keys off the debounced value alone, reading the current URL term and
  // the writer through refs (React Router rebuilds `setSearchParams`/`update` on every
  // navigation). External changes flow the other way, in the effect below.
  const urlQueryRef = useRef(urlQuery)
  const updateRef = useRef(update)
  useEffect(() => {
    urlQueryRef.current = urlQuery
    updateRef.current = update
  })
  useEffect(() => {
    const q = debouncedSearch.trim()
    if (q !== urlQueryRef.current) {
      updateRef.current((p) => {
        writeString(p, 'q', q)
        p.delete('page')
      })
    }
  }, [debouncedSearch])

  // Reflect an externally-driven query (AI screen, cleared chip, Back/Forward) back
  // into the box — but never mid-type: if the box already debounces to the URL's term,
  // leave its raw text (and the cursor) alone.
  useEffect(() => {
    setSearchInput((cur) => (cur.trim() === urlQuery ? cur : urlQuery))
  }, [urlQuery])

  // Apply the AI's interpreted filters — a fresh screen, so it replaces every axis
  // (clearing ones the request didn't set) in a single URL write rather than layering
  // on top. The result flows through the ordinary useEtfSearch and the user can tweak
  // any control. Each value is validated before it drives a typed control; an
  // off-vocabulary sort falls back to the page's default.
  const applyInterpretation = (interp: AiEtfScreenInterpretation) => {
    const q = (interp.query ?? '').trim()
    setSearchInput(q)
    setFilter((p) => {
      writeString(p, 'q', q)
      writeList(p, 'categories', interp.categories)
      writeEnum(
        p,
        'sort',
        interp.sort && VALID_SORTS.has(interp.sort)
          ? (interp.sort as EtfSearchSort)
          : 'net_assets',
        'net_assets',
      )
      writeEnum(p, 'order', interp.direction === 'asc' ? 'asc' : 'desc', 'desc')
    })
  }

  const runAiScreen = (raw?: string) => {
    const request = (raw ?? aiInput).trim()
    if (!request || aiScreen.isPending) return
    if (raw != null) setAiInput(raw) // reflect a one-tap example in the box
    aiScreen.mutate(request, {
      onSuccess: (data) => applyInterpretation(data.interpreted),
    })
  }

  const query = useEtfSearch({
    q: urlQuery || null,
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
  // Memoised so the empty-result fallback isn't a fresh array on every render —
  // that identity is what `barScales` below keys off.
  const rows = useMemo(() => data?.results ?? [], [data])

  // The micro-bars' denominators: the biggest figure each metric carries on this
  // page. Page-scoped because the list is server-paginated — a bar can only honestly
  // say "biggest here", and recomputing per page keeps the shape readable as you
  // move down a sorted list into smaller funds.
  const barScales = useMemo<BarScales>(() => {
    const scales: BarScales = {}
    for (const col of METRIC_COLUMNS) scales[col.key] = pageMax(rows, col.value)
    return scales
  }, [rows])
  // Only the very first load (nothing on screen yet) surfaces an error.
  const showError = query.isError && !data
  const hasFilters = !!urlQuery || categories.length > 0

  // Clicking a sorted column flips its direction; a new column starts descending
  // (biggest / most first, the useful default for each metric) — sort and direction
  // land in one URL write.
  const onSort = (col: EtfSearchSort) => {
    if (sort === col) {
      setOrder(order === 'asc' ? 'desc' : 'asc')
    } else {
      setFilter((p) => {
        writeEnum(p, 'sort', col, 'net_assets')
        writeEnum(p, 'order', 'desc', 'desc')
      })
    }
  }

  const openEtf = (ticker: string) =>
    navigate(`/search?symbol=${encodeURIComponent(ticker)}`)

  const clearFilters = () => {
    setSearchInput('')
    setFilter((p) => {
      p.delete('q')
      p.delete('categories')
    })
  }

  // Every applied narrowing as a one-click-removable chip — the categories the
  // compact multi-select only shows as a count, plus the search term — so the row
  // is a complete, honest summary of what's applied.
  const activeChips: ActiveChip[] = [
    ...(urlQuery
      ? [
          {
            key: 'q',
            label: `“${urlQuery}”`,
            onDelete: () => {
              setSearchInput('')
              setFilter((p) => writeString(p, 'q', ''))
            },
          },
        ]
      : []),
    ...categories.map((c) => ({
      key: `category:${c}`,
      label: humanizeClassification(c),
      onDelete: () => setCategories(categories.filter((x) => x !== c)),
    })),
  ]

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 3, sm: 5 } }}>
      {/* Hero band: the plain-English screen is the primary action; the manual
          filters below are the "or refine by hand" path. */}
      <PageHero
        eyebrowIcon={LayersOutlined}
        eyebrow="ETF screener"
        title="Screen every major US ETF"
        subtitle="Ask in plain English, or filter the top US funds by category, assets under management, expense ratio, and yield."
      >
        <AiScreenBox
          heading="Ask AI to build a screen"
          value={aiInput}
          onChange={setAiInput}
          onSubmit={() => runAiScreen()}
          pending={aiScreen.isPending}
          error={aiScreen.isError ? errorMessage(aiScreen.error) : null}
          placeholder="e.g. Low-cost S&P 500 index funds, or High-yield dividend ETFs"
          inputAriaLabel="Describe the ETFs you want"
          examples={AI_EXAMPLES}
          onExample={(ex) => runAiScreen(ex)}
        />
      </PageHero>

      {/* Filter card */}
      <Paper
        variant="outlined"
        sx={{
          mt: { xs: 2.5, sm: 3 },
          p: { xs: 1.5, sm: 2 },
          borderRadius: 3,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: 'center', mb: 1.75, color: 'text.secondary' }}
        >
          <TuneOutlined sx={{ fontSize: 18 }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Refine by hand
          </Typography>
        </Stack>
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
            minWidth={{ xs: '100%', md: 220 }}
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
                onClick={() => setOrder(order === 'asc' ? 'desc' : 'asc')}
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

      {/* Results toolbar: the live match count on the left, refresh on the right. */}
      <Stack
        direction="row"
        spacing={1}
        sx={{
          mt: { xs: 3, sm: 3.5 },
          minHeight: 34,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box aria-live="polite">
          {data && (
            <Typography
              variant="body2"
              sx={{ color: 'text.secondary', fontWeight: 500 }}
            >
              {/* Count + unit stay in one text node so a screen reader (and the
                  test suite) reads "N ETFs" as one phrase. */}
              <Box
                component="span"
                sx={{ color: 'text.primary', fontWeight: 700 }}
              >
                {`${data.total.toLocaleString()} ${data.total === 1 ? 'ETF' : 'ETFs'}`}
              </Box>
              {hasFilters ? ' match your filters' : ' in the universe'}
            </Typography>
          )}
        </Box>
        <Tooltip title="Refresh">
          <IconButton
            onClick={() => query.refetch()}
            aria-label="Refresh ETF screener"
            size="small"
            sx={{ color: 'text.secondary' }}
          >
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      {showError && (
        <Alert severity="error" variant="outlined" sx={{ mt: 3 }}>
          {errorMessage(query.error)}
        </Alert>
      )}

      {!showError && (
        <>
          {isMobile && (
            <Box
              sx={{
                mt: 1.5,
                border: 1,
                borderColor: 'divider',
                borderRadius: 3,
                bgcolor: 'background.paper',
                overflow: 'hidden',
                // Dim while a new page/sort loads (previous cards stay put).
                transition: 'opacity 150ms ease',
                opacity: query.isFetching && !query.isLoading ? 0.6 : 1,
              }}
            >
              {query.isLoading &&
                Array.from({ length: Math.min(rowsPerPage, 10) }).map(
                  (_, i) => <SkeletonCard key={i} />,
                )}
              {data && rows.length === 0 && (
                <Box
                  sx={{ py: 5, textAlign: 'center', color: 'text.secondary' }}
                >
                  No ETFs match these filters.
                </Box>
              )}
              {rows.map((etf) => (
                <EtfListCard
                  key={etf.ticker}
                  etf={etf}
                  onSelect={openEtf}
                  scales={barScales}
                />
              ))}
            </Box>
          )}

          {!isMobile && (
            <TableContainer
              sx={{
                mt: 1.5,
                border: 1,
                borderColor: 'divider',
                borderRadius: 3,
                bgcolor: 'background.paper',
                overflow: 'auto',
                // Cap the height on desktop; on phones (xs) drop the cap so the page
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
                  {rows.map((etf, i) => (
                    <EtfRow
                      key={etf.ticker}
                      etf={etf}
                      rank={page * rowsPerPage + i + 1}
                      onSelect={openEtf}
                      sort={sort}
                      scales={barScales}
                    />
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          <TablePagination
            component="div"
            count={data?.total ?? 0}
            page={page}
            onPageChange={(_, next) => setPage(next)}
            rowsPerPage={rowsPerPage}
            rowsPerPageOptions={ROWS_PER_PAGE}
            onRowsPerPageChange={(e) => setRowsPerPage(Number(e.target.value))}
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
