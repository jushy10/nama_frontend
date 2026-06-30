import { useMemo, useState } from 'react'
import {
  Alert,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useTheme,
} from '@mui/material'
import { type Candle, type ChartRange } from '@/lib/api'
import { useManyCandles } from '@/lib/queries'
import type { QuoteDef } from '@/components/QuoteGrid'
import PerformanceComparisonChart, {
  type ComparisonSeries,
} from '@/components/PerformanceComparisonChart'

// Mirror the stock page's price-chart ranges (intraday first, YTD last) so the
// two charts share one mental model. Intraday ranges make ρ a per-bar co-move;
// the rebased overlay reads the same at any horizon.
const RANGE_OPTIONS: ChartRange[] = [
  '1D',
  '5D',
  '1M',
  '3M',
  '6M',
  '1Y',
  '5Y',
  'YTD',
]

// Categorical hues for the member lines — distinct and legible on both canvases.
// The benchmark index ETFs are coloured/dashed separately (see BENCH_DASH) so
// they read as neutral references drawn on top of the members.
const LINE_COLORS = [
  '#60a5fa', // blue-400
  '#34d399', // emerald-400
  '#fbbf24', // amber-400
  '#f472b6', // pink-400
  '#a78bfa', // violet-400
  '#22d3ee', // cyan-400
  '#fb923c', // orange-400
]

// Dash patterns per benchmark, by position — the primary (SPY) gets a bold
// dash, the next (QQQ) a finer dotted line, so two neutral references stay
// distinguishable beyond just their shade.
const BENCH_DASH = ['6 3', '2 4']

/** Close-to-close returns keyed by ISO timestamp, for correlation alignment. */
function dailyReturns(candles: Candle[]): Map<string, number> {
  const m = new Map<string, number>()
  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1].close
    if (prev) m.set(candles[i].timestamp, candles[i].close / prev - 1)
  }
  return m
}

/** Pearson correlation of two equal-length samples; null when undefined. */
function pearson(a: number[], b: number[]): number | null {
  const n = a.length
  if (n < 2) return null
  let sa = 0
  let sb = 0
  for (let i = 0; i < n; i++) {
    sa += a[i]
    sb += b[i]
  }
  const ma = sa / n
  const mb = sb / n
  let num = 0
  let da = 0
  let db = 0
  for (let i = 0; i < n; i++) {
    const dx = a[i] - ma
    const dy = b[i] - mb
    num += dx * dy
    da += dx * dx
    db += dy * dy
  }
  const den = Math.sqrt(da * db)
  return den ? num / den : null
}

interface Props {
  /** The member tickers to overlay (the Mag 7). */
  items: QuoteDef[]
  /**
   * Benchmark index ETFs to overlay as references (e.g. SPY, QQQ). The first is
   * the primary: every other line's ρ is measured against it.
   */
  benchmarks: QuoteDef[]
}

/**
 * Overlays each Mag 7 member and the benchmark indices (S&P 500 via SPY,
 * Nasdaq-100 via QQQ) on one chart, every line rebased to 0% at the start of
 * the chosen range so paths are comparable across wildly different share
 * prices. Lines that track together are visibly correlated; each line also
 * carries ρ, the Pearson correlation of its daily returns to the primary
 * benchmark's, as a hard number beside the visual.
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
    // Neutral reference colours for the benchmark lines; the primary leads.
    const benchColors = [
      theme.palette.text.primary,
      theme.palette.text.secondary,
    ]
    // The primary benchmark (first one, SPY) is the correlation reference.
    const primaryIdx = items.length
    const primaryData = results[primaryIdx]?.data
    const primaryReturns = primaryData
      ? dailyReturns(primaryData.candles)
      : null

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

      // Every line but the primary itself correlates against it — including the
      // other index (QQQ), which shows how tightly the Nasdaq-100 tracks SPY.
      let corr: number | null = null
      if (i !== primaryIdx && primaryReturns) {
        const sr = dailyReturns(candles)
        const a: number[] = []
        const b: number[] = []
        for (const [ts, ret] of sr) {
          const bret = primaryReturns.get(ts)
          if (bret !== undefined) {
            a.push(ret)
            b.push(bret)
          }
        }
        corr = pearson(a, b)
      }

      out.push({
        symbol: symbols[i],
        label: isBenchmark ? benchmarks[benchPos].label : items[i].label,
        color: isBenchmark
          ? (benchColors[benchPos] ?? theme.palette.text.primary)
          : LINE_COLORS[i % LINE_COLORS.length],
        isBenchmark,
        dash: isBenchmark
          ? (BENCH_DASH[benchPos] ?? BENCH_DASH[BENCH_DASH.length - 1])
          : undefined,
        points,
        totalPct: points[points.length - 1].pct,
        corr,
      })
    }
    return out
  }, [
    results,
    symbols,
    items,
    benchmarks,
    theme.palette.text.primary,
    theme.palette.text.secondary,
  ])

  const intraday = useMemo(() => {
    const tf = results.find((r) => r.data)?.data?.timeframe ?? ''
    return /Min|Hour/.test(tf)
  }, [results])

  return (
    <Card variant="outlined" sx={{ borderColor: 'divider' }}>
      <CardContent sx={{ p: 3 }}>
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
            Performance vs. the indices
          </Typography>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={range}
            onChange={(_, value: ChartRange | null) => value && setRange(value)}
            aria-label="Comparison range"
            sx={{ flexWrap: 'wrap' }}
          >
            {RANGE_OPTIONS.map((r) => (
              <ToggleButton key={r} value={r} sx={{ px: 1.5, py: 0.25 }}>
                {r}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Stack>

        <Typography color="text.secondary" sx={{ fontSize: '0.85rem', mb: 2 }}>
          Each line is rebased to 0% at the start of the range, so paths that
          move together are correlated regardless of share price. The S&amp;P
          500 (SPY) and Nasdaq-100 (QQQ) are dashed; ρ is each line&apos;s
          daily-return correlation to SPY (1.0 = lockstep).
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
