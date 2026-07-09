import { Box, Card, CardContent, Stack, Typography } from '@mui/material'
import { pegVerdict, type PegVerdict } from '@/lib/api'

// Amber for the unremarkable 1–2 middle — matches the Profitability card's
// cautionary tier, the shared amber the verdict cards use for a neutral call.
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

/** Verdict colour for a reading — the shared palette drives value, marker and
 *  label so each reading keeps one colour across the card. */
const readingColor = (peg: number | null): string => {
  const v = pegVerdict(peg)
  return v ? VERDICT[v].color : 'text.secondary'
}

/**
 * How the market's growth expectations shift the reading — the one-line story
 * the two figures tell together. Only offered when both are meaningful
 * (positive), since a sign flip means one side isn't a gradeable ratio at all.
 */
function comparisonLine(trailing: number, forward: number): string | null {
  if (trailing <= 0 || forward <= 0) return null
  if (forward < trailing) {
    return (
      'The forward reading is lower — against the growth analysts expect, ' +
      'the price looks cheaper than the trailing year suggests.'
    )
  }
  if (forward > trailing) {
    return (
      'The forward reading is higher — analysts expect growth to slow, so ' +
      'the price looks richer than the trailing year suggests.'
    )
  }
  return null
}

/** The 0→3× track with its cheap / fair / pricey zones, a bold fair-value
 *  divider at 1, and a labelled marker per reading — "TTM" for the trailing
 *  ratio, "FWD" for the forward one. The labels ride in their own two rows
 *  above the track (TTM upper, FWD lower) so they never collide, however
 *  close the readings sit. */
function Gauge({
  trailing,
  forward,
}: {
  trailing: number | null
  forward: number | null
}) {
  const fairValue = edge(1)
  const readings = [
    { key: 'TTM', value: trailing, row: 1 },
    { key: 'FWD', value: forward, row: 0 },
  ].filter((r): r is { key: string; value: number; row: number } =>
    r.value != null ? true : false,
  )
  const aria = readings
    .map(
      (r) =>
        `${r.key === 'TTM' ? 'trailing' : 'forward'} PEG of ${fmtPeg(r.value)}`,
    )
    .join(', ')
  return (
    <Box sx={{ mt: 1.5 }}>
      {/* marker labels, one row per reading so TTM and FWD can't overlap */}
      <Box sx={{ position: 'relative', height: readings.length > 1 ? 30 : 16 }}>
        {readings.map((r) => (
          <Typography
            key={r.key}
            variant="caption"
            sx={{
              position: 'absolute',
              left: `${pos(r.value)}%`,
              bottom: r.row * 14 + 2,
              transform: 'translateX(-50%)',
              color: readingColor(r.value),
              fontWeight: 700,
              fontSize: '0.65rem',
              letterSpacing: '0.03em',
              lineHeight: 1,
              whiteSpace: 'nowrap',
            }}
          >
            {r.key}
          </Typography>
        ))}
      </Box>
      <Box
        role="img"
        aria-label={`PEG gauge: ${aria}`}
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
        {/* one marker per reading, in its verdict colour */}
        {readings.map((r) => (
          <Box
            key={r.key}
            sx={{
              position: 'absolute',
              top: -4,
              left: `${pos(r.value)}%`,
              transform: 'translateX(-50%)',
              width: 3,
              height: 16,
              borderRadius: 1,
              bgcolor: readingColor(r.value),
              boxShadow: (theme) =>
                `0 0 0 2px ${theme.palette.background.default}`,
            }}
          />
        ))}
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

/** One reading's value block: an uppercase label, the ratio in its verdict
 *  colour (an em dash when not served), and a one-line basis note. */
function Reading({
  label,
  value,
  basis,
  missing,
}: {
  label: string
  value: number | null
  basis: string
  missing: string
}) {
  return (
    <Box
      sx={{
        px: 1.5,
        py: 1.25,
        borderRadius: 1.5,
        bgcolor: 'action.hover',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{
          display: 'block',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          fontSize: '0.65rem',
        }}
      >
        {label}
      </Typography>
      <Typography
        variant="h4"
        sx={{
          mt: 0.25,
          fontWeight: 700,
          color: value == null ? 'text.primary' : readingColor(value),
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.1,
        }}
      >
        {value == null ? '—' : fmtPeg(value)}
      </Typography>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{
          display: 'block',
          mt: 0.5,
          fontSize: '0.68rem',
          lineHeight: 1.35,
        }}
      >
        {value == null ? missing : basis}
      </Typography>
    </Box>
  )
}

/**
 * A growth-adjusted valuation read off the ticker card's metrics block: the
 * trailing PEG (trailing P/E ÷ already-reported EPS growth) beside the forward
 * PEG (forward P/E ÷ the FY1→FY2 growth analysts expect), both plotted on one
 * 0→3× gauge so the trailing → forward shift reads at a glance. The verdict
 * chip grades the trailing ratio (the forward one when trailing isn't served);
 * a comparison line spells out what the gap between the two means. The card
 * gets the served ratios only — their inputs aren't served alongside them.
 */
export default function PegCard({
  peg,
  forwardPeg = null,
}: {
  peg: number | null
  forwardPeg?: number | null
}) {
  // The headline reading the verdict chip and blurb grade: trailing when
  // served, else the forward ratio (so the card still renders a verdict for a
  // symbol with consensus coverage but an ungradeable trailing year).
  const headline = peg ?? forwardPeg
  const verdict = pegVerdict(headline)
  const meta = verdict ? VERDICT[verdict] : null
  const compare =
    peg != null && forwardPeg != null ? comparisonLine(peg, forwardPeg) : null

  return (
    <Card variant="outlined" sx={{ borderColor: 'divider' }}>
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}
        >
          <Box>
            <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
              PEG Ratio
            </Typography>
            <Typography variant="caption" color="text.secondary">
              P/E ÷ EPS growth — trailing &amp; forward
            </Typography>
          </Box>

          {verdict && meta && (
            <Box
              sx={{
                textAlign: 'right',
                flexShrink: 0,
                alignSelf: { xs: 'flex-start' },
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  display: 'block',
                }}
              >
                {peg != null ? 'Verdict' : 'Fwd verdict'}
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
                  fontSize: { xs: '0.8rem', sm: '1rem' },
                  letterSpacing: '0.02em',
                  whiteSpace: 'nowrap',
                }}
              >
                {verdict}
              </Box>
            </Box>
          )}
        </Stack>

        {headline == null ? (
          <Typography color="text.secondary" sx={{ mt: 2 }}>
            No PEG data — the ratio needs positive earnings and EPS growth,
            trailing or expected.
          </Typography>
        ) : (
          <>
            <Box
              sx={{
                mt: 2,
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                columnGap: 2,
              }}
            >
              <Reading
                label="Trailing"
                value={peg}
                basis="P/E ÷ last year's reported EPS growth"
                missing="Needs a profitable, growing trailing year"
              />
              <Reading
                label="Forward"
                value={forwardPeg}
                basis="Fwd P/E ÷ expected EPS growth"
                missing="Needs a forward P/E and expected EPS growth"
              />
            </Box>

            <Gauge trailing={peg} forward={forwardPeg} />

            {meta && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 2.5 }}
              >
                {meta.blurb}
                {compare && ` ${compare}`}
              </Typography>
            )}

            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mt: 1 }}
            >
              Trailing uses the past year's reported EPS growth; forward uses
              the growth analysts expect for next fiscal year (FY1 → FY2). A
              rough guide that varies by sector.
            </Typography>
          </>
        )}
      </CardContent>
    </Card>
  )
}
