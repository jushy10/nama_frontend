import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Avatar,
  Box,
  Container,
  IconButton,
  MenuItem,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import {
  stockLogoUrl,
  GICS_SECTORS,
  SCREENER_INDICES,
  type ScreenedStock,
  type StockIndex,
} from '@/lib/api'
import { errorMessage, useScreener } from '@/lib/queries'

// Re-poll on the same cadence the rest of the app promises.
const REFRESH_MS = 60_000
// "Names per side" choices, matching the API's 1–50 limit.
const LIMITS = [10, 25, 50]

type Side = 'gainers' | 'losers'

const fmtPrice = (n: number | null) =>
  n == null
    ? '—'
    : n.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })

const fmtSigned = (n: number | null) =>
  n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(2)}`

const fmtPct = (n: number | null) =>
  n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`

const moveColor = (n: number | null | undefined) =>
  n == null ? 'text.secondary' : n >= 0 ? 'success.main' : 'error.main'

// Columns hidden on narrow screens degrade gracefully — symbol/price/%-change
// always show; sector and absolute change drop first as width shrinks.
const HIDE_SM = { display: { xs: 'none', sm: 'table-cell' } } as const
const HIDE_MD = { display: { xs: 'none', md: 'table-cell' } } as const

/** Company logo in a white rounded tile, falling back to the ticker's initial. */
function StockLogo({ symbol, size = 32 }: { symbol: string; size?: number }) {
  return (
    <Avatar
      variant="rounded"
      src={stockLogoUrl(symbol)}
      alt={`${symbol} logo`}
      slotProps={{
        img: { loading: 'lazy', style: { objectFit: 'contain' } },
      }}
      sx={{
        width: size,
        height: size,
        bgcolor: '#fff',
        color: '#111',
        p: 0.5,
      }}
    >
      {symbol.charAt(0)}
    </Avatar>
  )
}

/**
 * Hero card for the single best (or worst) name of the day. Clicking through
 * opens the stock's detail page, same as a table row.
 */
function TopMoverCard({
  label,
  stock,
  loading,
  onSelect,
}: {
  label: string
  stock: ScreenedStock | null
  loading: boolean
  onSelect: (symbol: string) => void
}) {
  const up = label === 'Top gainer'
  return (
    <Paper
      variant="outlined"
      onClick={stock ? () => onSelect(stock.symbol) : undefined}
      onKeyDown={(e) => {
        if (stock && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onSelect(stock.symbol)
        }
      }}
      tabIndex={stock ? 0 : undefined}
      role={stock ? 'link' : undefined}
      aria-label={stock ? `View ${stock.symbol} details` : undefined}
      sx={{
        p: 2.5,
        flex: 1,
        borderRadius: 3,
        bgcolor: 'action.hover',
        cursor: stock ? 'pointer' : 'default',
        transition: 'border-color 150ms ease',
        '&:hover': stock
          ? { borderColor: up ? 'success.main' : 'error.main' }
          : {},
      }}
    >
      <Stack
        direction="row"
        spacing={0.75}
        sx={{
          alignItems: 'center',
          color: up ? 'success.main' : 'error.main',
        }}
      >
        {up ? (
          <TrendingUpIcon fontSize="small" />
        ) : (
          <TrendingDownIcon fontSize="small" />
        )}
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {label}
        </Typography>
      </Stack>
      {loading && (
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ mt: 1.5, alignItems: 'center' }}
        >
          <Skeleton variant="rounded" width={40} height={40} />
          <Box sx={{ flex: 1 }}>
            <Skeleton width={72} />
            <Skeleton width={140} />
          </Box>
          <Skeleton width={72} />
        </Stack>
      )}
      {!loading && !stock && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          No names match these filters.
        </Typography>
      )}
      {!loading && stock && (
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ mt: 1.5, alignItems: 'center', minWidth: 0 }}
        >
          <StockLogo symbol={stock.symbol} size={40} />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              {stock.symbol}
            </Typography>
            {stock.name && (
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
                {stock.name}
              </Typography>
            )}
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography
              sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
            >
              ${fmtPrice(stock.price)}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                color: moveColor(stock.change_percent),
              }}
            >
              {fmtPct(stock.change_percent)}
            </Typography>
          </Box>
        </Stack>
      )}
    </Paper>
  )
}

/** One screened name: rank, logo + symbol/name, sector, price, change, % change. */
function StockRow({
  rank,
  stock,
  onSelect,
}: {
  rank: number
  stock: ScreenedStock
  onSelect: (symbol: string) => void
}) {
  const up = (stock.change_percent ?? 0) >= 0
  return (
    <TableRow
      hover
      onClick={() => onSelect(stock.symbol)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(stock.symbol)
        }
      }}
      tabIndex={0}
      role="link"
      aria-label={`View ${stock.symbol} details`}
      sx={{ cursor: 'pointer', '&:last-child td': { border: 0 } }}
    >
      <TableCell
        sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}
      >
        {rank}
      </TableCell>
      <TableCell>
        <Stack
          direction="row"
          spacing={{ xs: 0, sm: 1.5 }}
          sx={{ alignItems: 'center', minWidth: 0 }}
        >
          {/* Logo hidden on phones to keep #/symbol/price/%-change on one screen. */}
          <Box sx={{ display: { xs: 'none', sm: 'flex' } }}>
            <StockLogo symbol={stock.symbol} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              {stock.symbol}
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
        {stock.sector ?? '—'}
      </TableCell>
      <TableCell
        align="right"
        sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
      >
        ${fmtPrice(stock.price)}
      </TableCell>
      <TableCell
        align="right"
        sx={{
          ...HIDE_SM,
          color: moveColor(stock.change),
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {fmtSigned(stock.change)}
      </TableCell>
      <TableCell align="right">
        <Stack
          direction="row"
          sx={{
            alignItems: 'center',
            justifyContent: 'flex-end',
            color: moveColor(stock.change_percent),
          }}
        >
          {stock.change_percent != null &&
            (up ? (
              <ArrowDropUpIcon fontSize="small" sx={{ mx: -0.5 }} />
            ) : (
              <ArrowDropDownIcon fontSize="small" sx={{ mx: -0.5 }} />
            ))}
          <Typography
            variant="body2"
            sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
          >
            {fmtPct(stock.change_percent)}
          </Typography>
        </Stack>
      </TableCell>
    </TableRow>
  )
}

/** Placeholder row shown per expected result while the first fetch is in flight. */
function SkeletonRow() {
  return (
    <TableRow>
      <TableCell>
        <Skeleton width={16} />
      </TableCell>
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
        <Skeleton width={120} />
      </TableCell>
      <TableCell align="right">
        <Skeleton width={64} sx={{ ml: 'auto' }} />
      </TableCell>
      <TableCell align="right" sx={HIDE_SM}>
        <Skeleton width={48} sx={{ ml: 'auto' }} />
      </TableCell>
      <TableCell align="right">
        <Skeleton width={64} sx={{ ml: 'auto' }} />
      </TableCell>
    </TableRow>
  )
}

/**
 * Screener page: filter the universe by index and sector, spotlight the day's
 * single best and worst name, and read the top gainers or losers in a table.
 * Loads on mount, re-runs whenever a filter changes, and quietly re-polls
 * every minute. A background refresh that fails leaves the current table in
 * place rather than blanking it.
 */
export default function Screener() {
  const [index, setIndex] = useState<StockIndex | 'all'>('all')
  const [sector, setSector] = useState<string>('all')
  const [limit, setLimit] = useState<number>(10)
  const [side, setSide] = useState<Side>('gainers')
  const navigate = useNavigate()

  // Filters live in the query key, so changing one refetches (and aborts the
  // in-flight request); `side` is local, so flipping gainers/losers just
  // re-slices the cached result. Re-polls every minute in the background.
  const screenerQuery = useScreener(
    {
      index: index === 'all' ? null : index,
      sector: sector === 'all' ? null : sector,
      limit,
    },
    { refetchInterval: REFRESH_MS },
  )
  const data = screenerQuery.data ?? null
  const rows = data?.[side] ?? []
  // Only the first load (nothing on screen yet) surfaces an error; a failed
  // background poll keeps the last good table, since React Query retains `data`.
  const showError = screenerQuery.isError && !data

  const openStock = (symbol: string) =>
    navigate(`/stocks?symbol=${encodeURIComponent(symbol)}`)

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
            Screener
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            The day's top movers — filter by index and sector, then flip between
            gainers and losers.
          </Typography>
        </Box>
        <Tooltip title="Refresh">
          <IconButton
            onClick={() => screenerQuery.refetch()}
            aria-label="Refresh screener"
            sx={{ color: 'text.secondary' }}
          >
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* Day's standout names under the current filters. */}
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mt: 4 }}>
        <TopMoverCard
          label="Top gainer"
          stock={data?.gainers[0] ?? null}
          loading={screenerQuery.isLoading}
          onSelect={openStock}
        />
        <TopMoverCard
          label="Top loser"
          stock={data?.losers[0] ?? null}
          loading={screenerQuery.isLoading}
          onSelect={openStock}
        />
      </Stack>

      {/* Filters */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        sx={{ mt: 4, flexWrap: 'wrap', alignItems: { sm: 'center' } }}
      >
        <TextField
          select
          size="small"
          label="Index"
          value={index}
          onChange={(e) => setIndex(e.target.value as StockIndex | 'all')}
          sx={{ minWidth: 150 }}
        >
          <MenuItem value="all">All names</MenuItem>
          {SCREENER_INDICES.map((i) => (
            <MenuItem key={i.value} value={i.value}>
              {i.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Sector"
          value={sector}
          onChange={(e) => setSector(e.target.value)}
          sx={{ minWidth: 210 }}
        >
          <MenuItem value="all">All sectors</MenuItem>
          {GICS_SECTORS.map((s) => (
            <MenuItem key={s} value={s}>
              {s}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Per side"
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          sx={{ minWidth: 110 }}
        >
          {LIMITS.map((n) => (
            <MenuItem key={n} value={n}>
              {n}
            </MenuItem>
          ))}
        </TextField>

        <Box sx={{ flexGrow: 1, display: { xs: 'none', sm: 'block' } }} />

        <ToggleButtonGroup
          size="small"
          exclusive
          value={side}
          onChange={(_, value: Side | null) => value && setSide(value)}
          aria-label="Gainers or losers"
          sx={{
            width: { xs: '100%', sm: 'auto' },
            '& .MuiToggleButton-root': { flex: { xs: 1, sm: 'none' } },
          }}
        >
          <ToggleButton value="gainers" sx={{ px: 2, py: 0.5 }}>
            Gainers
          </ToggleButton>
          <ToggleButton value="losers" sx={{ px: 2, py: 0.5 }}>
            Losers
          </ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {/* Summary line */}
      {data && (
        <Stack
          direction="row"
          spacing={2}
          sx={{ mt: 2, flexWrap: 'wrap', color: 'text.secondary' }}
        >
          <Typography variant="body2">
            {data.quoted_count.toLocaleString()} of{' '}
            {data.universe_count.toLocaleString()} names quoted
          </Typography>
          {data.as_of && (
            <Typography variant="body2">
              As of {new Date(data.as_of).toLocaleString()}
            </Typography>
          )}
        </Stack>
      )}

      {showError && (
        <Alert severity="error" variant="outlined" sx={{ mt: 3 }}>
          {errorMessage(screenerQuery.error)}
        </Alert>
      )}

      {!showError && (
        <TableContainer
          sx={{
            mt: 3,
            border: 1,
            borderColor: 'divider',
            borderRadius: 2,
            bgcolor: 'action.hover',
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
                <TableCell sx={{ width: { xs: 32, sm: 48 } }}>#</TableCell>
                <TableCell>Symbol</TableCell>
                <TableCell sx={HIDE_MD}>Sector</TableCell>
                <TableCell align="right">Price</TableCell>
                <TableCell align="right" sx={HIDE_SM}>
                  Change
                </TableCell>
                <TableCell align="right">% Change</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {screenerQuery.isLoading &&
                Array.from({ length: Math.min(limit, 10) }).map((_, i) => (
                  <SkeletonRow key={i} />
                ))}
              {data && rows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    sx={{
                      py: 5,
                      textAlign: 'center',
                      color: 'text.secondary',
                    }}
                  >
                    No names match these filters.
                  </TableCell>
                </TableRow>
              )}
              {data &&
                rows.map((stock, i) => (
                  <StockRow
                    key={stock.symbol}
                    rank={i + 1}
                    stock={stock}
                    onSelect={openStock}
                  />
                ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Container>
  )
}
