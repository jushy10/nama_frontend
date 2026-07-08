import { Box, Card, CardContent, Stack, Typography } from '@mui/material'
import {
  humanizeClassification,
  industryPeStance,
  MIN_INDUSTRY_PEERS,
  type IndustryPeStance,
  type IndustryValuation,
} from '@/lib/api'

// Cheaper-than-peers reads green, in-line amber, pricier red — the same
// valuation palette the PEG card uses, so "green = cheap" stays consistent down
// the page. Amber is the shared neutral the verdict cards land on.
const STANCE: Record<IndustryPeStance, { color: string; label: string }> = {
  below: { color: 'success.main', label: 'Below Peers' },
  in_line: { color: '#fbbf24', label: 'In Line' },
  above: { color: 'error.main', label: 'Above Peers' },
}

/** A P/E to one decimal, e.g. 21.04 → "21.0". */
const fmt = (n: number) => n.toFixed(1)

/**
 * The one-line story the two figures tell together, worded off the graded
 * stance so the chip and the sentence never disagree at the ±10% band edge.
 */
function comparisonLine(
  stockPe: number | null,
  median: number,
  label: string,
  stance: IndustryPeStance | null,
): string {
  if (stance === null) {
    return (
      `The typical ${label} stock trades around a P/E of ${fmt(median)}. ` +
      'This one has no positive trailing P/E to set beside it (a loss, or ' +
      'not yet covered).'
    )
  }
  if (stance === 'in_line') {
    return (
      `Its trailing P/E of ${fmt(stockPe as number)} is roughly in line with ` +
      `the typical ${label} stock (median ${fmt(median)}) — priced about the ` +
      'same as its peers.'
    )
  }
  const pct = Math.abs(Math.round(((stockPe as number) / median - 1) * 100))
  if (stance === 'above') {
    return (
      `Its trailing P/E of ${fmt(stockPe as number)} is about ${pct}% above ` +
      `the typical ${label} stock (median ${fmt(median)}) — the market is ` +
      'paying up for it relative to its peers.'
    )
  }
  return (
    `Its trailing P/E of ${fmt(stockPe as number)} is about ${pct}% below the ` +
    `typical ${label} stock (median ${fmt(median)}) — cheaper than its peers, ` +
    'whether a bargain or a discount for slower growth.'
  )
}

/** One labelled figure block — the stock's own P/E and the industry median, side
 *  by side. The stock's value is tinted by its stance; the median stays neutral. */
function Figure({
  label,
  value,
  color,
  missing,
}: {
  label: string
  value: number | null
  color: string
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
          color: value == null ? 'text.primary' : color,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.1,
        }}
      >
        {value == null ? '—' : fmt(value)}
      </Typography>
      {value == null && (
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
          {missing}
        </Typography>
      )}
    </Box>
  )
}

/**
 * The peer-range bar: the industry's middle-half P/E band (25th–75th percentile)
 * as a neutral track, a divider at the median, and — when the stock has a
 * positive trailing P/E — a marker in its stance colour showing where it lands.
 * The axis is padded around whichever of the four points is widest, so the stock
 * marker stays on-bar even when it sits outside the peer band.
 */
function RangeBar({
  p25,
  p75,
  median,
  stockPe,
  markerColor,
}: {
  p25: number
  p75: number
  median: number
  stockPe: number | null
  markerColor: string
}) {
  const marked = stockPe != null && stockPe > 0
  const points = [p25, p75, median, ...(marked ? [stockPe as number] : [])]
  const lo = Math.min(...points)
  const hi = Math.max(...points)
  const pad = (hi - lo || median || 1) * 0.18
  const axisLo = Math.max(0, lo - pad)
  const axisHi = hi + pad
  const span = axisHi - axisLo || 1
  const pos = (v: number) => ((v - axisLo) / span) * 100

  const aria = marked
    ? `This stock's P/E ${fmt(stockPe as number)} against the ${fmt(p25)} to ${fmt(
        p75,
      )} peer range, median ${fmt(median)}`
    : `Peer P/E range ${fmt(p25)} to ${fmt(p75)}, median ${fmt(median)}`

  return (
    <Box sx={{ mt: 2.5 }}>
      {/* Marker label — only when the stock has a P/E to place. */}
      <Box sx={{ position: 'relative', height: 16 }}>
        {marked && (
          <Typography
            variant="caption"
            sx={{
              position: 'absolute',
              left: `${pos(stockPe as number)}%`,
              bottom: 2,
              transform: 'translateX(-50%)',
              color: markerColor,
              fontWeight: 700,
              fontSize: '0.65rem',
              letterSpacing: '0.03em',
              lineHeight: 1,
              whiteSpace: 'nowrap',
            }}
          >
            This stock
          </Typography>
        )}
      </Box>

      <Box
        role="img"
        aria-label={aria}
        sx={{
          position: 'relative',
          height: 10,
          borderRadius: 5,
          bgcolor: 'action.hover',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        {/* The middle-half peer band (25th–75th percentile). */}
        <Box
          sx={{
            position: 'absolute',
            top: -1,
            bottom: -1,
            left: `${pos(p25)}%`,
            width: `${pos(p75) - pos(p25)}%`,
            borderRadius: 5,
            bgcolor: 'primary.main',
            opacity: 0.22,
          }}
        />
        {/* Median divider. */}
        <Box
          sx={{
            position: 'absolute',
            top: -3,
            left: `${pos(median)}%`,
            transform: 'translateX(-50%)',
            width: 2,
            height: 16,
            borderRadius: 1,
            bgcolor: 'text.secondary',
            opacity: 0.7,
          }}
        />
        {/* The stock's own P/E marker, in its stance colour. */}
        {marked && (
          <Box
            sx={{
              position: 'absolute',
              top: -4,
              left: `${pos(stockPe as number)}%`,
              transform: 'translateX(-50%)',
              width: 3,
              height: 18,
              borderRadius: 1,
              bgcolor: markerColor,
              boxShadow: (theme) =>
                `0 0 0 2px ${theme.palette.background.default}`,
            }}
          />
        )}
      </Box>

      {/* Axis: the band ends and the median, each under its position. */}
      <Box sx={{ position: 'relative', mt: 0.75, height: 26 }}>
        {[
          {
            key: 'p25',
            at: pos(p25),
            value: p25,
            sub: '25th',
            anchor: 'left' as const,
          },
          {
            key: 'median',
            at: pos(median),
            value: median,
            sub: 'median',
            anchor: 'center' as const,
          },
          {
            key: 'p75',
            at: pos(p75),
            value: p75,
            sub: '75th',
            anchor: 'right' as const,
          },
        ].map(({ key, at, value, sub, anchor }) => (
          <Box
            key={key}
            sx={{
              position: 'absolute',
              left: `${at}%`,
              transform:
                anchor === 'left'
                  ? 'none'
                  : anchor === 'right'
                    ? 'translateX(-100%)'
                    : 'translateX(-50%)',
              textAlign: anchor,
            }}
          >
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                fontWeight: 600,
                color: 'text.primary',
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1.1,
              }}
            >
              {fmt(value)}
            </Typography>
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
          </Box>
        ))}
      </Box>
    </Box>
  )
}

/**
 * The peer-valuation read off the ticker card's `metrics.pe` and the stock's
 * industry benchmark (`GET /stocks/industries/{industry}/pe`): where the stock's
 * trailing P/E sits against the median and interquartile range of its screened
 * peers. An absolute multiple says little on its own — this is the anchor that
 * makes it "rich" or "cheap" *for its industry*. A verdict chip grades the
 * stance, a bar plots the stock against the peer band, and a plain-language line
 * spells out the gap. Renders nothing without a median, or when fewer than
 * `MIN_INDUSTRY_PEERS` peers back it — a "median" over one or two names is
 * those companies' own multiples, not an industry anchor, so no card beats a
 * noise verdict.
 */
export default function IndustryPeCard({
  stockPe,
  valuation,
}: {
  stockPe: number | null
  valuation: IndustryValuation
}) {
  const { median_pe, p25_pe, p75_pe, count, industry } = valuation
  if (median_pe == null || count < MIN_INDUSTRY_PEERS) return null

  const label = humanizeClassification(industry)
  const stance = industryPeStance(stockPe, median_pe)
  const meta = stance ? STANCE[stance] : null
  const stockColor = meta ? meta.color : 'text.primary'
  const hasBand = p25_pe != null && p75_pe != null

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
              Industry P/E
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Trailing multiple vs. {label} peers
            </Typography>
          </Box>

          {meta && (
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
                {meta.label}
              </Box>
            </Box>
          )}
        </Stack>

        <Box
          sx={{
            mt: 2,
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            columnGap: 2,
          }}
        >
          <Figure
            label="Its P/E"
            value={stockPe}
            color={stockColor}
            missing="No trailing P/E (a loss, or not yet covered)"
          />
          <Figure
            label={`${label} median`}
            value={median_pe}
            color="text.primary"
            missing=""
          />
        </Box>

        {hasBand && (
          <RangeBar
            p25={p25_pe as number}
            p75={p75_pe as number}
            median={median_pe}
            stockPe={stockPe}
            markerColor={stockColor}
          />
        )}

        <Typography variant="body2" color="text.secondary" sx={{ mt: 2.5 }}>
          {comparisonLine(stockPe, median_pe, label, stance)}
        </Typography>

        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', mt: 1 }}
        >
          Median trailing P/E across {count} {count === 1 ? 'peer' : 'peers'}{' '}
          with a positive multiple in the same industry. A rough guide — a
          higher or lower P/E than peers can reflect faster or slower growth,
          not just a richer or cheaper price.
        </Typography>
      </CardContent>
    </Card>
  )
}
