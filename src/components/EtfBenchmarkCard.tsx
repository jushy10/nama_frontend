import { useMemo, useState } from 'react'
import {
  Alert,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  Typography,
  useTheme,
} from '@mui/material'
import { type ChartRange } from '@/lib/api'
import { useManyCandles } from '@/hooks/queries'
import ChartRangeToggle from '@/components/ChartRangeToggle'
import PerformanceComparisonChart, {
  type ComparisonSeries,
} from '@/components/PerformanceComparisonChart'

// The S&P 500 is tracked through SPY. The API is fed by Alpaca, which only
// quotes tradeable securities, so the raw index ticker (^GSPC) 400s; SPY's path
// mirrors the index's, which is all the rebased overlay needs.
const SP500 = { label: 'S&P 500', symbol: 'SPY' }

// The fund's own line — a distinct blue that reads against the neutral,
// high-contrast benchmark line (text.primary) drawn on top of it.
const FUND_COLOR = '#60a5fa' // blue-400

// Spreads under this (percentage points) read as "in line" rather than a hair
// of green or red — a fund tracking the index shouldn't flip colour on noise.
const FLAT_EPS = 0.05

interface Props {
  /** The fund's ticker (e.g. VOO, XLK). */
  symbol: string
}

/**
 * Overlays a fund against the S&P 500 (via SPY), both rebased to 0% at the start
 * of the chosen range so the gap between the two lines *is* the fund's out- or
 * under-performance regardless of share price. A headline beside the title
 * carries that gap over the selected range — green when the fund is beating the
 * index, red when it's trailing. Self-hides when the fund *is* SPY, since
 * there'd be nothing to compare.
 */
export default function EtfBenchmarkCard({ symbol }: Props) {
  const theme = useTheme()
  const [range, setRange] = useState<ChartRange>('1Y')

  // The fund rides first; the benchmark rides last so it draws on top.
  const symbols = useMemo(() => [symbol, SP500.symbol], [symbol])
  const results = useManyCandles(symbols, range)

  const loading = results.some((r) => r.isLoading)
  const allFailed = !loading && results.every((r) => !r.data)

  const series = useMemo<ComparisonSeries[]>(() => {
    const defs = [
      { symbol, label: symbol, color: FUND_COLOR, isBenchmark: false },
      {
        symbol: SP500.symbol,
        label: SP500.label,
        color: theme.palette.text.primary,
        isBenchmark: true,
      },
    ]
    const out: ComparisonSeries[] = []
    for (let i = 0; i < defs.length; i++) {
      const candles = results[i]?.data?.candles ?? []
      if (candles.length === 0) continue
      const first = candles[0].close
      if (!first) continue
      const points = candles.map((c) => ({
        t: c.time,
        pct: (c.close / first - 1) * 100,
      }))
      out.push({
        ...defs[i],
        points,
        totalPct: points[points.length - 1].pct,
      })
    }
    return out
  }, [results, symbol, theme.palette.text.primary])

  const intraday = useMemo(() => {
    const tf = results.find((r) => r.data)?.data?.timeframe ?? ''
    return /Min|Hour/.test(tf)
  }, [results])

  // The headline gap: the fund's total return over the range minus the S&P
  // 500's, in percentage points. Null until both lines have loaded.
  const fund = series.find((s) => !s.isBenchmark)
  const bench = series.find((s) => s.isBenchmark)
  const spread = fund && bench ? fund.totalPct - bench.totalPct : null

  // SPY vs SPY is a flat zero line — nothing to say, so skip the card entirely.
  if (symbol.toUpperCase() === SP500.symbol) return null

  return (
    <Card variant="outlined" sx={{ borderColor: 'divider' }}>
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          sx={{
            justifyContent: 'space-between',
            alignItems: { sm: 'center' },
            mb: 0.5,
          }}
        >
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: 'baseline', flexWrap: 'wrap' }}
          >
            <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
              Performance vs. the S&amp;P 500
            </Typography>
            {spread != null && <SpreadReadout spread={spread} />}
          </Stack>
          <ChartRangeToggle
            value={range}
            onChange={setRange}
            ariaLabel="Comparison range"
          />
        </Stack>

        <Typography color="text.secondary" sx={{ fontSize: '0.85rem', mb: 2 }}>
          {symbol} and the S&amp;P 500 (SPY) are rebased to 0% at the start of
          the range, so the gap between the lines is the fund&apos;s out- or
          under-performance over that window.
        </Typography>

        {loading && (
          <Stack
            sx={{
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 280,
            }}
          >
            <CircularProgress />
          </Stack>
        )}
        {!loading && allFailed && (
          <Alert severity="warning" variant="outlined">
            Could not load comparison data.
          </Alert>
        )}
        {!loading && !allFailed && (
          <PerformanceComparisonChart series={series} intraday={intraday} />
        )}
      </CardContent>
    </Card>
  )
}

/**
 * The fund-minus-index gap as a signed, coloured percentage beside the title:
 * green when the fund is ahead, red when behind, and a neutral "In line" when
 * the two are within a rounding hair of each other.
 */
function SpreadReadout({ spread }: { spread: number }) {
  const theme = useTheme()
  if (Math.abs(spread) < FLAT_EPS) {
    return (
      <Typography
        component="span"
        sx={{ fontWeight: 600, color: 'text.secondary' }}
      >
        In line with the S&amp;P 500
      </Typography>
    )
  }
  const ahead = spread > 0
  return (
    <Typography
      component="span"
      sx={{
        fontWeight: 600,
        color: ahead ? theme.palette.success.main : theme.palette.error.main,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {ahead ? '+' : '−'}
      {Math.abs(spread).toFixed(2)}% vs. S&amp;P 500
    </Typography>
  )
}
