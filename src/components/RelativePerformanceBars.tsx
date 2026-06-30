import { Box, Stack, Typography, useTheme } from '@mui/material'

/** One member's return over the range and its spread versus the benchmark. */
export interface RelRow {
  symbol: string
  label: string
  color: string
  /** The member's own total return over the range (percent). */
  totalPct: number
  /** Member return minus benchmark return, in percentage points. */
  rel: number
}

const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`

interface Props {
  rows: RelRow[]
  /** The benchmark ticker (e.g. QQQ) every row is measured against. */
  benchmarkSymbol: string
  /** The benchmark's own return over the range, for the header. */
  benchmarkReturn: number
  /** The selected range, shown in the header (e.g. "1Y"). */
  rangeLabel: string
}

/**
 * A diverging-bar breakdown of how each member fared against the benchmark over
 * the selected range. Bars grow right (green) when a stock beat the benchmark
 * and left (red) when it lagged, sized against the widest spread so the leaders
 * and laggards are obvious at a glance. Sorted best-to-worst.
 */
export default function RelativePerformanceBars({
  rows,
  benchmarkSymbol,
  benchmarkReturn,
  rangeLabel,
}: Props) {
  const theme = useTheme()
  const up = theme.palette.success.main
  const down = theme.palette.error.main

  const sorted = [...rows].sort((a, b) => b.rel - a.rel)
  // Scale every bar against the widest spread (min 1 so a flat field doesn't
  // blow tiny differences up to full width).
  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.rel)))

  return (
    <Box sx={{ mt: 3 }}>
      <Stack
        direction="row"
        sx={{
          justifyContent: 'space-between',
          alignItems: 'baseline',
          mb: 1.5,
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          Return vs. {benchmarkSymbol} · {rangeLabel}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {benchmarkSymbol} {fmtPct(benchmarkReturn)}
        </Typography>
      </Stack>

      <Stack spacing={0.75}>
        {sorted.map((r) => {
          const beat = r.rel >= 0
          const frac = Math.abs(r.rel) / maxAbs // 0..1 of each half-width
          return (
            <Box
              key={r.symbol}
              sx={{
                display: 'grid',
                gridTemplateColumns: '60px 1fr 150px',
                alignItems: 'center',
                columnGap: 1.5,
              }}
            >
              {/* swatch + symbol */}
              <Box
                sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}
              >
                <Box
                  sx={{
                    width: 9,
                    height: 9,
                    borderRadius: '2px',
                    bgcolor: r.color,
                    flexShrink: 0,
                  }}
                />
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 600, lineHeight: 1 }}
                >
                  {r.symbol}
                </Typography>
              </Box>

              {/* diverging bar: centre = matches the benchmark */}
              <Box
                sx={{
                  position: 'relative',
                  height: 18,
                  borderRadius: 0.5,
                  bgcolor: 'action.hover',
                }}
              >
                <Box
                  sx={{
                    position: 'absolute',
                    left: '50%',
                    top: 0,
                    bottom: 0,
                    width: '1px',
                    bgcolor: 'divider',
                  }}
                />
                <Box
                  sx={{
                    position: 'absolute',
                    top: 3,
                    bottom: 3,
                    borderRadius: 0.5,
                    bgcolor: beat ? up : down,
                    ...(beat
                      ? { left: '50%', width: `${frac * 50}%` }
                      : { right: '50%', width: `${frac * 50}%` }),
                  }}
                />
              </Box>

              {/* spread vs benchmark (headline) + absolute return (muted) */}
              <Box sx={{ textAlign: 'right' }}>
                <Typography
                  component="span"
                  variant="body2"
                  sx={{
                    fontWeight: 600,
                    color: beat ? up : down,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {fmtPct(r.rel)}
                </Typography>
                <Typography
                  component="span"
                  variant="caption"
                  color="text.secondary"
                  sx={{ ml: 0.75, fontVariantNumeric: 'tabular-nums' }}
                >
                  ({fmtPct(r.totalPct)})
                </Typography>
              </Box>
            </Box>
          )
        })}
      </Stack>
    </Box>
  )
}
