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
  /**
   * The benchmark's own row. Its `rel` is 0 by definition, so it sorts to the
   * divide between out- and under-performers and renders as a neutral base.
   */
  isBenchmark?: boolean
}

const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`

interface Props {
  rows: RelRow[]
  /** The benchmark ticker (e.g. QQQ) every row is measured against. */
  benchmarkSymbol: string
  /** The selected range, shown in the header (e.g. "1Y"). */
  rangeLabel: string
}

/**
 * A diverging-bar breakdown of how each member fared against the benchmark over
 * the selected range. Bars grow right (green) when a stock beat the benchmark
 * and left (red) when it lagged, sized against the widest spread so the leaders
 * and laggards are obvious at a glance. Sorted best-to-worst, with the benchmark
 * itself sitting on the zero line as a neutral base row.
 */
export default function RelativePerformanceBars({
  rows,
  benchmarkSymbol,
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
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>
        Return vs. {benchmarkSymbol} · {rangeLabel}
      </Typography>

      <Stack spacing={0.75}>
        {sorted.map((r) => {
          const beat = r.rel >= 0
          const frac = Math.abs(r.rel) / maxAbs // 0..1 of each half-width
          const isBench = r.isBenchmark
          return (
            <Box
              key={r.symbol}
              sx={{
                display: 'grid',
                // Tighten the fixed columns and gap on phones so the diverging
                // bar keeps room to read: on xs the value column drops the muted
                // absolute-return parenthetical (below) and shows just the spread
                // headline, so it needs far less room. Roomier on sm+, where the
                // full "+spread% (+total%)" reads.
                gridTemplateColumns: {
                  xs: '60px 1fr 84px',
                  sm: '60px 1fr 150px',
                },
                alignItems: 'center',
                columnGap: { xs: 1, sm: 1.5 },
                // The benchmark is the zero line everything is measured against;
                // a faint band and a touch of padding set it apart as the base.
                ...(isBench && {
                  bgcolor: 'action.hover',
                  borderRadius: 0.5,
                  py: 0.5,
                }),
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
                  // The base row already sits on a band, so its track stays clear
                  // — only the centre reference line runs through it.
                  bgcolor: isBench ? 'transparent' : 'action.hover',
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
                {!isBench && (
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
                )}
              </Box>

              {/* spread vs benchmark (headline) + absolute return (muted); the
                  base row shows its own return, since its spread is always 0 */}
              <Box sx={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                {isBench ? (
                  <Typography
                    component="span"
                    variant="body2"
                    sx={{
                      fontWeight: 600,
                      color: 'text.primary',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {fmtPct(r.totalPct)}
                  </Typography>
                ) : (
                  <>
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
                      sx={{
                        display: { xs: 'none', sm: 'inline' },
                        ml: 0.75,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      ({fmtPct(r.totalPct)})
                    </Typography>
                  </>
                )}
              </Box>
            </Box>
          )
        })}
      </Stack>
    </Box>
  )
}
