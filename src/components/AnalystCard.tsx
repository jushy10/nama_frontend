import {
  Box,
  Card,
  CardContent,
  Divider,
  Stack,
  Typography,
  useTheme,
} from '@mui/material'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat'
import type { Theme } from '@mui/material/styles'
import {
  priceTargetUpside,
  type AnalystPriceTargets,
  type AnalystRecommendations,
  type Recommendation,
  type RecommendationTrend,
  type TopFirmRating,
} from '@/lib/api'

// Amber for the neutral "Hold" call — the theme defines only green (up) and red
// (down), so this fills the cautious middle, the shared amber the verdict cards
// use for a neutral read.
const HOLD_COLOR = '#fbbf24' // amber-400

// Consensus-chip styling keyed by the five-step label — the five-step palette
// shared across the app's verdict chips, so ratings read consistently with the
// other cards. `filled` (the Strong calls) renders a solid pill so the
// strongest conviction reads at a glance.
const CONSENSUS_STYLE: Record<
  Recommendation,
  { color: string; filled?: { bg: string; fg: string } }
> = {
  'Strong Buy': {
    color: 'success.main',
    filled: { bg: 'success.main', fg: 'success.contrastText' },
  },
  Buy: { color: 'success.main' },
  Hold: { color: HOLD_COLOR },
  Sell: { color: 'error.main' },
  'Strong Sell': {
    color: 'error.main',
    filled: { bg: 'error.main', fg: 'error.contrastText' },
  },
}

// The distribution buckets, ordered most → least bullish. The colour resolver
// reads the theme so the green/red shades track dark/light mode; the Strong
// calls take the darker shade, the plain ones the main shade.
const BUCKETS: {
  key: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell'
  label: Recommendation
  color: (t: Theme) => string
}[] = [
  {
    key: 'strong_buy',
    label: 'Strong Buy',
    color: (t) => t.palette.success.dark,
  },
  { key: 'buy', label: 'Buy', color: (t) => t.palette.success.main },
  { key: 'hold', label: 'Hold', color: () => HOLD_COLOR },
  { key: 'sell', label: 'Sell', color: (t) => t.palette.error.main },
  {
    key: 'strong_sell',
    label: 'Strong Sell',
    color: (t) => t.palette.error.dark,
  },
]

const DIRECTION = {
  upgraded: {
    Icon: TrendingUpIcon,
    color: 'success.main',
    text: 'Upgraded from last month',
  },
  downgraded: {
    Icon: TrendingDownIcon,
    color: 'error.main',
    text: 'Downgraded from last month',
  },
  unchanged: {
    Icon: TrendingFlatIcon,
    color: 'text.secondary',
    text: 'Unchanged from last month',
  },
} as const

// A firm's grade action → a human label, used when a top-firm row has no explicit
// rating grade to show (an initiation, a reiteration, …).
const ACTION_LABEL: Record<string, string> = {
  up: 'Upgrade',
  down: 'Downgrade',
  init: 'Initiated',
  main: 'Maintained',
  reit: 'Reiterated',
}

/** "Jun 2026" from the snapshot's ISO period. Parsed as a *local* date so a
 *  UTC-midnight ISO string doesn't format a day early in negative offsets — the
 *  same care EarningsCard takes with date-only fields. */
function monthLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  })
}

/** "Jun 9, 2026" from an ISO date — the rating-change event stamp. Parsed as a
 *  local date, same reasoning as `monthLabel`. */
function dayLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/** The stacked distribution bar: one coloured segment per stance, width ∝ its
 *  share of the analyst count. Zero-count buckets don't show. */
function DistributionBar({ trend }: { trend: RecommendationTrend }) {
  const theme = useTheme()
  const total = trend.total || 1
  return (
    <Box
      role="img"
      aria-label="Analyst rating distribution"
      sx={{
        display: 'flex',
        height: 12,
        borderRadius: 1,
        overflow: 'hidden',
        bgcolor: 'action.hover',
      }}
    >
      {BUCKETS.map((b) => {
        const count = trend[b.key]
        if (count <= 0) return null
        return (
          <Box
            key={b.key}
            sx={{ width: `${(count / total) * 100}%`, bgcolor: b.color(theme) }}
          />
        )
      })}
    </Box>
  )
}

/** Legend beneath the bar: a swatch, the stance label, and its analyst count. */
function Legend({ trend }: { trend: RecommendationTrend }) {
  const theme = useTheme()
  return (
    <Box
      sx={{
        mt: 1.5,
        display: 'grid',
        gridTemplateColumns: { xs: 'repeat(2, auto)', sm: 'repeat(5, auto)' },
        columnGap: 2,
        rowGap: 0.75,
        justifyContent: { xs: 'start', sm: 'space-between' },
      }}
    >
      {BUCKETS.map((b) => (
        <Stack
          key={b.key}
          direction="row"
          spacing={0.75}
          sx={{ alignItems: 'center' }}
        >
          <Box
            sx={{
              width: 10,
              height: 10,
              borderRadius: 0.5,
              bgcolor: b.color(theme),
              flexShrink: 0,
            }}
          />
          <Typography variant="caption" color="text.secondary">
            {b.label}
          </Typography>
          <Typography
            variant="caption"
            sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
          >
            {trend[b.key]}
          </Typography>
        </Stack>
      ))}
    </Box>
  )
}

/** "$315.57" — a price-target dollar amount, two decimals. */
function fmtDollars(n: number): string {
  return `$${n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

/** A value's position within [low, high] as a clamped 0–100 percent. */
function rangePct(v: number, low: number, high: number): number {
  return Math.max(0, Math.min(100, ((v - low) / (high - low)) * 100))
}

/** Signed whole-percent for the target-range endpoints, e.g. +33% / -12%. */
const signedPct = (n: number): string => `${n >= 0 ? '+' : ''}${Math.round(n)}%`

/**
 * The consensus 12-month price target: the mean target and its upside versus the
 * live price, over a low→high range bar that marks where the stock trades now
 * (the dot) against the average target (the tick). Renders nothing without a mean
 * target; the range bar is skipped when the low/high spread is missing or degenerate.
 */
function PriceTargets({
  targets,
  price,
}: {
  targets: AnalystPriceTargets
  price: number | null
}) {
  const mean = targets.mean
  if (mean == null) return null
  const upside = priceTargetUpside(targets, price)
  const upColor =
    upside == null
      ? 'text.secondary'
      : upside >= 0
        ? 'success.main'
        : 'error.main'
  const low = targets.low
  const high = targets.high
  // The upside/downside at each end of the analyst range, versus today's price
  // — so the endpoints read as "how far", not just dollar levels.
  const lowPct =
    low != null && price != null && price > 0
      ? ((low - price) / price) * 100
      : null
  const highPct =
    high != null && price != null && price > 0
      ? ((high - price) / price) * 100
      : null

  return (
    <Box sx={{ mt: 2.5 }}>
      <Divider sx={{ mb: 2 }} />
      <Stack
        direction="row"
        spacing={2}
        sx={{ justifyContent: 'space-between', alignItems: 'baseline' }}
      >
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          12-Month Price Target
        </Typography>
        {upside != null && (
          <Typography
            variant="body2"
            sx={{
              fontWeight: 700,
              color: upColor,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {upside >= 0 ? '+' : ''}
            {upside.toFixed(1)}% upside
          </Typography>
        )}
      </Stack>

      <Stack
        direction="row"
        spacing={1}
        sx={{ mt: 0.5, alignItems: 'baseline' }}
      >
        <Typography
          variant="h5"
          sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
        >
          {fmtDollars(mean)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          avg target{price != null ? ` · now ${fmtDollars(price)}` : ''}
        </Typography>
      </Stack>

      {low != null && high != null && high > low && (
        <Box sx={{ mt: 2 }}>
          <Box
            role="img"
            aria-label={`Price target range ${fmtDollars(low)} to ${fmtDollars(
              high,
            )}, average ${fmtDollars(mean)}${
              price != null ? `, price now ${fmtDollars(price)}` : ''
            }`}
            sx={{
              position: 'relative',
              height: 8,
              borderRadius: 1,
              bgcolor: 'action.hover',
            }}
          >
            {/* The gap between today's price and the average target, filled in
                the upside colour — green when the target sits above the price,
                red when below — so the direction and distance read at a glance. */}
            {price != null && (
              <Box
                sx={{
                  position: 'absolute',
                  left: `${Math.min(
                    rangePct(price, low, high),
                    rangePct(mean, low, high),
                  )}%`,
                  width: `${Math.abs(
                    rangePct(mean, low, high) - rangePct(price, low, high),
                  )}%`,
                  top: 0,
                  bottom: 0,
                  borderRadius: 1,
                  bgcolor: upColor,
                  opacity: 0.35,
                }}
              />
            )}
            {/* Average-target tick, in the same upside colour. */}
            <Box
              sx={{
                position: 'absolute',
                left: `${rangePct(mean, low, high)}%`,
                top: -2,
                bottom: -2,
                width: 3,
                transform: 'translateX(-50%)',
                borderRadius: 1,
                bgcolor: upColor,
              }}
            />
            {/* Current-price marker. */}
            {price != null && (
              <Box
                sx={{
                  position: 'absolute',
                  left: `${rangePct(price, low, high)}%`,
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  bgcolor: 'text.primary',
                  border: '2px solid',
                  borderColor: 'background.paper',
                }}
              />
            )}
          </Box>
          <Stack
            direction="row"
            sx={{ mt: 0.75, justifyContent: 'space-between' }}
          >
            <Typography variant="caption" color="text.secondary">
              Low {fmtDollars(low)}
              {lowPct != null && (
                <Box
                  component="span"
                  sx={{
                    ml: 0.5,
                    fontWeight: 600,
                    color: lowPct >= 0 ? 'success.main' : 'error.main',
                  }}
                >
                  {signedPct(lowPct)}
                </Box>
              )}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              High {fmtDollars(high)}
              {highPct != null && (
                <Box
                  component="span"
                  sx={{
                    ml: 0.5,
                    fontWeight: 600,
                    color: highPct >= 0 ? 'success.main' : 'error.main',
                  }}
                >
                  {signedPct(highPct)}
                </Box>
              )}
            </Typography>
          </Stack>
        </Box>
      )}
    </Box>
  )
}

/** One credible firm's current stance: its name and price target on the top
 *  line, its rating and the date beneath, with the target's upside vs the live
 *  price on the right when both are known. */
function TopFirmRow({
  firm,
  price,
}: {
  firm: TopFirmRating
  price: number | null
}) {
  const upside =
    firm.target != null && price != null && price > 0
      ? ((firm.target - price) / price) * 100
      : null
  const rating =
    firm.rating ?? (firm.action ? (ACTION_LABEL[firm.action] ?? null) : null)
  return (
    <Box sx={{ minWidth: 0 }}>
      <Stack
        direction="row"
        spacing={1}
        sx={{ justifyContent: 'space-between', alignItems: 'baseline' }}
      >
        <Typography
          variant="body2"
          sx={{
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {firm.firm}
        </Typography>
        {firm.target != null && (
          <Typography
            variant="body2"
            sx={{
              fontWeight: 700,
              flexShrink: 0,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {fmtDollars(firm.target)}
          </Typography>
        )}
      </Stack>
      <Stack
        direction="row"
        spacing={1}
        sx={{ justifyContent: 'space-between', alignItems: 'baseline' }}
      >
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {rating ? `${rating} · ` : ''}
          {dayLabel(firm.published_at)}
        </Typography>
        {upside != null && (
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              flexShrink: 0,
              color: upside >= 0 ? 'success.main' : 'error.main',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {signedPct(upside)}
          </Typography>
        )}
      </Stack>
    </Box>
  )
}

/** The most credible firms covering the stock and their current stance —
 *  best-first (by the backend's curated credibility ranking), replacing the raw
 *  recent-changes feed with the handful of reads worth trusting. */
function TopFirms({
  firms,
  price,
}: {
  firms: TopFirmRating[]
  price: number | null
}) {
  return (
    <Box sx={{ mt: 2.5 }}>
      <Divider sx={{ mb: 2 }} />
      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        Top Firms
      </Typography>
      <Stack spacing={1.5} sx={{ mt: 1.5 }}>
        {firms.map((f, i) => (
          <TopFirmRow key={`${f.firm}-${i}`} firm={f} price={price} />
        ))}
      </Stack>
    </Box>
  )
}

export default function AnalystCard({
  recommendations,
  topFirms = [],
  price = null,
}: {
  recommendations: AnalystRecommendations
  topFirms?: TopFirmRating[]
  price?: number | null
}) {
  const latest = recommendations.latest
  const consensus = latest?.consensus ?? null
  const style = consensus ? CONSENSUS_STYLE[consensus] : null
  const direction = recommendations.direction
    ? DIRECTION[recommendations.direction]
    : null
  const DirectionIcon = direction?.Icon

  // The bull / bear split as a share of the panel — the crisp headline number
  // the distribution bar otherwise leaves the reader to eyeball.
  const total = latest?.total ?? 0
  const bullPct =
    latest && total > 0
      ? Math.round(((latest.strong_buy + latest.buy) / total) * 100)
      : null
  const bearPct =
    latest && total > 0
      ? Math.round(((latest.sell + latest.strong_sell) / total) * 100)
      : null

  // What the card has to show. The trend distribution, the price target, and the
  // top-firms read are independent best-effort blocks; the empty state only
  // stands in when none of them has anything.
  const hasTrends = !!latest && total > 0
  const hasTargets = recommendations.price_targets?.mean != null
  const hasFirms = topFirms.length > 0
  const hasAny = hasTrends || hasTargets || hasFirms

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
              Analyst Ratings
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {latest
                ? `${latest.total} ${
                    latest.total === 1 ? 'analyst' : 'analysts'
                  } · ${monthLabel(latest.period)}`
                : 'Sell-side consensus'}
            </Typography>
          </Box>

          {consensus && style && (
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
                Consensus
              </Typography>
              <Box
                sx={{
                  mt: 0.5,
                  display: 'inline-block',
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: style.color,
                  fontWeight: 700,
                  fontSize: '1rem',
                  letterSpacing: '0.02em',
                  whiteSpace: 'nowrap',
                  ...(style.filled
                    ? { bgcolor: style.filled.bg, color: style.filled.fg }
                    : { bgcolor: 'action.hover', color: style.color }),
                }}
              >
                {consensus}
              </Box>
            </Box>
          )}
        </Stack>

        {hasAny ? (
          <>
            {hasTrends && latest && (
              <>
                <Typography variant="body2" sx={{ mt: 2.5 }}>
                  <Box
                    component="span"
                    sx={{ fontWeight: 700, color: 'success.main' }}
                  >
                    {bullPct}%
                  </Box>{' '}
                  rate it Buy or better
                  {bearPct != null && bearPct > 0 && (
                    <>
                      {' · '}
                      <Box
                        component="span"
                        sx={{ fontWeight: 700, color: 'error.main' }}
                      >
                        {bearPct}%
                      </Box>{' '}
                      Sell
                    </>
                  )}
                </Typography>
                <Box sx={{ mt: 1.5 }}>
                  <DistributionBar trend={latest} />
                  <Legend trend={latest} />
                </Box>
                {direction && DirectionIcon && (
                  <Stack
                    direction="row"
                    spacing={0.75}
                    sx={{
                      mt: 2.5,
                      alignItems: 'center',
                      color: direction.color,
                    }}
                  >
                    <DirectionIcon fontSize="small" />
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {direction.text}
                    </Typography>
                  </Stack>
                )}
              </>
            )}
            {recommendations.price_targets && (
              <PriceTargets
                targets={recommendations.price_targets}
                price={price}
              />
            )}
            {hasFirms && <TopFirms firms={topFirms} price={price} />}
          </>
        ) : (
          <Typography color="text.secondary" sx={{ mt: 2 }}>
            No analyst coverage for this stock.
          </Typography>
        )}
      </CardContent>
    </Card>
  )
}
