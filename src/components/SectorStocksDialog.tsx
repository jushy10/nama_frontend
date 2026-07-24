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
  useMediaQuery,
  useTheme,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import { Link as RouterLink } from 'react-router-dom'
import { stockLogoUrl, type Sector, type TickerCard } from '@/lib/api'
import { useTickerCards } from '@/hooks/queries'

/**
 * Top ten constituents per S&P sector, by index weight (heaviest first). The
 * backend exposes no holdings endpoint, so we keep a curated list here and pull
 * a live snapshot for each ticker. Keys must match the API's `sector` names.
 */
const SECTOR_CONSTITUENTS: Record<string, string[]> = {
  Technology: [
    'AAPL',
    'MSFT',
    'NVDA',
    'AVGO',
    'ORCL',
    'CRM',
    'CSCO',
    'ACN',
    'AMD',
    'IBM',
  ],
  Financials: ['JPM', 'V', 'MA', 'BAC', 'WFC', 'GS', 'AXP', 'MS', 'SPGI', 'C'],
  'Health Care': [
    'LLY',
    'UNH',
    'JNJ',
    'ABBV',
    'MRK',
    'TMO',
    'ABT',
    'ISRG',
    'DHR',
    'AMGN',
  ],
  Energy: [
    'XOM',
    'CVX',
    'COP',
    'WMB',
    'EOG',
    'SLB',
    'OKE',
    'KMI',
    'MPC',
    'PSX',
  ],
  'Consumer Discretionary': [
    'AMZN',
    'TSLA',
    'HD',
    'MCD',
    'BKNG',
    'LOW',
    'TJX',
    'SBUX',
    'ORLY',
    'NKE',
  ],
  'Consumer Staples': [
    'COST',
    'WMT',
    'PG',
    'KO',
    'PEP',
    'PM',
    'MO',
    'MDLZ',
    'CL',
    'TGT',
  ],
  Industrials: [
    'GE',
    'CAT',
    'RTX',
    'UBER',
    'BA',
    'HON',
    'UNP',
    'ETN',
    'DE',
    'ADP',
  ],
  Materials: [
    'LIN',
    'SHW',
    'ECL',
    'FCX',
    'NEM',
    'APD',
    'CTVA',
    'DOW',
    'NUE',
    'VMC',
  ],
  Utilities: [
    'NEE',
    'SO',
    'DUK',
    'CEG',
    'AEP',
    'D',
    'SRE',
    'VST',
    'EXC',
    'PEG',
  ],
  'Real Estate': [
    'PLD',
    'AMT',
    'EQIX',
    'WELL',
    'SPG',
    'PSA',
    'DLR',
    'O',
    'CCI',
    'VICI',
  ],
  'Communication Services': [
    'META',
    'GOOGL',
    'NFLX',
    'DIS',
    'TMUS',
    'T',
    'VZ',
    'CMCSA',
    'CHTR',
    'EA',
  ],
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

/**
 * One holding row: logo + symbol/name on the left, price + day move on the
 * right. The whole row links to the ticker's page on the Stocks screen.
 */
function HoldingRow({ stock }: { stock: TickerCard }) {
  const up = (stock.change_percent ?? 0) >= 0
  return (
    <Stack
      component={RouterLink}
      to={`/search?symbol=${encodeURIComponent(stock.ticker)}`}
      aria-label={`View ${stock.ticker} details`}
      direction="row"
      spacing={1.5}
      sx={{
        alignItems: 'center',
        justifyContent: 'space-between',
        py: 1,
        px: 1.5,
        borderRadius: 2,
        bgcolor: 'action.hover',
        color: 'inherit',
        textDecoration: 'none',
        transition: 'background-color 150ms',
        '&:hover': { bgcolor: 'action.selected' },
        '&:focus-visible': {
          outline: '2px solid',
          outlineColor: 'primary.main',
          outlineOffset: 2,
        },
      }}
    >
      <Stack
        direction="row"
        spacing={1.5}
        sx={{ alignItems: 'center', minWidth: 0 }}
      >
        <Avatar
          variant="rounded"
          src={stockLogoUrl(stock.ticker)}
          alt={`${stock.ticker} logo`}
          slotProps={{
            img: { loading: 'lazy', style: { objectFit: 'contain' } },
          }}
          sx={{ width: 32, height: 32, bgcolor: '#fff', color: '#111', p: 0.5 }}
        >
          {stock.ticker.charAt(0)}
        </Avatar>
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
  // On phones the dialog goes full-screen so the holdings list gets the whole
  // viewport instead of a cramped ~300px card boxed in by the default margins.
  const theme = useTheme()
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))

  // Curated constituents for the open sector; the query stays idle until the
  // dialog opens on a sector that has any. A failed ticker comes back null and
  // is filtered out — getTickerCards never rejects the whole batch.
  const tickers = sector ? (SECTOR_CONSTITUENTS[sector.sector] ?? []) : []
  const { data, isLoading, isError } = useTickerCards(tickers, {
    enabled: !!sector && tickers.length > 0,
  })
  const stocks = (data ?? []).filter((s): s is TickerCard => s != null)

  return (
    <Dialog
      open={sector != null}
      onClose={onClose}
      fullScreen={fullScreen}
      fullWidth
      maxWidth="sm"
    >
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
                <HoldingRow key={s.ticker} stock={s} />
              ))}
            </Stack>
          ))}
      </DialogContent>
    </Dialog>
  )
}
