import { Box, Skeleton, Stack, Typography } from '@mui/material'
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import { type Stock } from '@/lib/api'
import { useStocks } from '@/lib/queries'

export type QuoteDef = {
  /** Friendly name shown to the user (index name or company). */
  label: string
  /** Tradeable ticker the API can quote (ETF proxy or the stock itself). */
  symbol: string
}

const fmtPrice = (n: number) =>
  n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

const fmtPct = (n: number | null) =>
  n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`

const fmtChange = (n: number | null) =>
  n == null ? '' : `${n >= 0 ? '+' : ''}${n.toFixed(2)}`

function QuoteTile({ def, stock }: { def: QuoteDef; stock: Stock | null }) {
  const pct = stock?.change_percent ?? null
  const up = (pct ?? 0) >= 0
  const color =
    pct == null ? 'text.secondary' : up ? 'success.main' : 'error.main'

  return (
    <Box
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        bgcolor: 'action.hover',
        p: 2,
        transition: 'border-color 150ms',
        '&:hover': { borderColor: 'rgba(99,102,241,0.4)' },
      }}
    >
      <Stack
        direction="row"
        sx={{ justifyContent: 'space-between', alignItems: 'baseline' }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          {def.label}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {def.symbol}
        </Typography>
      </Stack>

      <Typography
        sx={{
          mt: 0.75,
          fontWeight: 700,
          fontSize: '1.15rem',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {stock ? `$${fmtPrice(stock.price)}` : '—'}
      </Typography>

      <Stack
        direction="row"
        sx={{ alignItems: 'center', color, mt: 0.25, minHeight: 24 }}
      >
        {pct != null &&
          (up ? (
            <ArrowDropUpIcon fontSize="small" sx={{ mx: -0.5 }} />
          ) : (
            <ArrowDropDownIcon fontSize="small" sx={{ mx: -0.5 }} />
          ))}
        <Typography
          variant="body2"
          sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
        >
          {fmtPct(pct)}
        </Typography>
        {stock?.change != null && (
          <Typography
            variant="caption"
            sx={{
              ml: 0.75,
              color: 'text.secondary',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {fmtChange(stock.change)}
          </Typography>
        )}
      </Stack>
    </Box>
  )
}

function SkeletonTile() {
  return (
    <Box
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        bgcolor: 'action.hover',
        p: 2,
      }}
    >
      <Skeleton width="60%" />
      <Skeleton width="50%" sx={{ mt: 0.75, fontSize: '1.15rem' }} />
      <Skeleton width="40%" />
    </Box>
  )
}

const GRID_SX = {
  display: 'grid',
  gridTemplateColumns: {
    xs: 'repeat(2, 1fr)',
    sm: 'repeat(3, 1fr)',
    md: 'repeat(4, 1fr)',
  },
  gap: 2,
} as const

/**
 * A self-refreshing grid of price tiles, one per `item`, each showing the day's
 * move. Loads on mount and re-polls every `refreshMs`; a symbol that fails comes
 * back as a dash rather than blanking the row, and a wholesale failure shows a
 * single unavailable note instead of a wall of dashes.
 */
export default function QuoteGrid({
  items,
  refreshMs = 60_000,
}: {
  items: QuoteDef[]
  refreshMs?: number
}) {
  const symbols = items.map((i) => i.symbol)
  const { data } = useStocks(symbols, { refetchInterval: refreshMs })
  const quotes = data ?? null

  const allFailed = quotes != null && quotes.every((q) => q == null)

  if (allFailed) {
    return (
      <Typography variant="body2" color="text.secondary">
        Live market data is unavailable right now. Please check back shortly.
      </Typography>
    )
  }

  return (
    <Box sx={GRID_SX}>
      {quotes == null
        ? items.map((def) => <SkeletonTile key={def.symbol} />)
        : items.map((def, i) => (
            <QuoteTile key={def.symbol} def={def} stock={quotes[i]} />
          ))}
    </Box>
  )
}
