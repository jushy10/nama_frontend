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
import type { QuoteDef } from '@/components/QuoteGrid'
import ChartRangeToggle from '@/components/ChartRangeToggle'
import PerformanceComparisonChart, {
  type ComparisonSeries,
} from '@/components/PerformanceComparisonChart'
import RelativePerformanceBars, {
  type RelRow,
} from '@/components/RelativePerformanceBars'

// Categorical hues for the member lines — distinct and legible on both canvases.
// The benchmark index draws as a solid, thicker, high-contrast neutral line on
// top of the members (see benchColors), so it reads as the reference.
const LINE_COLORS = [
  '#60a5fa', // blue-400
  '#34d399', // emerald-400
  '#fbbf24', // amber-400
  '#f472b6', // pink-400
  '#a78bfa', // violet-400
  '#22d3ee', // cyan-400
  '#fb923c', // orange-400
]

interface Props {
  /** The member tickers to overlay (the Mag 7). */
  items: QuoteDef[]
  /**
   * Benchmark index ETF(s) to overlay as references (e.g. QQQ for the
   * Nasdaq-100). The first is the one members are measured against. Today
   * there's one; the array keeps adding another cheap.
   */
  benchmarks: QuoteDef[]
}

/**
 * Overlays each Mag 7 member and the Nasdaq-100 benchmark (via QQQ) on one
 * chart, every line rebased to 0% at the start of the chosen range so paths are
 * comparable across wildly different share prices. Below the chart, a
 * diverging-bar breakdown shows how much each member beat or lagged QQQ over
 * that same range.
 */
export default function Mag7ComparisonCard({ items, benchmarks }: Props) {
  const theme = useTheme()
  const [range, setRange] = useState<ChartRange>('1Y')

  // Benchmarks ride last, so the first benchmark sits at index `items.length`.
  const symbols = useMemo(
    () => [...items.map((i) => i.symbol), ...benchmarks.map((b) => b.symbol)],
    [items, benchmarks],
  )
  const results = useManyCandles(symbols, range)

  const loading = results.some((r) => r.isLoading)
  const allFailed = !loading && results.every((r) => !r.data)

  const series = useMemo<ComparisonSeries[]>(() => {
    // The benchmark draws in the highest-contrast neutral — black on the light
    // canvas, white on the dark one (a literal black would vanish on the near-
    // black dark background).
    const benchColor = theme.palette.text.primary

    const out: ComparisonSeries[] = []
    for (let i = 0; i < symbols.length; i++) {
      const data = results[i]?.data
      const candles = data?.candles ?? []
      if (candles.length === 0) continue

      const benchPos = i - items.length // -1 for members, 0+ for benchmarks
      const isBenchmark = benchPos >= 0
      const first = candles[0].close
      if (!first) continue
      const points = candles.map((c) => ({
        t: c.time,
        pct: (c.close / first - 1) * 100,
      }))

      out.push({
        symbol: symbols[i],
        label: isBenchmark ? benchmarks[benchPos].label : items[i].label,
        color: isBenchmark ? benchColor : LINE_COLORS[i % LINE_COLORS.length],
        isBenchmark,
        // Benchmark is a solid line; members are solid too — colour carries them.
        dash: undefined,
        points,
        totalPct: points[points.length - 1].pct,
      })
    }
    return out
  }, [results, symbols, items, benchmarks, theme.palette.text.primary])

  // How each member fared against the benchmark over the range: its return
  // minus the benchmark's, in percentage points (positive = it beat QQQ). The
  // benchmark rides along as its own row (rel 0) so it anchors the zero line,
  // with members that beat it above and members that lagged it below.
  const benchmarkSeries = series.find((s) => s.isBenchmark)
  const relRows: RelRow[] =
    benchmarkSeries == null
      ? []
      : [
          ...series
            .filter((s) => !s.isBenchmark)
            .map((s) => ({
              symbol: s.symbol,
              label: s.label,
              color: s.color,
              totalPct: s.totalPct,
              rel: s.totalPct - benchmarkSeries.totalPct,
            })),
          {
            symbol: benchmarkSeries.symbol,
            label: benchmarkSeries.label,
            color: benchmarkSeries.color,
            totalPct: benchmarkSeries.totalPct,
            rel: 0,
            isBenchmark: true,
          },
        ]

  const intraday = useMemo(() => {
    const tf = results.find((r) => r.data)?.data?.timeframe ?? ''
    return /Min|Hour/.test(tf)
  }, [results])

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
          <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
            Performance vs. the Nasdaq 100
          </Typography>
          <ChartRangeToggle
            value={range}
            onChange={setRange}
            ariaLabel="Comparison range"
          />
        </Stack>

        <Typography color="text.secondary" sx={{ fontSize: '0.85rem', mb: 2 }}>
          Each line is rebased to 0% at the start of the range, so paths that
          move together track regardless of share price. The Nasdaq-100 (QQQ) is
          the solid benchmark line; the bars below show how much each stock has
          gained or lost against QQQ over the selected range.
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
          <>
            <PerformanceComparisonChart series={series} intraday={intraday} />
            {relRows.length > 0 && benchmarkSeries && (
              <RelativePerformanceBars
                rows={relRows}
                benchmarkSymbol={benchmarkSeries.symbol}
                rangeLabel={range}
              />
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
