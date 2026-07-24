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
import WbTwilightIcon from '@mui/icons-material/WbTwilight'
import NightsStayIcon from '@mui/icons-material/NightsStay'
import ScheduleIcon from '@mui/icons-material/Schedule'
import { Link as RouterLink } from 'react-router-dom'
import { humanizeClassification, stockLogoUrl } from '@/lib/api'
import { errorMessage, useEarningsCalendar } from '@/hooks/queries'
import {
  buildForwardWeeks,
  dayRelativeLabel,
  forwardWindow,
  spanLabel,
  todayIso,
  type DaySlot,
  type WeekGroup,
} from '@/lib/earningsWeek'
import { usePageMeta } from '@/hooks/usePageMeta'
import type { EarningsCalendarItem } from '@/lib/api'
import PageHero from '@/components/PageHero'

// The view shows one week and pages a week at a time. `offset` counts weeks past the first
// forward week; it never goes below 0 (so the calendar can't page into the past) and is capped
// at roughly three months out, which keeps the furthest read inside the backend's 92-day clamp.
const VISIBLE_WEEKS = 1
const WEEK_STEP = 1
const MAX_OFFSET = 12

// Large-cap and above is the single "important name" threshold: those rows get the gold rule,
// the tint and their market-cap label; everything below reads as plain text. The cap is in the
// listing's own currency, which is plenty precise for a visual cue.
const NOTABLE_CAP = 10e9 // $10B

/** Whether a report is one of the names worth calling out — large-cap or bigger. A missing
 *  `market_cap` (an older backend, or a listing we have no cap for) reads as not notable. */
function isNotable(marketCap?: number | null): boolean {
  return marketCap != null && marketCap >= NOTABLE_CAP
}

/** A compact market-cap label, e.g. `$3.1T`, `$45B`, `$920M`. */
function formatMarketCap(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(n >= 1e13 ? 0 : 1)}T`
  if (n >= 1e9) return `$${(n / 1e9).toFixed(n >= 1e11 ? 0 : 1)}B`
  if (n >= 1e6) return `$${Math.round(n / 1e6)}M`
  return `$${Math.round(n)}`
}

/** Biggest company first, unknown caps last, ties broken alphabetically. */
function compareItems(
  a: EarningsCalendarItem,
  b: EarningsCalendarItem,
): number {
  return (
    (b.market_cap ?? -1) - (a.market_cap ?? -1) ||
    a.ticker.localeCompare(b.ticker)
  )
}

/** A day's reports split into the two parts the page is organised around, plus the leftovers.
 *  `rest` holds anything the backend didn't mark as before-open or after-close (a mid-session
 *  report, or an absent `session` from a stale backend) so no report is silently dropped. */
interface DayParts {
  bmo: EarningsCalendarItem[]
  amc: EarningsCalendarItem[]
  rest: EarningsCalendarItem[]
}

function splitSessions(items: EarningsCalendarItem[]): DayParts {
  const parts: DayParts = { bmo: [], amc: [], rest: [] }
  for (const item of items) {
    if (item.session === 'bmo') parts.bmo.push(item)
    else if (item.session === 'amc') parts.amc.push(item)
    else parts.rest.push(item)
  }
  parts.bmo.sort(compareItems)
  parts.amc.sort(compareItems)
  parts.rest.sort(compareItems)
  return parts
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
 * One company row: the logo, ticker over company name, and sector. A large-cap-or-bigger name
 * is highlighted with a gold left rule, a tint and its market-cap label, so the reports worth
 * noticing carry the only ornament on the page. Reporting time is the part header above the
 * row, not a per-row marker. The whole row links to the stock.
 */
function ReportRow({ item }: { item: EarningsCalendarItem }) {
  const notable = isNotable(item.market_cap)

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
        <StockLogo symbol={item.ticker} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: 'baseline', justifyContent: 'space-between' }}
          >
            <Typography sx={{ fontWeight: 700, lineHeight: 1.2 }} noWrap>
              {item.ticker}
            </Typography>
            {notable && item.market_cap != null && (
              <Typography
                variant="caption"
                sx={{ color: 'secondary.main', fontWeight: 700, flexShrink: 0 }}
              >
                {formatMarketCap(item.market_cap)}
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
            {item.sector && (
              <Typography
                variant="caption"
                color="text.disabled"
                noWrap
                sx={{ flexShrink: 1, minWidth: 0, textAlign: 'right' }}
              >
                {humanizeClassification(item.sector)}
              </Typography>
            )}
          </Stack>
        </Box>
      </Stack>
    </Box>
  )
}

interface SessionMeta {
  label: string
  Icon: ComponentType<SvgIconProps>
  /** The icon's tint. On brand: a gold sunrise for before open, a navy moon for after close,
   *  the app's two accents doubling as a time-of-day cue. */
  color: string
}

const BEFORE_OPEN: SessionMeta = {
  label: 'Before open',
  Icon: WbTwilightIcon,
  color: 'secondary.main',
}
const AFTER_CLOSE: SessionMeta = {
  label: 'After close',
  Icon: NightsStayIcon,
  color: 'primary.main',
}
const TIME_NOT_SET: SessionMeta = {
  label: 'Time not set',
  Icon: ScheduleIcon,
  color: 'text.disabled',
}

/**
 * One reporting-time part of a day: a header pairing the session's icon with its name, then
 * its rows biggest company first. Renders nothing when the session is empty, so a day that
 * only reports after the close shows one part rather than an empty pair.
 */
function SessionPart({
  session,
  items,
}: {
  session: SessionMeta
  items: EarningsCalendarItem[]
}) {
  const { label, Icon, color } = session
  if (items.length === 0) return null
  return (
    <Box component="section">
      <Stack
        direction="row"
        spacing={0.5}
        sx={{ alignItems: 'center', px: 1, pb: 0.5 }}
      >
        <Icon aria-hidden sx={{ fontSize: 14, color, flexShrink: 0 }} />
        <Typography
          variant="caption"
          sx={{
            fontSize: '0.65rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'text.secondary',
          }}
        >
          {label}
        </Typography>
      </Stack>
      <Stack spacing={0.25}>
        {items.map((item) => (
          <ReportRow key={item.ticker} item={item} />
        ))}
      </Stack>
    </Box>
  )
}

/**
 * One day column: its date header (today and tomorrow called out by name, today ringed in the
 * primary accent) and the day's reports split into a before-open part and an after-close part,
 * each biggest company first. Anything the backend leaves unscheduled trails in a third,
 * muted part. A quiet day reads as a single "No reports" line.
 */
function DayCard({ slot, today }: { slot: DaySlot; today: string }) {
  const isToday = slot.date === today
  const relative = dayRelativeLabel(slot.date, today)
  const parts = useMemo(() => splitSessions(slot.items), [slot.items])

  return (
    <Box
      sx={{
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
          {slot.items.length > 0 && (
            <Chip
              label={slot.items.length}
              size="small"
              color={isToday ? 'primary' : 'default'}
              sx={{ height: 20, fontSize: '0.7rem', fontWeight: 700 }}
            />
          )}
        </Stack>
      </Box>

      <Box sx={{ p: 0.75, flex: 1 }}>
        {slot.items.length === 0 ? (
          <Typography
            variant="caption"
            color="text.disabled"
            sx={{ display: 'block', px: 1, py: 1.5 }}
          >
            No reports
          </Typography>
        ) : (
          <Stack spacing={1.5}>
            <SessionPart session={BEFORE_OPEN} items={parts.bmo} />
            <SessionPart session={AFTER_CLOSE} items={parts.amc} />
            <SessionPart session={TIME_NOT_SET} items={parts.rest} />
          </Stack>
        )}
      </Box>
    </Box>
  )
}

/**
 * The shown week's forward days, one column each across the full width — or a single muted
 * line when the week is quiet. The week is named and counted by the navigator above, so this
 * carries no header of its own. Keyed on the week's Monday by the caller, so paging remounts
 * it and replays the fade: the feedback that the click landed on a new week.
 */
function WeekSection({ group, today }: { group: WeekGroup; today: string }) {
  return (
    <Box
      component="section"
      sx={{
        '@keyframes weekIn': {
          from: { opacity: 0, transform: 'translateY(10px)' },
          to: { opacity: 1, transform: 'none' },
        },
        animation: `weekIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both`,
        '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
      }}
    >
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
        // One column per shown weekday at desktop, so the week spans the full page width. A
        // partial current week (say a lone Friday) gets that many columns, never five.
        <Box
          sx={{
            display: 'grid',
            gap: 1.5,
            alignItems: 'stretch',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, minmax(0, 1fr))',
              md: 'repeat(3, minmax(0, 1fr))',
              lg: `repeat(${group.slots.length}, minmax(0, 1fr))`,
            },
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
 * The forward week navigator, which doubles as the shown week's header: page earlier / later a
 * week at a time (earlier is disabled at the current week, so the calendar never looks back),
 * the week's name and date range, its report count, and a jump back to today's week. `heading`
 * is `This week` / `Next week` / `''` further out, and is absent until the first read lands.
 */
function WeekNav({
  heading,
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
  heading?: string
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
          aria-label="Previous week"
          onClick={onPrev}
          disabled={!canPrev}
          size="small"
          sx={{ border: 1, borderColor: 'divider' }}
        >
          <ChevronLeftIcon />
        </IconButton>
        <IconButton
          aria-label="Next week"
          onClick={onNext}
          disabled={!canNext}
          size="small"
          sx={{ border: 1, borderColor: 'divider' }}
        >
          <ChevronRightIcon />
        </IconButton>
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: 'baseline', ml: 1, flexWrap: 'wrap', rowGap: 0.25 }}
        >
          {heading && (
            <Typography
              component="h2"
              sx={{ fontWeight: 700, fontSize: '1.05rem', m: 0 }}
            >
              {heading}
            </Typography>
          )}
          <Typography
            color={heading ? 'text.secondary' : undefined}
            sx={{
              fontWeight: heading ? 400 : 700,
              fontSize: '1.05rem',
              whiteSpace: 'nowrap',
            }}
          >
            {rangeLabel}
          </Typography>
        </Stack>
      </Stack>

      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        {showCount && (
          <Typography variant="body2" color="text.secondary">
            {total} {total === 1 ? 'report' : 'reports'}
          </Typography>
        )}
        <Chip
          icon={<TodayIcon />}
          label="Today"
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

/** Skeleton while the first read lands: the week's five day columns on the same grid the real
 *  week uses, so nothing shifts when the data arrives. */
function LoadingState() {
  return (
    <Box
      sx={{
        display: 'grid',
        gap: 1.5,
        gridTemplateColumns: {
          xs: '1fr',
          sm: 'repeat(2, minmax(0, 1fr))',
          md: 'repeat(3, minmax(0, 1fr))',
          lg: 'repeat(5, minmax(0, 1fr))',
        },
      }}
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <Skeleton key={i} variant="rounded" height={320} />
      ))}
    </Box>
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
 * scheduled to report earnings, starting **today** and paged forward one week at a time —
 * the calendar never looks back, so a passed report drops off and the current week shows only
 * its remaining days. The week spans the page as one column per day, and each day splits into
 * a before-open and an after-close part with the biggest companies first; large-cap and bigger
 * names carry the only highlight. Every row links to its stock. Best-effort — a quiet week
 * collapses to a line, a quiet window to an empty state.
 */
export default function EarningsCalendar() {
  usePageMeta(
    'Earnings Calendar — Upcoming US Earnings by Day | Nama Insights',
    'A forward calendar of upcoming US company earnings reports, grouped by week and day, split into before-open and after-close. See which S&P 500 and Nasdaq companies report next and when.',
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
  // The shown week's own span once it's built (which starts at today's date, or at the Monday
  // on a paged-ahead week), falling back to the fetch window while the first read is in flight.
  // The two differ over a weekend, when the fetch opens on today but the week shown is the next
  // one — the navigator is the week's only header, so it has to name the days actually on screen.
  const fetchedLabel = useMemo(
    () => spanLabel(window.from, window.to),
    [window],
  )
  const rangeLabel = groups[0]?.rangeLabel ?? fetchedLabel

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 3, sm: 5 } }}>
      <Box sx={{ mb: 3 }}>
        <PageHero
          eyebrowIcon={CalendarMonthIcon}
          eyebrow="Earnings calendar"
          title="Who reports next"
          subtitle="Upcoming US earnings from today onward, split into before the open and after the close, with the largest companies leading each day. Dates are estimates and can change."
        />
      </Box>

      <WeekNav
        heading={groups[0]?.heading}
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
          {groups.map((group) => (
            <WeekSection key={group.monday} group={group} today={today} />
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
