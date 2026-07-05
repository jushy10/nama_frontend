import {
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Typography,
} from '@mui/material'
import {
  humanizeClassification,
  stockLogoUrl,
  type TickerCard,
} from '@/lib/api'

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

/** A bare valuation multiple, e.g. a P/E of 46.5 → "46.50". */
const fmtMultiple = (n: number | null) => (n == null ? '—' : n.toFixed(2))

/** The "Sector · Industry" summary line, skipping whichever side is absent. */
const classificationLine = (
  sector: string | null,
  industry: string | null,
): string | null => {
  const parts = [sector, industry]
    .filter(Boolean)
    .map((s) => humanizeClassification(s!))
  return parts.length ? parts.join(' · ') : null
}

/**
 * One labelled figure in the key-stats grid. Tiles stretch to fill the card's
 * height (see the grid's `gridAutoRows`), so the content is vertically centred
 * to sit evenly however tall the row grows.
 */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Box
      sx={{
        borderRadius: 2,
        bgcolor: 'action.hover',
        px: 2,
        py: 1.5,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: 0.75,
      }}
    >
      <Typography
        component="dt"
        variant="caption"
        sx={{
          color: 'text.secondary',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          fontSize: '0.72rem',
          lineHeight: 1.2,
        }}
      >
        {label}
      </Typography>
      <Typography
        component="dd"
        sx={{
          m: 0,
          fontWeight: 700,
          fontSize: '1.5rem',
          lineHeight: 1.15,
          letterSpacing: '-0.01em',
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
  const metrics = stock.metrics

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
        }}
      >
        <Stack
          direction="row"
          spacing={2.5}
          sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}
        >
          <Stack
            direction="row"
            spacing={2}
            sx={{ alignItems: 'flex-start', minWidth: 0 }}
          >
            <Avatar
              variant="rounded"
              src={stockLogoUrl(stock.ticker)}
              alt={`${stock.ticker} logo`}
              slotProps={{
                img: { loading: 'lazy', style: { objectFit: 'contain' } },
              }}
              sx={{
                width: 76,
                height: 76,
                flexShrink: 0,
                bgcolor: '#fff',
                color: '#111',
                fontWeight: 700,
                fontSize: '1.75rem',
                p: 1.25,
                borderRadius: '18px',
                border: '1px solid',
                borderColor: 'divider',
                boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
              }}
            >
              {stock.ticker.charAt(0)}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Stack
                direction="row"
                spacing={1}
                sx={{ alignItems: 'center', flexWrap: 'wrap' }}
              >
                <Typography
                  component="h2"
                  sx={{ fontWeight: 700, lineHeight: 1.05, fontSize: '2rem' }}
                >
                  {stock.ticker}
                </Typography>
                {stock.exchange && (
                  <Chip
                    label={stock.exchange}
                    size="small"
                    variant="outlined"
                    sx={{
                      height: 22,
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      color: 'text.secondary',
                      borderColor: 'divider',
                    }}
                  />
                )}
              </Stack>
              {stock.name && (
                <Typography
                  sx={{
                    mt: 0.5,
                    color: 'text.primary',
                    fontSize: '1.15rem',
                    fontWeight: 500,
                    lineHeight: 1.3,
                    display: '-webkit-box',
                    WebkitBoxOrient: 'vertical',
                    WebkitLineClamp: 2,
                    overflow: 'hidden',
                  }}
                >
                  {stock.name}
                </Typography>
              )}
              {classification && (
                <Typography
                  sx={{
                    display: 'block',
                    mt: 0.75,
                    color: 'text.secondary',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    fontSize: '0.8rem',
                    fontWeight: 500,
                  }}
                >
                  {classification}
                </Typography>
              )}
            </Box>
          </Stack>
          <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
            <Typography
              sx={{
                fontWeight: 700,
                fontSize: '2.25rem',
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1.05,
                letterSpacing: '-0.01em',
              }}
            >
              ${fmt(stock.price)}
            </Typography>
            {/* the day's move as a tinted pill, so direction reads at a glance */}
            <Box
              sx={{
                mt: 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                px: 1.5,
                py: 0.6,
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
                sx={{ fontSize: '0.65rem', lineHeight: 1 }}
              >
                {up ? '▲' : '▼'}
              </Box>
              <Typography
                component="span"
                sx={{
                  fontWeight: 600,
                  fontSize: '0.95rem',
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

        <Divider sx={{ mt: 2.5, mb: 2.5 }} />

        {/* Key stats fill the height the snapshot borrows from the taller
            Performance + RSI stack beside it: a 2×2 grid whose rows stretch
            (gridAutoRows 1fr) so the tiles grow to occupy the card rather than
            leaving a gap. P/E rides the card's `metrics` block and shows a dash
            when it's absent. */}
        <Box
          component="dl"
          sx={{
            m: 0,
            flexGrow: 1,
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gridAutoRows: '1fr',
            gap: 1,
          }}
        >
          <Stat label="Mkt Cap" value={fmtMoney(stock.market_cap)} />
          <Stat label="P/E (TTM)" value={fmtMultiple(metrics?.pe ?? null)} />
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
