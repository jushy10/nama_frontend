import { useEffect, useState } from 'react'
import { Box, Container, Skeleton, Stack, Typography } from '@mui/material'
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import { getStocks, type Stock } from '@/lib/api'

type IndexDef = {
  /** Friendly index/market name shown to the user. */
  label: string
  /** Liquid ETF the API can quote as a proxy for the index. */
  symbol: string
}

// The API is fed by Alpaca, which only quotes tradeable securities — the raw
// index tickers (^GSPC, ^NDX, ^DJI) 400 out. So each index is tracked through
// the most liquid ETF that mirrors it; the day's move on the ETF tracks the
// index's. Global rows use the country/region MSCI ETF, labeled honestly.
const INDICES: IndexDef[] = [
  { label: 'S&P 500', symbol: 'SPY' },
  { label: 'Nasdaq 100', symbol: 'QQQ' },
  { label: 'Dow Jones', symbol: 'DIA' },
  { label: 'Russell 2000', symbol: 'IWM' },
  { label: 'Japan', symbol: 'EWJ' },
  { label: 'Germany', symbol: 'EWG' },
  { label: 'UK', symbol: 'EWU' },
  { label: 'Emerging Mkts', symbol: 'EEM' },
]

// Re-poll on the same cadence the marketing copy promises ("60s data refresh").
const REFRESH_MS = 60_000

const fmtPrice = (n: number) =>
  n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

const fmtPct = (n: number | null) =>
  n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`

const fmtChange = (n: number | null) =>
  n == null ? '' : `${n >= 0 ? '+' : ''}${n.toFixed(2)}`

function IndexTile({ def, stock }: { def: IndexDef; stock: Stock | null }) {
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
 * Home-page band of major index proxies with their move for the day. Loads on
 * mount and quietly re-polls every minute; a failed symbol shows a dash rather
 * than blanking the row.
 */
export default function MarketIndices() {
  // null while the first fetch is in flight; after that, one entry per index.
  const [quotes, setQuotes] = useState<(Stock | null)[] | null>(null)

  useEffect(() => {
    let active = true
    const ac = new AbortController()
    const symbols = INDICES.map((i) => i.symbol)

    const load = () =>
      getStocks(symbols, { signal: ac.signal })
        .then((result) => {
          if (active) setQuotes(result)
        })
        .catch(() => {
          /* aborted or offline — keep whatever is on screen */
        })

    load()
    const id = setInterval(load, REFRESH_MS)
    return () => {
      active = false
      ac.abort()
      clearInterval(id)
    }
  }, [])

  const allFailed = quotes != null && quotes.every((q) => q == null)

  return (
    <Box sx={{ borderTop: 1, borderColor: 'divider' }}>
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" component="h2" sx={{ fontWeight: 600 }}>
            Markets today
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Major indices and their move for the day, tracked via liquid ETF
            proxies.
          </Typography>
        </Box>

        {allFailed ? (
          <Typography variant="body2" color="text.secondary">
            Live market data is unavailable right now. Please check back
            shortly.
          </Typography>
        ) : (
          <Box sx={GRID_SX}>
            {quotes == null
              ? INDICES.map((def) => <SkeletonTile key={def.symbol} />)
              : INDICES.map((def, i) => (
                  <IndexTile key={def.symbol} def={def} stock={quotes[i]} />
                ))}
          </Box>
        )}
      </Container>
    </Box>
  )
}
