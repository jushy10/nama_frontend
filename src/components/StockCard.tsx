import {
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
} from '@mui/material'
import { stockLogoUrl, type Stock, type StockPerformance } from '@/lib/api'

const fmt = (n: number | null) =>
  n == null
    ? '—'
    : n.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })

const fmtInt = (n: number | null) =>
  n == null ? '—' : n.toLocaleString('en-US')

/** Compact dollar magnitude, e.g. 3.21T / 845.0B / 12.4M. */
const fmtMoney = (n: number | null) =>
  n == null
    ? '—'
    : '$' +
      n.toLocaleString('en-US', {
        notation: 'compact',
        maximumFractionDigits: 2,
      })

/** Signed percent for directional figures (returns/changes). */
const fmtPct = (n: number | null) =>
  n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`

/** Unsigned percent — a dividend yield has no direction. */
const fmtYield = (n: number | null) => (n == null ? '—' : `${n.toFixed(2)}%`)

/** Per-share dollar amount. */
const fmtDollars = (n: number | null) => (n == null ? '—' : `$${fmt(n)}`)

const PERF_WINDOWS: { key: keyof StockPerformance; label: string }[] = [
  { key: '1w', label: '1W' },
  { key: '1m', label: '1M' },
  { key: '3m', label: '3M' },
  { key: '6m', label: '6M' },
  { key: 'ytd', label: 'YTD' },
  { key: '1y', label: '1Y' },
]

/** A single color-coded return pill. */
function PerfPill({ label, value }: { label: string; value: number | null }) {
  const color =
    value == null
      ? 'text.secondary'
      : value >= 0
        ? 'success.main'
        : 'error.main'
  return (
    <Box
      sx={{
        borderRadius: 2,
        bgcolor: 'action.hover',
        px: 1,
        py: 0.75,
        textAlign: 'center',
      }}
    >
      <Typography
        variant="caption"
        sx={{ color: 'text.secondary', display: 'block' }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          fontWeight: 600,
          color,
          fontVariantNumeric: 'tabular-nums',
          fontSize: '0.85rem',
        }}
      >
        {fmtPct(value)}
      </Typography>
    </Box>
  )
}

/**
 * Row of trailing-return pills, color-coded green/red by sign. The 5Y return
 * isn't in the snapshot's `performance` object — it's derived from 5Y candles
 * upstream and passed in, so it loads a beat later and shows `—` until ready.
 */
function PerformanceStrip({
  perf,
  fiveYearReturn,
}: {
  perf: StockPerformance
  fiveYearReturn?: number | null
}) {
  const entries: { label: string; value: number | null }[] = [
    ...PERF_WINDOWS.map(({ key, label }) => ({ label, value: perf[key] })),
    { label: '5Y', value: fiveYearReturn ?? null },
  ]
  return (
    <Box>
      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        Performance
      </Typography>
      <Box
        sx={{
          mt: 0.75,
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(4, 1fr)', sm: 'repeat(7, 1fr)' },
          gap: 1,
        }}
      >
        {entries.map((e) => (
          <PerfPill key={e.label} label={e.label} value={e.value} />
        ))}
      </Box>
    </Box>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Box
      sx={{
        borderRadius: 2,
        bgcolor: 'action.hover',
        px: 1.5,
        py: 1,
      }}
    >
      <Typography
        component="dt"
        variant="caption"
        sx={{
          color: 'text.secondary',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {label}
      </Typography>
      <Typography
        component="dd"
        sx={{
          m: 0,
          mt: 0.25,
          fontWeight: 500,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </Typography>
    </Box>
  )
}

export default function StockCard({
  stock,
  fiveYearReturn,
}: {
  stock: Stock
  fiveYearReturn?: number | null
}) {
  const up = (stock.change ?? 0) >= 0
  const changeColor = up ? 'success.main' : 'error.main'
  const sign = up ? '+' : ''
  const asOf = stock.as_of ? new Date(stock.as_of).toLocaleString() : '—'

  return (
    <Card variant="outlined" sx={{ borderColor: 'divider' }}>
      <CardContent sx={{ p: 3 }}>
        <Stack
          direction="row"
          spacing={2}
          sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}
        >
          <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
            <Avatar
              variant="rounded"
              src={stockLogoUrl(stock.symbol)}
              alt={`${stock.symbol} logo`}
              slotProps={{
                img: { loading: 'lazy', style: { objectFit: 'contain' } },
              }}
              sx={{
                width: 56,
                height: 56,
                bgcolor: '#fff',
                color: '#111',
                p: 0.75,
              }}
            >
              {stock.symbol.charAt(0)}
            </Avatar>
            <Box>
              <Typography variant="h5" component="h2" sx={{ fontWeight: 700 }}>
                {stock.symbol}
              </Typography>
              {stock.name && (
                <Typography variant="body2" color="text.secondary">
                  {stock.name}
                </Typography>
              )}
              {stock.exchange && (
                <Chip
                  label={stock.exchange}
                  size="small"
                  sx={{ mt: 0.5, height: 20, fontSize: '0.7rem' }}
                />
              )}
            </Box>
          </Stack>
          <Box sx={{ textAlign: 'right' }}>
            <Typography
              variant="h4"
              sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
            >
              ${fmt(stock.price)}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 500,
                color: changeColor,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {sign}
              {fmt(stock.change)} ({sign}
              {fmt(stock.change_percent)}%)
            </Typography>
          </Box>
        </Stack>

        <Box
          component="dl"
          sx={{
            mt: 3,
            mb: 0,
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
            gap: 1,
          }}
        >
          <Stat label="Volume" value={fmtInt(stock.volume)} />
          <Stat label="Mkt Cap" value={fmtMoney(stock.market_cap)} />
          <Stat label="Div Yield" value={fmtYield(stock.dividend_yield)} />
          <Stat
            label="Div / Share"
            value={fmtDollars(stock.dividend_per_share)}
          />
        </Box>

        {stock.performance && (
          <Box sx={{ mt: 2.5 }}>
            <PerformanceStrip
              perf={stock.performance}
              fiveYearReturn={fiveYearReturn}
            />
          </Box>
        )}

        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', mt: 2, textAlign: 'right' }}
        >
          As of {asOf}
        </Typography>
      </CardContent>
    </Card>
  )
}
