import { Box, Card, CardContent, Stack, Typography } from '@mui/material'
import SellOutlinedIcon from '@mui/icons-material/SellOutlined'
import {
  valuationVerdict,
  type ValuationVerdict,
  type TickerMetrics,
} from '@/lib/api'
import InfoHint from '@/components/InfoHint'

// Amber for the cautionary "priced for growth" read — the shared verdict-card amber.
const CAUTION = '#fbbf24' // amber-400

// The PEG meter spans 0 → 3, with cuts at 1 (price matches growth) and 2. Under 1 the
// multiple is cheap for the growth behind it, over 2 it's rich.
const PEG_MIN = 0
const PEG_MAX = 3
const PEG_SPAN = PEG_MAX - PEG_MIN

// Per-verdict colour, PEG-track tint, and plain-language blurb — the growth-adjusted
// read that backs the verdict chip. Cheap reads green, fair neutral, rich amber.
const VERDICT: Record<
  ValuationVerdict,
  { color: string; track: string; blurb: string }
> = {
  'Cheap for Growth': {
    color: 'success.main',
    track: 'rgba(52,211,153,0.3)',
    blurb: 'The multiple is low for the earnings growth behind it.',
  },
  'Fairly Priced': {
    color: 'text.secondary',
    track: 'rgba(148,163,184,0.2)',
    blurb: 'The multiple is roughly in balance with its earnings growth.',
  },
  'Priced for Growth': {
    color: CAUTION,
    track: 'rgba(251,191,36,0.28)',
    blurb:
      'The price runs ahead of the growth — the growth has to show up to justify it.',
  },
}

/** A valuation multiple as one decimal with a times sign, e.g. 28.53 → "28.5×". */
const fmtMultiple = (n: number) => `${n.toFixed(1)}×`
/** A ratio to two decimals — PEG, e.g. 1.8 → "1.80". */
const fmtRatio = (n: number) => n.toFixed(2)
/** Earnings per share as currency, e.g. 6.1 → "$6.10", -1.2 → "-$1.20". */
const fmtEps = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(n).toFixed(2)}`

// Where a PEG sits on its 0–3 track (clamped).
const pegPos = (v: number) =>
  ((Math.max(PEG_MIN, Math.min(PEG_MAX, v)) - PEG_MIN) / PEG_SPAN) * 100
const pegEdge = (v: number) => ((v - PEG_MIN) / PEG_SPAN) * 100

/** A dot on the P/E slope — filled for the trailing (now) figure, hollow for the
 *  forward (expected) one. */
function SlopeDot({
  at,
  tone,
  hollow = false,
}: {
  at: number
  tone: string
  hollow?: boolean
}) {
  return (
    <Box
      sx={{
        position: 'absolute',
        top: '50%',
        left: `${at}%`,
        transform: 'translate(-50%, -50%)',
        width: 11,
        height: 11,
        borderRadius: '50%',
        bgcolor: hollow ? 'background.paper' : tone,
        border: hollow ? '2px solid' : 'none',
        borderColor: tone,
        boxShadow: (t) => `0 0 0 2px ${t.palette.background.default}`,
      }}
    />
  )
}

/** The trailing→forward P/E slope: two dots on one track (filled now, hollow next
 *  year) joined by a line, so the re-rating the market prices in reads as a move. When
 *  only the trailing multiple is covered it's a single dot. */
function PeSlope({
  trailing,
  forward,
}: {
  trailing: number
  forward: number | null
}) {
  const top = Math.max(trailing, forward ?? 0) * 1.2 || 1
  const posT = (trailing / top) * 100
  const posF = forward != null ? (forward / top) * 100 : null
  return (
    <Box sx={{ mt: 2.5 }}>
      <Box
        role="img"
        aria-label={
          forward != null
            ? `P/E of ${fmtMultiple(trailing)} today, ${fmtMultiple(forward)} on next year's estimate`
            : `P/E of ${fmtMultiple(trailing)}`
        }
        sx={{
          position: 'relative',
          height: 6,
          borderRadius: 3,
          bgcolor: 'action.hover',
        }}
      >
        {posF != null && (
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: `${Math.min(posT, posF)}%`,
              width: `${Math.abs(posT - posF)}%`,
              height: 2,
              transform: 'translateY(-50%)',
              bgcolor: 'text.secondary',
              opacity: 0.45,
            }}
          />
        )}
        <SlopeDot at={posT} tone="primary.main" />
        {posF != null && <SlopeDot at={posF} tone="primary.light" hollow />}
      </Box>
      <Stack
        direction="row"
        spacing={2}
        sx={{ mt: 1, flexWrap: 'wrap', rowGap: 0.5 }}
      >
        <Legend filled label="Now" value={fmtMultiple(trailing)} />
        {forward != null && (
          <Legend label="Next year" value={fmtMultiple(forward)} />
        )}
      </Stack>
    </Box>
  )
}

/** The slope legend: a filled/hollow dot, a label, and the value it marks. */
function Legend({
  label,
  value,
  filled = false,
}: {
  label: string
  value: string
  filled?: boolean
}) {
  return (
    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
      <Box
        sx={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          bgcolor: filled ? 'primary.main' : 'background.paper',
          border: filled ? 'none' : '2px solid',
          borderColor: 'primary.light',
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

/** The PEG meter: the growth-adjusted valuation read on a 0–3 track with a bold 1.0
 *  line (price matches growth), zoned cheap / fair / rich, a marker at the PEG, and the
 *  verdict blurb beneath. */
function PegMeter({
  peg,
  meta,
}: {
  peg: number
  meta: (typeof VERDICT)[ValuationVerdict]
}) {
  const parity = pegEdge(1)
  return (
    <Box sx={{ mt: 3 }}>
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
          Price vs growth (PEG)
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: meta.color,
            fontVariantNumeric: 'tabular-nums',
            fontWeight: 700,
          }}
        >
          {fmtRatio(peg)}
        </Typography>
      </Stack>
      <Box
        role="img"
        aria-label={`PEG ratio of ${fmtRatio(peg)}`}
        sx={{
          position: 'relative',
          height: 6,
          borderRadius: 3,
          background: `linear-gradient(to right,
            ${VERDICT['Cheap for Growth'].track} 0%,
            ${VERDICT['Cheap for Growth'].track} ${parity}%,
            ${VERDICT['Fairly Priced'].track} ${parity}%,
            ${VERDICT['Fairly Priced'].track} ${pegEdge(2)}%,
            ${VERDICT['Priced for Growth'].track} ${pegEdge(2)}%,
            ${VERDICT['Priced for Growth'].track} 100%)`,
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: -3,
            left: `${parity}%`,
            transform: 'translateX(-50%)',
            width: 2,
            height: 12,
            borderRadius: 1,
            bgcolor: 'text.secondary',
            opacity: 0.6,
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: `${pegPos(peg)}%`,
            transform: 'translate(-50%, -50%)',
            width: 10,
            height: 10,
            borderRadius: '50%',
            bgcolor:
              meta.color === 'text.secondary' ? 'text.primary' : meta.color,
            boxShadow: (t) => `0 0 0 2px ${t.palette.background.default}`,
          }}
        />
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        {meta.blurb}
      </Typography>
    </Box>
  )
}

/** A supporting figure as a compact tile. `sub` shows the forward figure beside the
 *  trailing one where the market projects next year. */
function StatTile({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string | null
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
      <Box sx={{ mt: 0.25, fontVariantNumeric: 'tabular-nums' }}>
        <Box component="span" sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
          {value}
        </Box>
        {sub && (
          <Box
            component="span"
            sx={{
              color: 'text.secondary',
              fontWeight: 600,
              fontSize: '0.85rem',
              ml: 0.5,
            }}
          >
            → {sub}
          </Box>
        )}
      </Box>
    </Box>
  )
}

/**
 * The valuation read for the Fundamentals tab: what you pay for the business. Leads with
 * the trailing P/E and how it's expected to re-rate on next year's earnings (the slope),
 * then the growth-adjusted PEG read (cheap / fair / rich versus its own growth), with the
 * price-to-sales, price-to-book and per-share earnings as supporting figures. The peer
 * and own-history P/E reads sit in their own cards below — this is the multiples
 * themselves. Rides the ticker card's `metrics` block; renders nothing when no valuation
 * figure is covered.
 */
export default function ValuationCard({ metrics }: { metrics: TickerMetrics }) {
  const { pe, forward_pe, ps, forward_ps, pb, peg, eps } = metrics
  const anyValuation =
    pe != null ||
    forward_pe != null ||
    ps != null ||
    pb != null ||
    peg != null ||
    eps != null
  if (!anyValuation) return null

  const verdict = valuationVerdict(peg)
  const meta = verdict ? VERDICT[verdict] : null

  return (
    <Card variant="outlined" sx={{ borderColor: 'divider' }}>
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}
        >
          <Box>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
              <SellOutlinedIcon
                fontSize="small"
                sx={{ color: 'secondary.main' }}
              />
              <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
                Valuation
              </Typography>
              <InfoHint title="What you pay for the earnings: the price-to-earnings multiple (trailing and on next year's estimate), how that multiple compares with the growth behind it (PEG), and the price-to-sales, price-to-book and per-share earnings. A rough guide, not advice." />
            </Stack>
            <Typography variant="caption" color="text.secondary">
              What you pay for the earnings
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

        {pe != null ? (
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
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1,
                }}
              >
                {fmtMultiple(pe)}
              </Typography>
              <Typography color="text.secondary" sx={{ fontWeight: 500 }}>
                trailing P/E
              </Typography>
            </Stack>
            <PeSlope trailing={pe} forward={forward_pe} />
          </>
        ) : (
          <Typography color="text.secondary" sx={{ mt: 2 }}>
            No trailing P/E — the last twelve months ran at a loss, so the
            multiple isn&apos;t meaningful.
          </Typography>
        )}

        {peg != null && meta && <PegMeter peg={peg} meta={meta} />}

        <Box
          sx={{
            mt: 2.5,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 1.5,
          }}
        >
          <StatTile
            label="Price / sales"
            value={ps != null ? fmtMultiple(ps) : '—'}
            sub={forward_ps != null ? fmtMultiple(forward_ps) : null}
          />
          <StatTile
            label="Price / book"
            value={pb != null ? fmtMultiple(pb) : '—'}
          />
          <StatTile label="EPS (TTM)" value={eps != null ? fmtEps(eps) : '—'} />
        </Box>
      </CardContent>
    </Card>
  )
}
