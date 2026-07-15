import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
  Alert,
  Box,
  Card,
  Chip,
  Container,
  Divider,
  Link,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import AccountBalanceIcon from '@mui/icons-material/AccountBalance'
import {
  CONGRESS_METRICS,
  CONGRESS_WINDOWS,
  type CongressLeaderboardEntry,
  type CongressMetric,
  type CongressTrade,
  type CongressWindow,
} from '@/lib/api'
import {
  errorMessage,
  useCongressActivity,
  useCongressLeaderboard,
} from '@/lib/queries'
import { usePageMeta } from '@/lib/usePageMeta'
import PageHero from '@/components/PageHero'

const ROWS_PER_PAGE = [25, 50, 100]

// Columns that fold away on the narrowest screens so the essentials (member,
// ticker, trade, amount) always fit without a horizontal scroll on a phone.
const HIDE_SM = { display: { xs: 'none', sm: 'table-cell' } } as const
const HIDE_MD = { display: { xs: 'none', md: 'table-cell' } } as const

/** "Jul 2, 2026" from an ISO date, parsed as a local date. */
function dayLabel(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// How many stocks to rank on the attention board.
const LEADERBOARD_LIMIT = 12

/** Compact USD like "$1.2M" — an *estimate*, since Congress discloses only bands. */
function compactUsd(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n)
}

// The three attention stats a card shows, in display order — the active ranking
// metric is emphasised, the other two read as supporting context.
const CARD_STATS: { key: CongressMetric; label: string }[] = [
  { key: 'members', label: 'Members' },
  { key: 'trades', label: 'Trades' },
  { key: 'value', label: '$ Volume' },
]

/** A one-line description of what the active ranking metric means. */
function metricBlurb(metric: CongressMetric): string {
  if (metric === 'members')
    return 'the number of distinct members trading each stock'
  if (metric === 'trades') return 'the number of disclosed trades'
  return 'estimated dollars traded (band midpoints)'
}

/**
 * One stock on the attention board: its rank, ticker, the three attention stats
 * (with the active ranking metric emphasised), and the buy-vs-sell lean as a split
 * bar plus the estimated net dollar flow.
 */
function LeaderboardCard({
  rank,
  entry,
  metric,
}: {
  rank: number
  entry: CongressLeaderboardEntry
  metric: CongressMetric
}) {
  const decided = entry.buy_count + entry.sell_count
  const buyPct = decided ? (entry.buy_count / decided) * 100 : 0
  const netTone =
    entry.net_value > 0
      ? 'success.main'
      : entry.net_value < 0
        ? 'error.main'
        : 'text.secondary'
  const statValue = (key: CongressMetric): string =>
    key === 'members'
      ? String(entry.member_count)
      : key === 'trades'
        ? String(entry.trade_count)
        : compactUsd(entry.total_value)

  return (
    <Card
      variant="outlined"
      sx={{
        p: 2,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.25,
        borderColor: 'divider',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
        <Typography
          sx={{ color: 'text.secondary', fontWeight: 700, fontSize: '0.8rem' }}
        >
          #{rank}
        </Typography>
        <Link
          component={RouterLink}
          to={`/search?symbol=${encodeURIComponent(entry.ticker)}`}
          aria-label={`View ${entry.ticker} details`}
          sx={{ fontWeight: 800, fontSize: '1.05rem', textDecoration: 'none' }}
        >
          {entry.ticker}
        </Link>
      </Box>
      {entry.name && (
        <Typography
          variant="caption"
          color="text.secondary"
          noWrap
          title={entry.name}
          sx={{ mt: -1 }}
        >
          {entry.name}
        </Typography>
      )}

      <Box sx={{ display: 'flex', gap: 1.5 }}>
        {CARD_STATS.map((stat) => {
          const active = stat.key === metric
          return (
            <Box key={stat.key} sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                sx={{
                  fontWeight: active ? 800 : 600,
                  fontSize: active ? '1.2rem' : '1rem',
                  lineHeight: 1.2,
                  color: active ? 'text.primary' : 'text.secondary',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {statValue(stat.key)}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  color: active ? 'primary.main' : 'text.secondary',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  fontWeight: active ? 700 : 400,
                }}
              >
                {stat.label}
              </Typography>
            </Box>
          )
        })}
      </Box>

      {/* Buy-vs-sell lean, with the estimated net dollar flow between the counts. */}
      <Box sx={{ mt: 'auto' }}>
        <Box
          sx={{
            display: 'flex',
            height: 6,
            borderRadius: 3,
            overflow: 'hidden',
            bgcolor: 'action.hover',
          }}
        >
          {decided > 0 && (
            <>
              <Box sx={{ width: `${buyPct}%`, bgcolor: 'success.main' }} />
              <Box sx={{ width: `${100 - buyPct}%`, bgcolor: 'error.main' }} />
            </>
          )}
        </Box>
        <Box
          sx={{
            mt: 0.5,
            display: 'flex',
            justifyContent: 'space-between',
            gap: 1,
            fontSize: '0.72rem',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <Box component="span" sx={{ color: 'success.main', fontWeight: 600 }}>
            {entry.buy_count} buy{entry.buy_count === 1 ? '' : 's'}
          </Box>
          <Box component="span" sx={{ color: netTone, fontWeight: 700 }}>
            {entry.net_value > 0 ? '+' : ''}
            {compactUsd(entry.net_value)}
          </Box>
          <Box component="span" sx={{ color: 'error.main', fontWeight: 600 }}>
            {entry.sell_count} sell{entry.sell_count === 1 ? '' : 's'}
          </Box>
        </Box>
      </Box>
    </Card>
  )
}

function LeaderboardCardSkeleton() {
  return (
    <Card variant="outlined" sx={{ p: 2, borderColor: 'divider' }}>
      <Skeleton width="45%" height={28} />
      <Skeleton width="70%" />
      <Skeleton width="100%" height={44} sx={{ mt: 1 }} />
      <Skeleton width="100%" height={12} sx={{ mt: 1.5 }} />
    </Card>
  )
}

/** The trade action as a coloured label with a ▲/▼ glyph. */
function TradeCell({ trade }: { trade: CongressTrade }) {
  const tone = trade.is_buy
    ? 'success.main'
    : trade.is_sell
      ? 'error.main'
      : 'text.secondary'
  const glyph = trade.is_buy ? '▲' : trade.is_sell ? '▼' : ''
  const label = trade.is_buy
    ? 'Buy'
    : trade.is_sell
      ? 'Sell'
      : trade.tx_type === 'Exchange'
        ? 'Exchange'
        : trade.tx_type
  return (
    <Box component="span" sx={{ color: tone, fontWeight: 700 }}>
      {glyph && (
        <Box component="span" sx={{ fontSize: '0.7em', mr: 0.5 }}>
          {glyph}
        </Box>
      )}
      {label}
    </Box>
  )
}

function SkeletonRow() {
  return (
    <TableRow>
      <TableCell>
        <Skeleton width="70%" />
      </TableCell>
      <TableCell sx={HIDE_SM}>
        <Skeleton width={54} />
      </TableCell>
      <TableCell>
        <Skeleton width={48} />
      </TableCell>
      <TableCell>
        <Skeleton width={44} />
      </TableCell>
      <TableCell align="right">
        <Skeleton width="80%" sx={{ ml: 'auto' }} />
      </TableCell>
      <TableCell align="right" sx={HIDE_MD}>
        <Skeleton width={80} sx={{ ml: 'auto' }} />
      </TableCell>
      <TableCell align="right">
        <Skeleton width={80} sx={{ ml: 'auto' }} />
      </TableCell>
    </TableRow>
  )
}

const COLS = 7

/**
 * The market-wide Congress trades board: every recent STOCK Act disclosure across
 * the screened universe, newest first, windowed by disclosure date and paged. Each
 * ticker links into its stock detail.
 */
export default function Congress() {
  usePageMeta(
    'US Congress Stock Trades — Who’s Buying & Selling | Nama Insights',
    'Track recent stock trades disclosed by members of the US House and Senate under the STOCK Act — member, chamber, buy or sell, dollar range and dates.',
  )

  const [windowKey, setWindowKey] = useState<CongressWindow>('30d')
  const [metricKey, setMetricKey] = useState<CongressMetric>('members')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(50)

  const query = useCongressActivity({
    window: windowKey,
    limit: rowsPerPage,
    offset: page * rowsPerPage,
  })
  const data = query.data ?? null
  const rows = data?.items ?? []
  // Only a first load with nothing to show should surface the error; a refetch
  // keeps the previous page on screen (keepPreviousData).
  const showError = query.isError && !data

  // The attention board shares the window selector; its own metric selector picks
  // the ranking. Both reads ride the same weekly-refreshed DB cache.
  const boardQuery = useCongressLeaderboard({
    window: windowKey,
    metric: metricKey,
    limit: LEADERBOARD_LIMIT,
  })
  const board = boardQuery.data ?? null
  const boardRows = board?.items ?? []
  const boardShowError = boardQuery.isError && !board

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 3, sm: 5 } }}>
      <PageHero
        eyebrowIcon={AccountBalanceIcon}
        eyebrow="Congress trades"
        title="Congress stock trades"
        subtitle={
          <>
            Recent stock trades disclosed by members of the US House and Senate
            under the STOCK Act. Congress reports a dollar <em>range</em>, not
            an exact amount, and can file up to 45 days after the trade.
          </>
        }
      />

      {/* Window selector — over the disclosure date. */}
      <Box sx={{ mt: 3 }}>
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Disclosed within
        </Typography>
        <Box sx={{ mt: 0.5 }}>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={windowKey}
            onChange={(_, value: CongressWindow | null) => {
              if (value) {
                setWindowKey(value)
                setPage(0)
              }
            }}
            aria-label="Disclosure window"
            sx={{ flexWrap: 'wrap', rowGap: 0.5 }}
          >
            {CONGRESS_WINDOWS.map((w) => (
              <ToggleButton key={w.key} value={w.key} sx={{ px: 2 }}>
                {w.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
      </Box>

      {/* Attention leaderboard — the stocks Congress is trading the most. */}
      <Box sx={{ mt: 4 }}>
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 1,
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            Getting the most attention
          </Typography>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={metricKey}
            onChange={(_, value: CongressMetric | null) => {
              if (value) setMetricKey(value)
            }}
            aria-label="Rank by"
            sx={{ flexWrap: 'wrap', rowGap: 0.5 }}
          >
            {CONGRESS_METRICS.map((m) => (
              <ToggleButton key={m.key} value={m.key} sx={{ px: 1.75 }}>
                {m.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
        <Typography variant="caption" color="text.secondary">
          Ranked by {metricBlurb(metricKey)}
          {board && board.total > 0
            ? ` — ${board.total.toLocaleString('en-US')} stocks traded this window.`
            : '.'}
        </Typography>

        {boardShowError && (
          <Alert severity="error" variant="outlined" sx={{ mt: 2 }}>
            {errorMessage(
              boardQuery.error,
              'Could not load the attention board.',
            )}
          </Alert>
        )}

        <Box
          sx={{
            mt: 2,
            display: 'grid',
            gap: 1.5,
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, 1fr)',
              md: 'repeat(3, 1fr)',
              lg: 'repeat(4, 1fr)',
            },
            // Dim while a window/metric change refetches, keeping the prior ranking
            // readable rather than flashing empty (keepPreviousData).
            opacity: boardQuery.isFetching && !boardQuery.isLoading ? 0.6 : 1,
            transition: 'opacity 0.15s ease',
          }}
        >
          {boardQuery.isLoading &&
            Array.from({ length: 8 }).map((_, i) => (
              <LeaderboardCardSkeleton key={i} />
            ))}
          {boardRows.map((entry, i) => (
            <LeaderboardCard
              key={entry.ticker}
              rank={i + 1}
              entry={entry}
              metric={metricKey}
            />
          ))}
        </Box>

        {board &&
          boardRows.length === 0 &&
          !boardQuery.isLoading &&
          !boardShowError && (
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              No stocks to rank in this window yet.
            </Typography>
          )}
      </Box>

      <Divider sx={{ mt: 5 }} />
      <Typography variant="h6" sx={{ fontWeight: 800, mt: 3 }}>
        All trades
      </Typography>

      {data && (
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>
            {data.total.toLocaleString('en-US')}
          </Box>{' '}
          {data.total === 1 ? 'trade' : 'trades'} disclosed in this window.
        </Typography>
      )}

      {showError && (
        <Alert severity="error" variant="outlined" sx={{ mt: 3 }}>
          {errorMessage(query.error, 'Could not load Congressional trades.')}
        </Alert>
      )}

      <TableContainer
        sx={{
          mt: 2,
          border: 1,
          borderColor: 'divider',
          borderRadius: 2,
          // Dim while a refetch (window/page change) is in flight, keeping the
          // previous rows readable rather than flashing empty.
          opacity: query.isFetching && !query.isLoading ? 0.6 : 1,
          transition: 'opacity 0.15s ease',
        }}
      >
        <Table size="small" sx={{ '& td, & th': { borderColor: 'divider' } }}>
          <TableHead>
            <TableRow>
              <TableCell>Member</TableCell>
              <TableCell sx={HIDE_SM}>Chamber</TableCell>
              <TableCell>Ticker</TableCell>
              <TableCell>Trade</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell align="right" sx={HIDE_MD}>
                Traded
              </TableCell>
              <TableCell align="right">Disclosed</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {query.isLoading &&
              Array.from({ length: Math.min(rowsPerPage, 10) }).map((_, i) => (
                <SkeletonRow key={i} />
              ))}

            {data && rows.length === 0 && !query.isLoading && (
              <TableRow>
                <TableCell colSpan={COLS} sx={{ textAlign: 'center', py: 5 }}>
                  <Typography color="text.secondary">
                    No Congressional trades in this window yet. Try a longer
                    window, or check back — the board refreshes weekly.
                  </Typography>
                </TableCell>
              </TableRow>
            )}

            {rows.map((t, i) => (
              <TableRow
                key={`${t.member}-${t.ticker}-${t.transaction_date}-${i}`}
                hover
              >
                <TableCell sx={{ fontWeight: 600 }}>{t.member}</TableCell>
                <TableCell sx={HIDE_SM}>
                  <Chip
                    label={t.chamber}
                    size="small"
                    variant="outlined"
                    sx={{ borderColor: 'divider' }}
                  />
                </TableCell>
                <TableCell>
                  <Link
                    component={RouterLink}
                    to={`/search?symbol=${encodeURIComponent(t.ticker)}`}
                    aria-label={`View ${t.ticker} details`}
                    sx={{ fontWeight: 700, textDecoration: 'none' }}
                  >
                    {t.ticker}
                  </Link>
                </TableCell>
                <TableCell>
                  <TradeCell trade={t} />
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    fontVariantNumeric: 'tabular-nums',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t.amount_range ?? '—'}
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    ...HIDE_MD,
                    fontVariantNumeric: 'tabular-nums',
                    whiteSpace: 'nowrap',
                    color: 'text.secondary',
                  }}
                >
                  {dayLabel(t.transaction_date)}
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    fontVariantNumeric: 'tabular-nums',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {dayLabel(t.disclosure_date)}
                </TableCell>
              </TableRow>
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
      />

      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ mt: 1, display: 'block' }}
      >
        Source: members’ public STOCK Act disclosures. For informational
        purposes only — not investment advice.
      </Typography>
    </Container>
  )
}
