import { useMemo } from 'react'
import {
  Box,
  Card,
  CardContent,
  Stack,
  Typography,
  useTheme,
} from '@mui/material'
import type { Theme } from '@mui/material/styles'
import type {
  EarningsHistory,
  EarningsMetrics,
  EarningsSurprise,
} from '@/lib/api'

// Like CandleChart, the plot draws into a fixed viewBox and scales to its
// container via `width: 100%`, so all geometry is in these abstract units — no
// DOM measurement needed (which also keeps it happy in jsdom).
const W = 820
const H = 300
const PAD = { top: 30, right: 48, bottom: 46, left: 12 }

const fmtEps = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(n).toFixed(2)}`
const fmtPct = (n: number) => `${n >= 0 ? '+' : '-'}${Math.abs(n).toFixed(1)}%`
const fmtPlainPct = (n: number) => `${n.toFixed(1)}%`

/** Muted fill for the "estimate" bar — faint enough to sit behind the actual,
 *  and legible on both the dark and light canvas. Shared with the legend. */
const estimateColor = (theme: Theme) =>
  theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.18)'

/** "Q2 '24" from the fiscal period, falling back to the report month. */
function quarterLabel(q: EarningsSurprise): string {
  if (q.fiscal_quarter && q.fiscal_year) {
    return `Q${q.fiscal_quarter} '${String(q.fiscal_year).slice(-2)}`
  }
  if (q.period) {
    return new Date(q.period).toLocaleDateString('en-US', {
      month: 'short',
      year: '2-digit',
    })
  }
  return '—'
}

/**
 * Grouped EPS columns — a muted "estimate" bar beside the reported "actual"
 * (green when it met/beat, red when it missed) for each quarter, oldest to
 * newest. Surprise % rides above each pair; the actual EPS sits under the
 * quarter label. A zero baseline keeps loss quarters (negative EPS) readable.
 */
function EarningsChart({ quarters }: { quarters: EarningsSurprise[] }) {
  const theme = useTheme()
  const up = theme.palette.success.main
  const down = theme.palette.error.main
  const grid = theme.palette.divider
  const axis = theme.palette.text.secondary
  const est = estimateColor(theme)

  // API is newest-first; a time axis reads oldest → newest, left → right.
  const data = useMemo(() => [...quarters].reverse(), [quarters])

  const geo = useMemo(() => {
    const plotW = W - PAD.left - PAD.right
    const plotH = H - PAD.top - PAD.bottom

    // Always anchor the scale at zero so bar heights are comparable and the
    // baseline is meaningful; stretch to cover whatever actual/estimate reach.
    let max = 0
    let min = 0
    for (const q of data) {
      for (const v of [q.actual, q.estimate]) {
        if (v == null) continue
        if (v > max) max = v
        if (v < min) min = v
      }
    }
    if (max === min) max = 1 // all-zero / empty guard
    const padV = (max - min) * 0.15 || 1
    max += padV
    if (min < 0) min -= padV // only drop the floor when there are losses

    const n = data.length
    const slot = plotW / Math.max(n, 1)
    const groupW = Math.min(slot * 0.62, 72)
    const gap = Math.min(groupW * 0.12, 4)
    const barW = (groupW - gap) / 2

    const cx = (i: number) => PAD.left + slot * (i + 0.5)
    const y = (v: number) =>
      PAD.top + (1 - (v - min) / (max - min || 1)) * plotH

    const tickN = 4
    const ticks = Array.from(
      { length: tickN + 1 },
      (_, i) => min + ((max - min) * i) / tickN,
    )

    return { cx, y, groupW, gap, barW, ticks, zeroY: y(0) }
  }, [data])

  if (data.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
        No earnings history available.
      </Typography>
    )
  }

  const { cx, y, groupW, gap, barW, ticks, zeroY } = geo

  return (
    <Box
      component="svg"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Quarterly actual versus estimated earnings per share"
      sx={{ width: '100%', height: 'auto', display: 'block' }}
    >
      {/* gridlines + EPS axis labels (right) */}
      {ticks.map((t, i) => (
        <g key={`t${i}`}>
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={y(t)}
            y2={y(t)}
            stroke={grid}
            strokeWidth={1}
          />
          <text x={W - PAD.right + 6} y={y(t) + 3.5} fontSize={11} fill={axis}>
            {fmtEps(t)}
          </text>
        </g>
      ))}
      {/* zero baseline, drawn a touch stronger than the gridlines */}
      <line
        x1={PAD.left}
        x2={W - PAD.right}
        y1={zeroY}
        y2={zeroY}
        stroke={axis}
        strokeWidth={1}
        opacity={0.5}
      />

      {data.map((q, i) => {
        const center = cx(i)
        const estX = center - groupW / 2
        const actX = estX + barW + gap
        const actColor = q.beat == null ? axis : q.beat ? up : down

        const bar = (x: number, v: number | null, fill: string) => {
          if (v == null) return null
          const top = Math.min(y(v), zeroY)
          const h = Math.max(1, Math.abs(y(v) - zeroY))
          return <rect x={x} y={top} width={barW} height={h} fill={fill} />
        }

        // Surprise % rides in the top margin, aligned across all groups.
        const surprise =
          q.surprise_percent == null ? null : (
            <text
              x={center}
              y={18}
              fontSize={11}
              fontWeight={600}
              fill={actColor}
              textAnchor="middle"
            >
              {fmtPct(q.surprise_percent)}
            </text>
          )

        return (
          <g key={q.period ?? i}>
            {surprise}
            {bar(estX, q.estimate, est)}
            {bar(actX, q.actual, actColor)}
            {/* quarter label + the reported EPS beneath it */}
            <text
              x={center}
              y={H - 26}
              fontSize={11}
              fill={axis}
              textAnchor="middle"
            >
              {quarterLabel(q)}
            </text>
            {q.actual != null && (
              <text
                x={center}
                y={H - 12}
                fontSize={11}
                fontWeight={600}
                fill={actColor}
                textAnchor="middle"
              >
                {fmtEps(q.actual)}
              </text>
            )}
          </g>
        )
      })}
    </Box>
  )
}

/** A legend swatch with its label, used beneath the chart. `color` is either a
 *  theme palette path (e.g. "success.main") or a theme-aware resolver. */
function LegendItem({
  color,
  label,
}: {
  color: string | ((theme: Theme) => string)
  label: string
}) {
  return (
    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
      <Box sx={{ width: 12, height: 12, borderRadius: 0.5, bgcolor: color }} />
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Stack>
  )
}

// The trailing earnings/profitability metrics, in display order. `kind` drives
// formatting: `money` → "$8.27", `growth` → signed + coloured ("+29.0%"),
// `pct` → plain percent ("27.2%").
const METRIC_TILES: {
  key: keyof EarningsMetrics
  label: string
  kind: 'money' | 'growth' | 'pct'
}[] = [
  { key: 'eps', label: 'EPS (TTM)', kind: 'money' },
  { key: 'eps_growth_yoy', label: 'EPS Gr. (YoY)', kind: 'growth' },
  { key: 'revenue_growth_yoy', label: 'Rev. Gr. (YoY)', kind: 'growth' },
  { key: 'gross_margin', label: 'Gross Margin', kind: 'pct' },
  { key: 'operating_margin', label: 'Op. Margin', kind: 'pct' },
  { key: 'net_margin', label: 'Net Margin', kind: 'pct' },
  { key: 'roe', label: 'ROE', kind: 'pct' },
  { key: 'roic', label: 'ROIC', kind: 'pct' },
  { key: 'payout_ratio', label: 'Payout', kind: 'pct' },
]

/** A grid of trailing earnings metrics (EPS, growth, margins, returns, payout)
 *  served alongside the beat history. Growth tiles are signed and coloured; a
 *  value the vendor doesn't cover shows an em dash. */
function MetricTiles({ metrics }: { metrics: EarningsMetrics }) {
  return (
    <Box
      sx={{ mt: 2.5, pt: 2.5, borderTop: '1px solid', borderColor: 'divider' }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}
      >
        Trailing metrics
      </Typography>
      <Box
        sx={{
          mt: 1.5,
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' },
          rowGap: 2,
          columnGap: 2,
        }}
      >
        {METRIC_TILES.map(({ key, label, kind }) => {
          const v = metrics[key]
          let text = '—'
          let color = 'text.primary'
          if (v != null) {
            if (kind === 'money') text = fmtEps(v)
            else if (kind === 'growth') {
              text = fmtPct(v)
              color = v >= 0 ? 'success.main' : 'error.main'
            } else text = fmtPlainPct(v)
          }
          return (
            <Box key={key}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  display: 'block',
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                  fontSize: '0.68rem',
                }}
              >
                {label}
              </Typography>
              <Typography
                sx={{
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                  color,
                  lineHeight: 1.3,
                }}
              >
                {text}
              </Typography>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}

export default function EarningsCard({
  earnings,
}: {
  earnings: EarningsHistory
}) {
  const { beat_rate, beats, scored, quarters } = earnings
  // Beats more often than not reads green; a coin-flip-or-worse record reads
  // red. No scored quarters → nothing to colour.
  const rateColor =
    beat_rate == null
      ? 'text.primary'
      : beat_rate >= 50
        ? 'success.main'
        : 'error.main'

  return (
    <Card variant="outlined" sx={{ borderColor: 'divider' }}>
      <CardContent sx={{ p: 3 }}>
        <Stack
          direction="row"
          spacing={2}
          sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}
        >
          <Box>
            <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
              Earnings
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Quarterly EPS — actual vs. estimate
            </Typography>
          </Box>

          {beat_rate != null && (
            <Box sx={{ textAlign: 'right' }}>
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  display: 'block',
                }}
              >
                Beat rate
              </Typography>
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 700,
                  color: rateColor,
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1.2,
                }}
              >
                {Math.round(beat_rate)}%
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {beats} of {scored} quarters
              </Typography>
            </Box>
          )}
        </Stack>

        {quarters.length === 0 ? (
          <Typography color="text.secondary" sx={{ mt: 2 }}>
            No earnings history available for this stock.
          </Typography>
        ) : (
          <>
            <Box sx={{ mt: 2.5 }}>
              <EarningsChart quarters={quarters} />
            </Box>
            <Stack
              direction="row"
              spacing={2}
              useFlexGap
              sx={{ flexWrap: 'wrap', mt: 1.5 }}
            >
              <LegendItem color={estimateColor} label="Estimate" />
              <LegendItem color="success.main" label="Beat" />
              <LegendItem color="error.main" label="Missed" />
            </Stack>
          </>
        )}

        {earnings.metrics && <MetricTiles metrics={earnings.metrics} />}
      </CardContent>
    </Card>
  )
}
