import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
  Alert,
  Box,
  Chip,
  Container,
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
  CONGRESS_WINDOWS,
  type CongressTrade,
  type CongressWindow,
} from '@/lib/api'
import { errorMessage, useCongressActivity } from '@/lib/queries'
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

      {data && (
        <Typography color="text.secondary" sx={{ mt: 2 }}>
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
