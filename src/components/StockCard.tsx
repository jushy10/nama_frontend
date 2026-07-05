import {
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
} from '@mui/material'
import { stockLogoUrl, type TickerCard } from '@/lib/api'

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

/**
 * Turn the backend's snake_case classification slug into a display label —
 * `"engineering_construction"` → `"Engineering Construction"`. Words are split
 * on underscores and title-cased; anything already spaced passes through.
 */
const humanizeClass = (s: string) =>
  s
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

/** The "Sector · Industry" summary line, skipping whichever side is absent. */
const classificationLine = (
  sector: string | null,
  industry: string | null,
): string | null => {
  const parts = [sector, industry].filter(Boolean).map((s) => humanizeClass(s!))
  return parts.length ? parts.join(' · ') : null
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

export default function StockCard({ stock }: { stock: TickerCard }) {
  const up = (stock.change ?? 0) >= 0
  const changeColor = up ? 'success.main' : 'error.main'
  const sign = up ? '+' : ''
  const classification = classificationLine(stock.sector, stock.industry)

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
              src={stockLogoUrl(stock.ticker)}
              alt={`${stock.ticker} logo`}
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
              {stock.ticker.charAt(0)}
            </Avatar>
            <Box>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Typography
                  variant="h5"
                  component="h2"
                  sx={{ fontWeight: 700 }}
                >
                  {stock.ticker}
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
              {classification && (
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    mt: 0.25,
                    color: 'text.secondary',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    fontSize: '0.68rem',
                  }}
                >
                  {classification}
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
          <Stat
            label="Div Yield"
            value={fmtYield(stock.dividend?.yield_percentage ?? null)}
          />
          <Stat
            label="Div / Share"
            value={fmtDollars(stock.dividend?.per_share ?? null)}
          />
        </Box>
      </CardContent>
    </Card>
  )
}
