import { Box, Card, CardContent, Stack, Typography } from '@mui/material'
import WaterDropOutlinedIcon from '@mui/icons-material/WaterDropOutlined'
import {
  cashFlowVerdict,
  type CashFlowVerdict,
  type TickerMetrics,
} from '@/lib/api'
import InfoHint from '@/components/InfoHint'

// Amber for the cautionary "Thin Free Cash" — the shared amber the verdict
// cards use for a neutral middle call (matches ProfitabilityCard).
const THIN_COLOR = '#fbbf24' // amber-400

// The gauge spans -4% → +10% FCF yield: wide enough to seat a cash burner and a
// cash cow, with 0 (break-even) the line that splits generating cash from
// burning it. Cuts at 3/6 mark the thin / healthy / rich tiers.
const MIN = -4
const MAX = 10
const SPAN = MAX - MIN

// Per-verdict colour, gauge-track tint, and the plain-language blurb. A rich
// cash yield reads green (deepening the more it throws off), a thin one amber,
// a cash burn red — the same colour language as the profitability read beside it.
const VERDICT: Record<
  CashFlowVerdict,
  { color: string; track: string; blurb: string }
> = {
  'Cash Rich': {
    color: 'success.main',
    track: 'rgba(52,211,153,0.45)',
    blurb:
      'Throws off more than 6¢ of free cash on every dollar of market value — ' +
      'a rich, bond-like cash yield with room to fund buybacks and dividends.',
  },
  'Cash Generative': {
    color: 'success.main',
    track: 'rgba(52,211,153,0.3)',
    blurb:
      'Generates a healthy 3–6% of its market value in free cash each year — ' +
      'comfortably self-funding without leaning on outside money.',
  },
  'Thin Free Cash': {
    color: THIN_COLOR,
    track: 'rgba(251,191,36,0.28)',
    blurb:
      'Free cash runs under 3% of market value — either a richly-priced grower ' +
      'or a capital-hungry business, with little cash cushion for the price.',
  },
  'Cash Burning': {
    color: 'error.main',
    track: 'rgba(248,113,113,0.32)',
    blurb:
      'Spends more cash than it brings in — no free cash left after running the ' +
      'business and investing in it.',
  },
}

/** A yield/percentage as one decimal, e.g. 2.09 → "2.1%", -6.79 → "-6.8%". */
const fmtPct = (n: number) => `${n.toFixed(1)}%`
/** A signed percentage, e.g. 22.86 → "+22.9%", -6.79 → "-6.8%". */
const fmtSigned = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(1)}%`
/** A valuation multiple as one decimal with a times sign, e.g. 47.9 → "47.9×". */
const fmtMultiple = (n: number) => `${n.toFixed(1)}×`

// Where a yield sits on the 0–100 track (clamped to the gauge's range).
const pos = (y: number) =>
  ((Math.max(MIN, Math.min(MAX, y)) - MIN) / SPAN) * 100
// Track position of a yield edge (break-even at 0, the tier cuts at 3/6).
const edge = (y: number) => ((y - MIN) / SPAN) * 100

/** The -4→+10% track with its burn / thin / healthy / rich zones, a bold
 *  break-even divider at 0, and a marker at the current FCF yield. */
function Gauge({ yield: y, color }: { yield: number; color: string }) {
  const breakeven = edge(0)
  return (
    <Box sx={{ mt: 2 }}>
      <Box
        role="img"
        aria-label={`Free cash flow yield of ${fmtPct(y)}`}
        sx={{
          position: 'relative',
          height: 8,
          borderRadius: 4,
          // Red burn band up to break-even, then amber thin-yield, then greens
          // deepening through the healthy and rich zones.
          background: `linear-gradient(to right,
            ${VERDICT['Cash Burning'].track} 0%,
            ${VERDICT['Cash Burning'].track} ${breakeven}%,
            ${VERDICT['Thin Free Cash'].track} ${breakeven}%,
            ${VERDICT['Thin Free Cash'].track} ${edge(3)}%,
            ${VERDICT['Cash Generative'].track} ${edge(3)}%,
            ${VERDICT['Cash Generative'].track} ${edge(6)}%,
            ${VERDICT['Cash Rich'].track} ${edge(6)}%,
            ${VERDICT['Cash Rich'].track} 100%)`,
        }}
      >
        {/* break-even divider — the line that splits generating from burning */}
        <Box
          sx={{
            position: 'absolute',
            top: -3,
            left: `${breakeven}%`,
            transform: 'translateX(-50%)',
            width: 2,
            height: 14,
            borderRadius: 1,
            bgcolor: 'text.secondary',
            opacity: 0.6,
          }}
        />
        {/* current-yield marker */}
        <Box
          sx={{
            position: 'absolute',
            top: -4,
            left: `${pos(y)}%`,
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
          { v: `${MIN}%`, at: 0, anchor: 'left' as const, sub: null },
          {
            v: '0%',
            at: breakeven,
            anchor: 'center' as const,
            sub: 'break-even',
          },
          { v: '+6%', at: edge(6), anchor: 'center' as const, sub: null },
          { v: `+${MAX}%`, at: 100, anchor: 'right' as const, sub: null },
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
              textAlign: anchor,
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

/** The operating-cash → free-cash step, as one split bar: every dollar of
 *  operating cash yield divided into the free cash left over (kept, in the
 *  verdict colour) and what capital spending reinvests (the blue drag). Renders
 *  only when both yields are known and the business generated positive
 *  operating cash — the story it tells (capex eats into operating cash) needs a
 *  positive base to divide. */
function ConversionBar({
  ocfYield,
  fcfYield,
  keptColor,
}: {
  ocfYield: number
  fcfYield: number
  keptColor: string
}) {
  // Free cash can't exceed operating cash (capex ≥ 0) and a negative FCF keeps
  // nothing, so the kept slice is clamped to [0, OCF]; the rest is reinvested.
  const kept = Math.max(0, Math.min(fcfYield, ocfYield))
  const reinvested = ocfYield - kept
  const keptPct = (kept / ocfYield) * 100

  return (
    <Box sx={{ mt: 2 }}>
      <Stack
        direction="row"
        sx={{
          justifyContent: 'space-between',
          alignItems: 'baseline',
          mb: 0.75,
        }}
      >
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Cash conversion
        </Typography>
        <Typography
          variant="caption"
          sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}
        >
          {fmtPct(ocfYield)} operating cash yield
        </Typography>
      </Stack>
      <Box
        role="img"
        aria-label={`Of ${fmtPct(ocfYield)} operating cash yield, ${fmtPct(
          kept,
        )} is free cash and ${fmtPct(reinvested)} is reinvested as capital spending`}
        sx={{
          display: 'flex',
          height: 12,
          borderRadius: 6,
          overflow: 'hidden',
          bgcolor: 'action.hover',
        }}
      >
        <Box sx={{ width: `${keptPct}%`, bgcolor: keptColor }} />
        <Box
          sx={{
            width: `${100 - keptPct}%`,
            bgcolor: 'primary.main',
            opacity: 0.5,
          }}
        />
      </Box>
      <Stack
        direction="row"
        spacing={2}
        sx={{ mt: 1, flexWrap: 'wrap', rowGap: 0.5 }}
      >
        <LegendDot color={keptColor} label="Free cash" value={fmtPct(kept)} />
        <LegendDot
          color="primary.main"
          dim
          label="Reinvested (capex)"
          value={fmtPct(reinvested)}
        />
      </Stack>
    </Box>
  )
}

/** A small colour swatch + label + value, the key beneath the conversion bar. */
function LegendDot({
  color,
  label,
  value,
  dim = false,
}: {
  color: string
  label: string
  value: string
  dim?: boolean
}) {
  return (
    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
      <Box
        sx={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          bgcolor: color,
          opacity: dim ? 0.5 : 1,
          flexShrink: 0,
        }}
      />
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {label}{' '}
        <Box
          component="span"
          sx={{
            color: 'text.primary',
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}
        </Box>
      </Typography>
    </Stack>
  )
}

/** One supporting figure as a compact tile — a small label with the value below.
 *  `tone` colours notable values (a cheap multiple / positive growth green, a
 *  rich multiple / a decline red), left the default text colour otherwise. An em
 *  dash stands in when the vendor doesn't cover the field. */
function StatTile({
  label,
  value,
  color = 'text.primary',
}: {
  label: string
  value: string
  color?: string
}) {
  return (
    <Box
      sx={{
        borderRadius: 2,
        bgcolor: 'action.hover',
        px: 1.5,
        py: 1.25,
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
          mt: 0.25,
          fontWeight: 700,
          color,
          fontVariantNumeric: 'tabular-nums',
          fontSize: '1.1rem',
        }}
      >
        {value}
      </Typography>
    </Box>
  )
}

/**
 * The cash-generation read for the Fundamentals tab: how much free cash the
 * business throws off relative to its price (the headline FCF yield on a gauge),
 * how operating cash converts to free cash after capital spending (the
 * conversion bar), and the supporting cash multiples and growth (Price/FCF, the
 * operating-cash yield, and the year-over-year change in free cash). Rides the
 * ticker card's `metrics` block; renders nothing when the whole cash-flow block
 * is missing so the tab never shows an empty cash card.
 */
export default function CashGenerationCard({
  metrics,
}: {
  metrics: TickerMetrics
}) {
  const { fcf_yield, ocf_yield, price_to_fcf, fcf_growth_yoy } = metrics

  // Nothing to say about cash generation if the vendor covers none of it.
  if (
    fcf_yield == null &&
    ocf_yield == null &&
    price_to_fcf == null &&
    fcf_growth_yoy == null
  ) {
    return null
  }

  const verdict = cashFlowVerdict(fcf_yield)
  const meta = verdict ? VERDICT[verdict] : null
  const keptColor = meta?.color ?? 'text.secondary'

  // A negative or absent Price/FCF isn't meaningful (it mirrors negative free
  // cash, already flagged red above), so it reads "n/m" rather than a number.
  const pfcf =
    price_to_fcf != null && price_to_fcf > 0 ? fmtMultiple(price_to_fcf) : 'n/m'
  const growthColor =
    fcf_growth_yoy == null
      ? 'text.secondary'
      : fcf_growth_yoy >= 0
        ? 'success.main'
        : 'error.main'

  return (
    <Card variant="outlined" sx={{ borderColor: 'divider' }}>
      <CardContent
        sx={{
          p: { xs: 2, sm: 2.5 },
          '&:last-child': { pb: { xs: 2, sm: 2.5 } },
        }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}
        >
          <Box>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
              <WaterDropOutlinedIcon
                fontSize="small"
                sx={{ color: 'secondary.main' }}
              />
              <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
                Cash Generation
              </Typography>
              <InfoHint title="Free cash flow yield is free cash flow (operating cash minus capital spending) as a percent of market cap — the cash a shareholder's dollar earns. A rough, non-sector-aware guide, not advice." />
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Free cash flow yield &amp; quality
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

        {fcf_yield == null ? (
          // No FCF yield to gauge — a rare uncovered name. Skip the hero and
          // conversion bar and show whatever supporting figures did come back.
          <Typography color="text.secondary" sx={{ mt: 2 }}>
            No free-cash-flow yield to gauge cash generation.
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
                {fmtPct(fcf_yield)}
              </Typography>
              <Typography color="text.secondary" sx={{ fontWeight: 500 }}>
                free cash flow yield
              </Typography>
            </Stack>

            <Gauge yield={fcf_yield} color={meta?.color ?? 'text.secondary'} />

            {meta && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 1.75 }}
              >
                {meta.blurb}
              </Typography>
            )}

            {/* The operating-cash → free-cash step, when both yields are known
                and operating cash was positive to divide. */}
            {ocf_yield != null && ocf_yield > 0 && (
              <ConversionBar
                ocfYield={ocf_yield}
                fcfYield={fcf_yield}
                keptColor={keptColor}
              />
            )}
          </>
        )}

        {/* The supporting cash figures: the cash-based valuation multiple, the
            operating-cash yield, and how free cash grew over the year. */}
        <Box
          sx={{
            mt: 2,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 1,
          }}
        >
          <StatTile label="Price / FCF" value={pfcf} />
          <StatTile
            label="Operating CF yield"
            value={ocf_yield == null ? '—' : fmtPct(ocf_yield)}
          />
          <StatTile
            label="FCF growth (YoY)"
            value={fcf_growth_yoy == null ? '—' : fmtSigned(fcf_growth_yoy)}
            color={growthColor}
          />
        </Box>
      </CardContent>
    </Card>
  )
}
