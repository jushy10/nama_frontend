import {
  Alert,
  Avatar,
  Box,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import { stockLogoUrl, type Sector, type Stock } from '@/lib/api'
import { useStocks } from '@/lib/queries'

/**
 * Top constituents per S&P sector, by index weight (heaviest first). The backend
 * exposes no holdings endpoint, so we keep a curated list here and pull a live
 * snapshot for each ticker. Keys must match the API's `sector` names.
 */
const SECTOR_CONSTITUENTS: Record<string, string[]> = {
  Technology: ['AAPL', 'MSFT', 'NVDA', 'AVGO', 'ORCL', 'CRM'],
  Financials: ['JPM', 'V', 'MA', 'BAC', 'WFC', 'GS'],
  'Health Care': ['LLY', 'UNH', 'JNJ', 'ABBV', 'MRK', 'TMO'],
  Energy: ['XOM', 'CVX', 'COP', 'WMB', 'EOG', 'SLB'],
  'Consumer Discretionary': ['AMZN', 'TSLA', 'HD', 'MCD', 'BKNG', 'LOW'],
  'Consumer Staples': ['COST', 'WMT', 'PG', 'KO', 'PEP', 'PM'],
  Industrials: ['GE', 'CAT', 'RTX', 'UBER', 'BA', 'HON'],
  Materials: ['LIN', 'SHW', 'ECL', 'FCX', 'NEM', 'APD'],
  Utilities: ['NEE', 'SO', 'DUK', 'CEG', 'AEP', 'D'],
  'Real Estate': ['PLD', 'AMT', 'EQIX', 'WELL', 'SPG', 'PSA'],
  'Communication Services': ['META', 'GOOGL', 'NFLX', 'DIS', 'TMUS', 'T'],
}

const fmt = (n: number | null) =>
  n == null
    ? '—'
    : n.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })

const fmtPct = (n: number | null) =>
  n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`

const moveColor = (n: number | null | undefined) =>
  n == null ? 'text.secondary' : n >= 0 ? 'success.main' : 'error.main'

/** One holding row: logo + symbol/name on the left, price + day move on the right. */
function HoldingRow({ stock }: { stock: Stock }) {
  const up = (stock.change_percent ?? 0) >= 0
  return (
    <Stack
      direction="row"
      spacing={1.5}
      sx={{
        alignItems: 'center',
        justifyContent: 'space-between',
        py: 1,
        px: 1.5,
        borderRadius: 2,
        bgcolor: 'action.hover',
      }}
    >
      <Stack
        direction="row"
        spacing={1.5}
        sx={{ alignItems: 'center', minWidth: 0 }}
      >
        <Avatar
          variant="rounded"
          src={stockLogoUrl(stock.symbol)}
          alt={`${stock.symbol} logo`}
          slotProps={{
            img: { loading: 'lazy', style: { objectFit: 'contain' } },
          }}
          sx={{ width: 32, height: 32, bgcolor: '#fff', color: '#111', p: 0.5 }}
        >
          {stock.symbol.charAt(0)}
        </Avatar>
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
      <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
        <Typography
          sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
        >
          ${fmt(stock.price)}
        </Typography>
        <Stack
          direction="row"
          sx={{
            alignItems: 'center',
            justifyContent: 'flex-end',
            color: moveColor(stock.change_percent),
          }}
        >
          {up ? (
            <ArrowDropUpIcon fontSize="small" />
          ) : (
            <ArrowDropDownIcon fontSize="small" />
          )}
          <Typography
            variant="body2"
            sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
          >
            {fmtPct(stock.change_percent)}
          </Typography>
        </Stack>
      </Box>
    </Stack>
  )
}

/**
 * Modal listing a sector's top holdings with live snapshots. Open when `sector`
 * is non-null; closes via the close button, backdrop, or Esc.
 */
export default function SectorStocksDialog({
  sector,
  onClose,
}: {
  sector: Sector | null
  onClose: () => void
}) {
  // Curated constituents for the open sector; the query stays idle until the
  // dialog opens on a sector that has any. A failed ticker comes back null and
  // is filtered out — getStocks never rejects the whole batch.
  const tickers = sector ? (SECTOR_CONSTITUENTS[sector.sector] ?? []) : []
  const { data, isLoading, isError } = useStocks(tickers, {
    enabled: !!sector && tickers.length > 0,
  })
  const stocks = (data ?? []).filter((s): s is Stock => s != null)

  return (
    <Dialog open={sector != null} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pr: 6 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Typography component="span" sx={{ fontWeight: 700 }}>
            {sector?.sector}
          </Typography>
          {sector && (
            <Chip
              label={sector.symbol}
              size="small"
              sx={{ height: 18, fontSize: '0.65rem' }}
            />
          )}
        </Stack>
        <Typography variant="caption" color="text.secondary">
          Top holdings by index weight
        </Typography>
        <IconButton
          onClick={onClose}
          aria-label="Close"
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: 'text.secondary',
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {isLoading && (
          <Stack sx={{ alignItems: 'center', py: 4 }}>
            <CircularProgress />
          </Stack>
        )}
        {isError && (
          <Alert severity="error" variant="outlined">
            Could not load holdings. Please try again.
          </Alert>
        )}
        {!isLoading &&
          !isError &&
          (stocks.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 2 }}>
              No holdings available for this sector.
            </Typography>
          ) : (
            <Stack spacing={1}>
              {stocks.map((s) => (
                <HoldingRow key={s.symbol} stock={s} />
              ))}
            </Stack>
          ))}
      </DialogContent>
    </Dialog>
  )
}
