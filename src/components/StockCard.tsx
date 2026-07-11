import { Box, Card, CardContent, Divider, Typography } from '@mui/material'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import QueryStatsIcon from '@mui/icons-material/QueryStats'
import { PERF_WINDOWS, type StockPerformance, type TickerCard } from '@/lib/api'
import SectionHeading from '@/components/SectionHeading'

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

/** Signed percent for directional figures — a trailing return reads its sign. */
const fmtPct = (n: number | null) =>
  n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`

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
          fontSize: { xs: '1.25rem', sm: '1.5rem' },
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

/** A single color-coded trailing-return pill in the performance strip. */
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
 * The Overview snapshot card — the figures that frame the live quote (size,
 * valuation, dividend) plus the trailing-return strip. The identity and price
 * now lead the page from the persistent `StockHeader`, so this card carries the
 * numbers alone: key stats up top, then performance when the snapshot ships a
 * `performance` block. `perf` is the snapshot's own block and `fiveYearReturn`
 * arrives a beat later off 5Y candles.
 */
export default function StockCard({
  stock,
  perf,
  fiveYearReturn,
}: {
  stock: TickerCard
  perf?: StockPerformance | null
  fiveYearReturn?: number | null
}) {
  const metrics = stock.metrics
  // 1W…1Y ride the snapshot's performance block; 5Y is derived upstream and
  // passed in, so it shows a dash until it lands.
  const perfEntries = perf
    ? [
        ...PERF_WINDOWS.map(({ key, label }) => ({ label, value: perf[key] })),
        { label: '5Y', value: fiveYearReturn ?? null },
      ]
    : []

  return (
    <Card variant="outlined" sx={{ borderColor: 'divider' }}>
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        <SectionHeading
          component="h2"
          icon={<QueryStatsIcon fontSize="small" />}
          title="Key statistics"
          subtitle="Size, valuation, and the dividend"
        />
        {/* Key stats: a 2×2 grid of the figures that frame the quote — size,
            valuation, and the dividend. Rows stretch (gridAutoRows 1fr) so the
            tiles stay even. P/E rides the card's `metrics` block and shows a
            dash when it's absent. */}
        <Box
          component="dl"
          sx={{
            m: 0,
            mt: 2,
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(2, minmax(0, 1fr))',
              sm: 'repeat(4, minmax(0, 1fr))',
            },
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

        {/* The trailing-return strip, folded into the snapshot so how it's
            performed reads as part of the same card. Pills are green/red by
            sign; only shown when the snapshot carries a performance block. */}
        {perf && (
          <>
            <Divider sx={{ mt: 2.5, mb: 2.5 }} />
            <SectionHeading
              component="h3"
              icon={<TrendingUpIcon fontSize="small" />}
              title="Performance"
              subtitle="Trailing total return by window"
            />
            <Box
              sx={{
                mt: 2,
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'repeat(3, minmax(0, 1fr))',
                  sm: 'repeat(7, minmax(0, 1fr))',
                },
                gap: 1,
              }}
            >
              {perfEntries.map((e) => (
                <PerfPill key={e.label} label={e.label} value={e.value} />
              ))}
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  )
}
