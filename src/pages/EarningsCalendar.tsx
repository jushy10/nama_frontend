import { useMemo, useState } from 'react'
import type { ComponentType } from 'react'
import {
  Alert,
  Avatar,
  Box,
  Chip,
  Container,
  IconButton,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material'
import type { SvgIconProps } from '@mui/material'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import TodayIcon from '@mui/icons-material/Today'
import EventBusyIcon from '@mui/icons-material/EventBusy'
import StarIcon from '@mui/icons-material/Star'
import WbTwilightIcon from '@mui/icons-material/WbTwilight'
import NightsStayIcon from '@mui/icons-material/NightsStay'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import ScheduleIcon from '@mui/icons-material/Schedule'
import { Link as RouterLink } from 'react-router-dom'
import { humanizeClassification, stockLogoUrl } from '@/lib/api'
import { errorMessage, useEarningsCalendar } from '@/lib/queries'
import {
  buildForwardWeeks,
  dayRelativeLabel,
  forwardWindow,
  spanLabel,
  todayIso,
  type DaySlot,
  type WeekGroup,
} from '@/lib/earningsWeek'
import { usePageMeta } from '@/lib/usePageMeta'
import type { EarningsCalendarItem } from '@/lib/api'
import PageHero from '@/components/PageHero'

// The view shows a two-week window and pages a fortnight at a time. `offset` counts weeks
// past the first forward week; it never goes below 0 (so the calendar can't page into the
// past) and is capped so the furthest window stays inside the backend's 92-day clamp.
const VISIBLE_WEEKS = 2
const WEEK_STEP = 2
const MAX_OFFSET = 10

// Market-cap tiers for the "important names" highlight. Large-cap and above get emphasised;
// mega-cap additionally earns a star. Thresholds are nominal (the anchor's cap is in the
// listing's own currency), which is plenty precise for a visual cue.
const LARGE_CAP = 10e9 // $10B
const MEGA_CAP = 200e9 // $200B

type CapTier = 'mega' | 'large' | null

/** The highlight tier for a market cap, or `null` for sub-large-cap / unknown (no highlight,
 *  which is also what a backend that doesn't yet send `market_cap` yields). */
function capTier(marketCap?: number | null): CapTier {
  if (marketCap == null) return null
  if (marketCap >= MEGA_CAP) return 'mega'
  if (marketCap >= LARGE_CAP) return 'large'
  return null
}

/** A compact market-cap label, e.g. `$3.1T`, `$45B`, `$920M`. */
function formatMarketCap(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(n >= 1e13 ? 0 : 1)}T`
  if (n >= 1e9) return `$${(n / 1e9).toFixed(n >= 1e11 ? 0 : 1)}B`
  if (n >= 1e6) return `$${Math.round(n / 1e6)}M`
  return `$${Math.round(n)}`
}

interface SessionMeta {
  key: string
  label: string
  Icon: ComponentType<SvgIconProps>
  color: string
  order: number
}

/**
 * How each reporting session reads at a glance, and the order reports sort within a day
 * (chronologically through the trading day: before open, intraday, after close, then
 * time-not-set). On brand: a gold sunrise for before-open (morning), a navy moon for
 * after-close (night) — the app's two accent colours doubling as a time-of-day cue, now
 * shown as a small per-row marker rather than a group header. `unknown` (or a stale backend
 * that omits `session`) reads as a muted "Time TBD".
 */
const SESSION_GROUPS: readonly SessionMeta[] = [
  {
    key: 'bmo',
    label: 'Before open',
    Icon: WbTwilightIcon,
    color: 'secondary.main',
    order: 0,
  },
  {
    key: 'during',
    label: 'During hours',
    Icon: WbSunnyIcon,
    color: 'text.secondary',
    order: 1,
  },
  {
    key: 'amc',
    label: 'After close',
    Icon: NightsStayIcon,
    color: 'primary.main',
    order: 2,
  },
  {
    key: 'unknown',
    label: 'Time TBD',
    Icon: ScheduleIcon,
    color: 'text.disabled',
    order: 3,
  },
]

const SESSION_BY_KEY: Record<string, SessionMeta> = Object.fromEntries(
  SESSION_GROUPS.map((g) => [g.key, g]),
)

/** The session meta an item reads under — anything unrecognized (or an absent session from a
 *  stale backend) falls back to `unknown` so no report is ever mis-marked or dropped. */
function sessionOf(item: EarningsCalendarItem): SessionMeta {
  return (
    (item.session && SESSION_BY_KEY[item.session]) || SESSION_BY_KEY.unknown
  )
}

/** Rank for the cap-tier sort — mega first, then large, then the rest. */
function capRank(item: EarningsCalendarItem): number {
  const tier = capTier(item.market_cap)
  return tier === 'mega' ? 0 : tier === 'large' ? 1 : 2
}

/** Order a day's reports for the ungrouped list: the biggest names first (so the important
 *  ones lead), then by session through the trading day, then alphabetical. */
function compareItems(
  a: EarningsCalendarItem,
  b: EarningsCalendarItem,
): number {
  return (
    capRank(a) - capRank(b) ||
    sessionOf(a).order - sessionOf(b).order ||
    a.ticker.localeCompare(b.ticker)
  )
}

/** Company logo in a white rounded tile, falling back to the ticker's initial — the
 *  screener's logo treatment, shrunk for this dense agenda. */
function StockLogo({ symbol }: { symbol: string }) {
  return (
    <Avatar
      variant="rounded"
      src={stockLogoUrl(symbol)}
      alt=""
      slotProps={{ img: { loading: 'lazy', style: { objectFit: 'contain' } } }}
      sx={{
        width: 24,
        height: 24,
        bgcolor: '#fff',
        color: '#111',
        fontSize: '0.7rem',
        fontWeight: 700,
        p: 0.3,
        flexShrink: 0,
      }}
    >
      {symbol.charAt(0)}
    </Avatar>
  )
}

/**
 * One company row: a session marker (gold sunrise before open, navy moon after close), the
 * logo, ticker over company name, and sector. A large-cap-or-bigger name is highlighted — a
 * gold left rule and tint, plus a star and its market-cap label for mega-caps — so the
 * important reports stand out in the flat, ungrouped day list. The whole row links to the
 * stock.
 */
function ReportRow({ item }: { item: EarningsCalendarItem }) {
  const tier = capTier(item.market_cap)
  const notable = tier !== null
  const session = sessionOf(item)
  const SessionIcon = session.Icon

  return (
    <Box
      component={RouterLink}
      to={`/search?symbol=${encodeURIComponent(item.ticker)}`}
      sx={{
        display: 'block',
        textDecoration: 'none',
        color: 'inherit',
        borderRadius: 1.5,
        borderLeft: '2px solid',
        borderLeftColor: notable ? 'secondary.main' : 'transparent',
        bgcolor: notable ? 'action.hover' : 'transparent',
        px: 1,
        py: 0.75,
        transition: 'background-color 120ms ease',
        '&:hover': { bgcolor: 'action.selected' },
        '&:focus-visible': {
          outline: 2,
          outlineColor: 'primary.main',
          outlineOffset: -2,
        },
      }}
    >
      <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
        <SessionIcon
          titleAccess={session.label}
          sx={{ fontSize: 14, color: session.color, flexShrink: 0 }}
        />
        <StockLogo symbol={item.ticker} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: 'baseline', justifyContent: 'space-between' }}
          >
            <Stack
              direction="row"
              spacing={0.4}
              sx={{ alignItems: 'center', minWidth: 0 }}
            >
              <Typography sx={{ fontWeight: 700, lineHeight: 1.2 }} noWrap>
                {item.ticker}
              </Typography>
              {tier === 'mega' && (
                <StarIcon sx={{ fontSize: 12, color: 'secondary.main' }} />
              )}
            </Stack>
            {item.sector && (
              <Typography
                variant="caption"
                color="text.secondary"
                noWrap
                sx={{ flexShrink: 1, minWidth: 0, textAlign: 'right' }}
              >
                {humanizeClassification(item.sector)}
              </Typography>
            )}
          </Stack>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: 'baseline', justifyContent: 'space-between' }}
          >
            {item.name ? (
              <Typography
                variant="caption"
                color="text.secondary"
                noWrap
                sx={{ minWidth: 0 }}
              >
                {item.name}
              </Typography>
            ) : (
              <span />
            )}
            {notable && item.market_cap != null && (
              <Typography
                variant="caption"
                sx={{
                  color: 'secondary.main',
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {formatMarketCap(item.market_cap)}
              </Typography>
            )}
          </Stack>
        </Box>
      </Stack>
    </Box>
  )
}

/**
 * One day card: its date header (today and tomorrow called out by name, today ringed in the
 * primary accent) and the day's reports as a single, ungrouped list — largest companies
 * first, each row carrying its own before-open / after-close marker — or a muted "No reports"
 * when the day is quiet.
 */
function DayCard({ slot, today }: { slot: DaySlot; today: string }) {
  const isToday = slot.date === today
  const relative = dayRelativeLabel(slot.date, today)
  const items = useMemo(() => [...slot.items].sort(compareItems), [slot.items])

  return (
    <Box
      sx={{
        flex: '1 1 190px',
        maxWidth: { xs: '100%', sm: 300, lg: 236 },
        minWidth: 0,
        border: 1,
        borderColor: isToday ? 'primary.main' : 'divider',
        boxShadow: isToday
          ? (theme) => `0 0 0 1px ${theme.palette.primary.main}`
          : 0,
        borderRadius: 2,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper',
      }}
    >
      <Box
        sx={{
          px: 1.5,
          py: 1,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: isToday ? 'action.selected' : 'transparent',
        }}
      >
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: 'baseline', justifyContent: 'space-between' }}
        >
          <Stack
            direction="row"
            spacing={0.75}
            sx={{ alignItems: 'baseline', minWidth: 0 }}
          >
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: isToday ? 'primary.main' : 'text.secondary',
              }}
            >
              {relative ?? slot.weekday}
            </Typography>
            <Typography sx={{ fontWeight: 700 }}>{slot.dayOfMonth}</Typography>
            <Typography variant="caption" color="text.secondary">
              {slot.monthShort}
            </Typography>
          </Stack>
          {items.length > 0 && (
            <Chip
              label={items.length}
              size="small"
              color={isToday ? 'primary' : 'default'}
              sx={{ height: 20, fontSize: '0.7rem', fontWeight: 700 }}
            />
          )}
        </Stack>
      </Box>

      <Box sx={{ p: 0.75, flex: 1 }}>
        {items.length === 0 ? (
          <Typography
            variant="caption"
            color="text.disabled"
            sx={{ display: 'block', px: 1, py: 1.5 }}
          >
            No reports
          </Typography>
        ) : (
          <Stack spacing={0.25}>
            {items.map((item) => (
              <ReportRow key={item.ticker} item={item} />
            ))}
          </Stack>
        )}
      </Box>
    </Box>
  )
}

/**
 * One week section: a heading (This week / Next week / a bare date range further out) with
 * the week's report count, then that week's forward day cards — or a single muted line when
 * the whole week is quiet, so an off-season stretch stays compact instead of a wall of empty
 * columns.
 */
function WeekSection({
  group,
  today,
  index,
}: {
  group: WeekGroup
  today: string
  index: number
}) {
  return (
    <Box
      component="section"
      sx={{
        '@keyframes weekIn': {
          from: { opacity: 0, transform: 'translateY(10px)' },
          to: { opacity: 1, transform: 'none' },
        },
        animation: `weekIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) both`,
        animationDelay: `${Math.min(index, 4) * 60}ms`,
        '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
      }}
    >
      <Stack
        direction="row"
        spacing={1.5}
        sx={{ alignItems: 'baseline', mb: 1.5, flexWrap: 'wrap', rowGap: 0.5 }}
      >
        {group.heading && (
          <Typography sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
            {group.heading}
          </Typography>
        )}
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ fontWeight: group.heading ? 400 : 700 }}
        >
          {group.rangeLabel}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Typography variant="caption" color="text.secondary">
          {group.count} {group.count === 1 ? 'report' : 'reports'}
        </Typography>
      </Stack>

      {group.count === 0 ? (
        <Box
          sx={{
            border: 1,
            borderColor: 'divider',
            borderRadius: 2,
            px: 2,
            py: 1.5,
            bgcolor: 'background.paper',
          }}
        >
          <Typography variant="body2" color="text.disabled">
            No earnings scheduled this week.
          </Typography>
        </Box>
      ) : (
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1.5,
            alignItems: 'stretch',
          }}
        >
          {group.slots.map((slot) => (
            <DayCard key={slot.date} slot={slot} today={today} />
          ))}
        </Box>
      )}
    </Box>
  )
}

/**
 * The forward week navigator: page earlier / later a fortnight at a time (earlier is disabled
 * at the current week, so the calendar never looks back), the visible date range, the window's
 * report count, and a jump back to this week.
 */
function WeekNav({
  rangeLabel,
  total,
  showCount,
  canPrev,
  canNext,
  atStart,
  onPrev,
  onNext,
  onReset,
}: {
  rangeLabel: string
  total: number
  showCount: boolean
  canPrev: boolean
  canNext: boolean
  atStart: boolean
  onPrev: () => void
  onNext: () => void
  onReset: () => void
}) {
  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{
        alignItems: 'center',
        justifyContent: 'space-between',
        mb: 2.5,
        flexWrap: 'wrap',
        rowGap: 1,
      }}
    >
      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
        <IconButton
          aria-label="Earlier weeks"
          onClick={onPrev}
          disabled={!canPrev}
          size="small"
          sx={{ border: 1, borderColor: 'divider' }}
        >
          <ChevronLeftIcon />
        </IconButton>
        <IconButton
          aria-label="Later weeks"
          onClick={onNext}
          disabled={!canNext}
          size="small"
          sx={{ border: 1, borderColor: 'divider' }}
        >
          <ChevronRightIcon />
        </IconButton>
        <Typography
          sx={{
            fontWeight: 700,
            fontSize: '1.05rem',
            ml: 1,
            whiteSpace: 'nowrap',
          }}
        >
          {rangeLabel}
        </Typography>
      </Stack>

      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        {showCount && (
          <Typography variant="body2" color="text.secondary">
            {total} {total === 1 ? 'report' : 'reports'}
          </Typography>
        )}
        <Chip
          icon={<TodayIcon />}
          label="This week"
          variant="outlined"
          size="small"
          onClick={onReset}
          disabled={atStart}
          clickable={!atStart}
        />
      </Stack>
    </Stack>
  )
}

/** Skeleton while the first read lands: two placeholder week sections. */
function LoadingState() {
  return (
    <Stack spacing={4}>
      {[0, 1].map((section) => (
        <Box key={section}>
          <Skeleton variant="text" width={220} height={32} sx={{ mb: 1.5 }} />
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton
                key={i}
                variant="rounded"
                height={200}
                sx={{ flex: '1 1 190px', maxWidth: { lg: 236 } }}
              />
            ))}
          </Box>
        </Box>
      ))}
    </Stack>
  )
}

/** Shown when the visible window carries no scheduled reports — off-season, a paged-ahead
 *  quiet stretch, or before the sweep has populated the dates. The navigator above handles
 *  moving on. */
function EmptyState() {
  return (
    <Box
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 3,
        bgcolor: 'background.paper',
        px: 3,
        py: 6,
        textAlign: 'center',
      }}
    >
      <EventBusyIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
      <Typography sx={{ fontWeight: 700, mb: 0.5 }}>
        No earnings scheduled
      </Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ maxWidth: 420, mx: 'auto' }}
      >
        Nothing is on the calendar for these weeks. Use the arrows to look
        further ahead, or check back closer to earnings season.
      </Typography>
    </Box>
  )
}

/**
 * Earnings calendar (`/earnings-calendar`): a forward-only agenda of which US companies are
 * scheduled to report earnings, starting **today** and paged forward a fortnight at a time —
 * the calendar never looks back, so a passed report drops off and the current week shows only
 * its remaining days. Each day is an ungrouped list ordered largest-company-first, with
 * before-open / after-close marked per row and large/mega-caps highlighted; every row links
 * to its stock. Best-effort — a quiet week collapses to a line, a quiet window to an empty
 * state.
 */
export default function EarningsCalendar() {
  usePageMeta(
    'Earnings Calendar — Upcoming US Earnings by Day | Nama Insights',
    'A forward calendar of upcoming US company earnings reports, grouped by week and day, biggest names first. See which S&P 500 and Nasdaq companies report next and when.',
  )

  const today = useMemo(() => todayIso(), [])
  const [offset, setOffset] = useState(0)
  const window = useMemo(
    () => forwardWindow(today, VISIBLE_WEEKS, offset),
    [today, offset],
  )

  const { data, isLoading, isError, error } = useEarningsCalendar(
    window.from,
    window.to,
  )
  const groups = useMemo(
    () => buildForwardWeeks(today, VISIBLE_WEEKS, data?.days ?? [], offset),
    [today, offset, data],
  )
  const total = data?.count ?? 0
  const atStart = offset === 0
  const rangeLabel = useMemo(() => spanLabel(window.from, window.to), [window])

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, sm: 5 } }}>
      <Box sx={{ mb: 3 }}>
        <PageHero
          eyebrowIcon={CalendarMonthIcon}
          eyebrow="Earnings calendar"
          title="Who reports next"
          subtitle="Upcoming US earnings from today onward, biggest names first — page ahead week by week to see who reports and when. Dates are estimates and can change."
        />
      </Box>

      <WeekNav
        rangeLabel={rangeLabel}
        total={total}
        showCount={!isLoading && total > 0}
        canPrev={offset > 0}
        canNext={offset < MAX_OFFSET}
        atStart={atStart}
        onPrev={() => setOffset((o) => Math.max(0, o - WEEK_STEP))}
        onNext={() => setOffset((o) => Math.min(MAX_OFFSET, o + WEEK_STEP))}
        onReset={() => setOffset(0)}
      />

      {isError ? (
        <Alert severity="error" variant="outlined">
          {errorMessage(error, 'Could not load the earnings calendar.')}
        </Alert>
      ) : isLoading && !data ? (
        <LoadingState />
      ) : total === 0 ? (
        <EmptyState />
      ) : (
        <Stack spacing={4}>
          {groups.map((group, i) => (
            <WeekSection
              key={group.monday}
              group={group}
              today={today}
              index={i}
            />
          ))}
        </Stack>
      )}

      {data?.disclaimer && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', mt: 3 }}
        >
          {data.disclaimer}
        </Typography>
      )}
    </Container>
  )
}
