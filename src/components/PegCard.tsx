import { Box, Card, CardContent, Stack, Typography } from '@mui/material'
import { pegVerdict, type PegVerdict } from '@/lib/api'

// Amber for the unremarkable 1–2 middle — matches the Profitability card's
// cautionary tier and the RSI card's neutral call.
const FAIR_COLOR = '#fbbf24' // amber-400

// The gauge spans 0 → 3×. PEG is only served for positive earnings and growth,
// so it starts at 0; 3 comfortably seats the "well past pricey" tail (anything
// beyond clamps to the right edge), with 1 the Lynch fair-value line.
const MIN = 0
const MAX = 3
const SPAN = MAX - MIN

// Per-verdict colour, gauge-track tint, and the plain-language blurb. Cheap
// reads green, the middle amber, pricey red — Lynch's under-1 / over-2 bands.
const VERDICT: Record<
  PegVerdict,
  { color: string; track: string; blurb: string }
> = {
  'Cheap for Its Growth': {
    color: 'success.main',
    track: 'rgba(52,211,153,0.3)',
    blurb:
      'Earnings grew faster than the multiple the market pays for them — ' +
      'the price looks cheap against how quickly profits are rising.',
  },
  'Fairly Priced': {
    color: FAIR_COLOR,
    track: 'rgba(251,191,36,0.28)',
    blurb:
      'The multiple runs one to two times the earnings growth behind it — ' +
      'the price is roughly keeping pace with the profit trend.',
  },
  'Pricey for Its Growth': {
    color: 'error.main',
    track: 'rgba(248,113,113,0.32)',
    blurb:
      'The multiple is more than twice the earnings growth behind it — ' +
      'the price has run well ahead of how quickly profits are rising.',
  },
  'Not Meaningful': {
    color: 'error.main',
    track: 'rgba(248,113,113,0.32)',
    blurb:
      'A zero-or-negative ratio means losses or shrinking earnings — PEG ' +
      "can't grade a price against growth that isn't there.",
  },
}

/** PEG to two decimals, e.g. 1.19 → "1.19". */
const fmtPeg = (n: number) => n.toFixed(2)

// Where a PEG sits on the 0–100 track (clamped to the gauge's range).
const pos = (peg: number) =>
  ((Math.max(MIN, Math.min(MAX, peg)) - MIN) / SPAN) * 100
// Track position of a band edge (fair value at 1, the pricey cut at 2).
const edge = (peg: number) => ((peg - MIN) / SPAN) * 100

/** The 0→3× track with its cheap / fair / pricey zones, a bold fair-value
 *  divider at 1, and a marker at the current ratio. */
function Gauge({ peg, color }: { peg: number; color: string }) {
  const fairValue = edge(1)
  return (
    <Box sx={{ mt: 2.5 }}>
      <Box
        role="img"
        aria-label={`PEG ratio of ${fmtPeg(peg)}`}
        sx={{
          position: 'relative',
          height: 8,
          borderRadius: 4,
          // Green cheap band up to the fair-value line at 1, amber through the
          // unremarkable middle, then red once the price outruns the growth.
          background: `linear-gradient(to right,
            ${VERDICT['Cheap for Its Growth'].track} 0%,
            ${VERDICT['Cheap for Its Growth'].track} ${fairValue}%,
            ${VERDICT['Fairly Priced'].track} ${fairValue}%,
            ${VERDICT['Fairly Priced'].track} ${edge(2)}%,
            ${VERDICT['Pricey for Its Growth'].track} ${edge(2)}%,
            ${VERDICT['Pricey for Its Growth'].track} 100%)`,
        }}
      >
        {/* fair-value divider — where a point of P/E buys a point of growth */}
        <Box
          sx={{
            position: 'absolute',
            top: -3,
            left: `${fairValue}%`,
            transform: 'translateX(-50%)',
            width: 2,
            height: 14,
            borderRadius: 1,
            bgcolor: 'text.secondary',
            opacity: 0.6,
          }}
        />
        {/* current-ratio marker */}
        <Box
          sx={{
            position: 'absolute',
            top: -4,
            left: `${pos(peg)}%`,
            transform: 'translateX(-50%)',
            width: 3,
            height: 16,
            borderRadius: 1,
            bgcolor: color,
            boxShadow: (theme) =>
              `0 0 0 2px ${theme.palette.background.default}`,
          }}
        />
      </Box>
      <Box sx={{ position: 'relative', mt: 0.75, height: 28 }}>
        {[
          { v: '0', at: 0, anchor: 'left' as const, sub: null },
          {
            v: '1',
            at: fairValue,
            anchor: 'center' as const,
            sub: 'fair value',
          },
          { v: '2', at: edge(2), anchor: 'center' as const, sub: null },
          { v: '3+', at: 100, anchor: 'right' as const, sub: null },
        ].map(({ v, at, anchor, sub }) => (
          <Box
            key={v}
            sx={{
              position: 'absolute',
              left: `${at}%`,
              transform:
                anchor === 'left'
                  ? 'none'
                  : anchor === 'right'
                    ? 'translateX(-100%)'
                    : 'translateX(-50%)',
              textAlign:
                anchor === 'left'
                  ? 'left'
                  : anchor === 'right'
                    ? 'right'
                    : 'center',
            }}
          >
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {v}
            </Typography>
            {sub && (
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  color: 'text.secondary',
                  fontSize: '0.6rem',
                  lineHeight: 1,
                }}
              >
                {sub}
              </Typography>
            )}
          </Box>
        ))}
      </Box>
    </Box>
  )
}

/**
 * A growth-adjusted valuation verdict from the trailing PEG ratio (trailing
 * P/E ÷ trailing EPS growth, both off the stock snapshot). `pe` and
 * `epsGrowth` are the ratio's two inputs, shown beside the figure so the
 * number explains itself; when PEG is null they also let the empty state say
 * *why* (no growth to price against vs. simply not covered).
 */
export default function PegCard({
  peg,
  pe,
  epsGrowth,
}: {
  peg: number | null
  pe: number | null
  epsGrowth: number | null
}) {
  const verdict = pegVerdict(peg)
  const meta = verdict ? VERDICT[verdict] : null

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
              PEG Ratio
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Trailing P/E ÷ EPS growth
            </Typography>
          </Box>

          {verdict && meta && (
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
                Verdict
              </Typography>
              <Box
                sx={{
                  mt: 0.5,
                  display: 'inline-block',
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: meta.color,
                  color: meta.color,
                  bgcolor: 'action.hover',
                  fontWeight: 700,
                  fontSize: '1rem',
                  letterSpacing: '0.02em',
                }}
              >
                {verdict}
              </Box>
            </Box>
          )}
        </Stack>

        {peg == null ? (
          <Typography color="text.secondary" sx={{ mt: 2 }}>
            {epsGrowth != null && epsGrowth <= 0
              ? 'EPS fell over the past year, so there is no growth to ' +
                'price the multiple against.'
              : 'No PEG data — the ratio needs positive trailing earnings ' +
                'and EPS growth.'}
          </Typography>
        ) : (
          <>
            <Stack
              direction="row"
              spacing={1.5}
              sx={{ mt: 2, alignItems: 'baseline' }}
            >
              <Typography
                variant="h3"
                sx={{
                  fontWeight: 700,
                  color: meta?.color,
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1,
                }}
              >
                {fmtPeg(peg)}
              </Typography>
              <Typography color="text.secondary" sx={{ fontWeight: 500 }}>
                {pe != null && epsGrowth != null
                  ? `${pe.toFixed(1)} P/E ÷ ${epsGrowth.toFixed(1)}% EPS growth`
                  : 'P/E per point of EPS growth'}
              </Typography>
            </Stack>

            <Gauge peg={peg} color={meta?.color ?? 'text.secondary'} />

            {meta && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 2.5 }}
              >
                {meta.blurb}
              </Typography>
            )}

            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mt: 1 }}
            >
              Trailing PEG — uses the past year's reported EPS growth, not
              analyst forecasts. A rough guide that varies by sector.
            </Typography>
          </>
        )}
      </CardContent>
    </Card>
  )
}
