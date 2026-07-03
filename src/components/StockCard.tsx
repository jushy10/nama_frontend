import {
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
} from '@mui/material'
import { stockLogoUrl, type Stock } from '@/lib/api'

const fmt = (n: number | null) =>
  n == null
    ? '—'
    : n.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })

/** Compact dollar magnitude, e.g. 3.21T / 845.0B / 12.4M. */
const fmtMoney = (n: number | null) =>
  n == null
    ? '—'
    : '$' +
      n.toLocaleString('en-US', {
        notation: 'compact',
        maximumFractionDigits: 2,
      })

/** Unsigned percent — a dividend yield has no direction. */
const fmtYield = (n: number | null) => (n == null ? '—' : `${n.toFixed(2)}%`)

/** Per-share dollar amount. */
const fmtDollars = (n: number | null) => (n == null ? '—' : `$${fmt(n)}`)

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

/** Where the price sits in its 52-week range, as a 0–100 track position
 *  (clamped — a fresh high/low can sit just outside yesterday's range). */
const rangePos = (price: number, low: number, high: number) =>
  Math.max(0, Math.min(100, ((price - low) / (high - low)) * 100))

/** The year's trading range as a slim track with the current price marked on
 *  it — neutral indigo rather than green/red, since neither end of the range
 *  is inherently good. The right-hand caption adds how far the price sits
 *  below its all-time high (a longer lens than the 52-week window). */
function Week52Range({
  price,
  low,
  high,
  drawdown,
}: {
  price: number
  low: number
  high: number
  drawdown: number | null
}) {
  const pct = rangePos(price, low, high)
  return (
    <Box sx={{ mt: 3 }}>
      <Stack
        direction="row"
        spacing={1}
        sx={{ justifyContent: 'space-between', alignItems: 'baseline' }}
      >
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          52-week range
        </Typography>
        {drawdown != null && (
          <Typography variant="caption" color="text.secondary">
            {drawdown <= -0.05
              ? `${Math.abs(drawdown).toFixed(1)}% below all-time high`
              : 'At its all-time high'}
          </Typography>
        )}
      </Stack>
      <Box
        role="img"
        aria-label={`52-week range ${fmtDollars(low)} to ${fmtDollars(high)}; currently ${fmtDollars(price)}`}
        sx={{
          position: 'relative',
          mt: 1,
          height: 6,
          borderRadius: 3,
          bgcolor: 'action.hover',
        }}
      >
        {/* filled up to today's price */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            width: `${pct}%`,
            borderRadius: 3,
            bgcolor: 'primary.dark',
            opacity: 0.55,
          }}
        />
        {/* current-price marker */}
        <Box
          sx={{
            position: 'absolute',
            top: -3,
            left: `${pct}%`,
            transform: 'translateX(-50%)',
            width: 3,
            height: 12,
            borderRadius: 1,
            bgcolor: 'primary.light',
            boxShadow: (theme) => `0 0 0 2px ${theme.palette.background.paper}`,
          }}
        />
      </Box>
      <Stack direction="row" sx={{ justifyContent: 'space-between', mt: 0.5 }}>
        <Typography
          variant="caption"
          sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}
        >
          {fmtDollars(low)}
        </Typography>
        <Typography
          variant="caption"
          sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}
        >
          {fmtDollars(high)}
        </Typography>
      </Stack>
    </Box>
  )
}

export default function StockCard({ stock }: { stock: Stock }) {
  const up = (stock.change ?? 0) >= 0
  const changeColor = up ? 'success.main' : 'error.main'
  const sign = up ? '+' : ''
  const asOf = stock.as_of ? new Date(stock.as_of).toLocaleString() : '—'
  const low = stock.metrics?.week_52_low ?? null
  const high = stock.metrics?.week_52_high ?? null

  return (
    <Card
      variant="outlined"
      sx={{
        borderColor: 'divider',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <CardContent
        sx={{
          p: 3,
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
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
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Typography
                  variant="h5"
                  component="h2"
                  sx={{ fontWeight: 700 }}
                >
                  {stock.symbol}
                </Typography>
                {stock.exchange && (
                  <Chip
                    label={stock.exchange}
                    size="small"
                    sx={{ height: 20, fontSize: '0.7rem' }}
                  />
                )}
              </Stack>
              {stock.name && (
                <Typography variant="body2" color="text.secondary">
                  {stock.name}
                </Typography>
              )}
            </Box>
          </Stack>
          <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1.1,
              }}
            >
              ${fmt(stock.price)}
            </Typography>
            {/* the day's move as a tinted pill, so direction reads at a glance */}
            <Box
              sx={{
                mt: 0.75,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                px: 1.25,
                py: 0.5,
                borderRadius: 999,
                color: changeColor,
                bgcolor: up
                  ? 'rgba(52,211,153,0.14)'
                  : 'rgba(248,113,113,0.14)',
              }}
            >
              <Box
                component="span"
                aria-hidden
                sx={{ fontSize: '0.6rem', lineHeight: 1 }}
              >
                {up ? '▲' : '▼'}
              </Box>
              <Typography
                component="span"
                variant="body2"
                sx={{
                  fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1,
                }}
              >
                {sign}
                {fmt(stock.change)} ({sign}
                {fmt(stock.change_percent)}%)
              </Typography>
            </Box>
          </Box>
        </Stack>

        <Box>
          {low != null && high != null && high > low && (
            <Week52Range
              price={stock.price}
              low={low}
              high={high}
              drawdown={stock.drawdown_from_high}
            />
          )}

          <Box
            component="dl"
            sx={{
              mt: 3,
              mb: 0,
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(2, 1fr)',
                sm: 'repeat(3, 1fr)',
              },
              gap: 1,
            }}
          >
            <Stat label="Mkt Cap" value={fmtMoney(stock.market_cap)} />
            <Stat label="Div Yield" value={fmtYield(stock.dividend_yield)} />
            <Stat
              label="Div / Share"
              value={fmtDollars(stock.dividend_per_share)}
            />
          </Box>
        </Box>

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
