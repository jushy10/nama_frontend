import { useMemo, useState } from 'react'
import type { ComponentType } from 'react'
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Container,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material'
import type { SvgIconProps } from '@mui/material'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import EventBusyIcon from '@mui/icons-material/EventBusy'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
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
  todayIso,
  type DaySlot,
  type WeekGroup,
} from '@/lib/earningsWeek'
import { usePageMeta } from '@/lib/usePageMeta'
import type { EarningsCalendarItem } from '@/lib/api'
import PageHero from '@/components/PageHero'

// The forward view opens on two weeks (today's remaining days + next week — the API's
// own default look-ahead), and "Show more" extends it a fortnight at a time up to a
// six-week ceiling that stays well inside the backend's 92-day window clamp.
const INITIAL_WEEKS = 2
const WEEK_STEP = 2
const MAX_WEEKS = 6

interface SessionMeta {
  key: string
  label: string
  Icon: ComponentType<SvgIconProps>
  color: string
}

/**
 * How each reporting session reads at a glance, and the order the day's reports are
 * grouped in — chronologically through the trading day: before open, intraday, after
 * close, then time-not-set. On brand: a gold sunrise for before-open (morning), a navy
 * moon for after-close (night) — the app's two accent colours doubling as a time-of-day
 * cue. `during` is the rare intraday case; `unknown` (or a stale backend that omits
 * `session`) collects under a muted "Time TBD".
 */
const SESSION_GROUPS: readonly SessionMeta[] = [
  {
    key: 'bmo',
    label: 'Before open',
    Icon: WbTwilightIcon,
    color: 'secondary.main',
  },
  {
    key: 'during',
    label: 'During hours',
    Icon: WbSunnyIcon,
    color: 'text.secondary',
  },
  {
    key: 'amc',
    label: 'After close',
    Icon: NightsStayIcon,
    color: 'primary.main',
  },
  {
    key: 'unknown',
    label: 'Time TBD',
    Icon: ScheduleIcon,
    color: 'text.disabled',
  },
]

const SESSION_BY_KEY: Record<string, SessionMeta> = Object.fromEntries(
  SESSION_GROUPS.map((g) => [g.key, g]),
)

/** The session an item belongs to for grouping — anything unrecognized (or an absent
 *  session from a stale backend) falls into `unknown` so no report is ever dropped. */
function sessionKey(item: EarningsCalendarItem): string {
  return item.session && SESSION_BY_KEY[item.session] ? item.session : 'unknown'
}

/** Split a day's reports into the session groups that actually have reports, in
 *  chronological session order (before open → after close → time TBD). */
function groupBySession(
  items: EarningsCalendarItem[],
): { meta: SessionMeta; items: EarningsCalendarItem[] }[] {
  return SESSION_GROUPS.map((meta) => ({
    meta,
    items: items.filter((it) => sessionKey(it) === meta.key),
  })).filter((g) => g.items.length > 0)
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

/** The header for one session group within a day: its icon, label, and how many report. */
function SessionHeader({ meta, count }: { meta: SessionMeta; count: number }) {
  const { label, Icon, color } = meta
  return (
    <Stack
      direction="row"
      spacing={0.75}
      sx={{ alignItems: 'center', px: 1, py: 0.5 }}
    >
      <Icon sx={{ fontSize: 15, color }} />
      <Typography
        variant="caption"
        sx={{
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'text.secondary',
        }}
      >
        {label}
      </Typography>
      <Typography variant="caption" color="text.disabled">
        {count}
      </Typography>
    </Stack>
  )
}

/** One company row: logo, ticker over its company name, sector as a right-aligned
 *  caption — the whole row links to the stock. */
function ReportRow({ item }: { item: EarningsCalendarItem }) {
  return (
    <Box
      component={RouterLink}
      to={`/search?symbol=${encodeURIComponent(item.ticker)}`}
      sx={{
        display: 'block',
        textDecoration: 'none',
        color: 'inherit',
        borderRadius: 1.5,
        px: 1,
        py: 0.75,
        transition: 'background-color 120ms ease',
        '&:hover': { bgcolor: 'action.hover' },
        '&:focus-visible': {
          outline: 2,
          outlineColor: 'primary.main',
          outlineOffset: -2,
        },
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
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
          {item.name && (
            <Typography
              variant="caption"
              color="text.secondary"
              noWrap
              sx={{ display: 'block' }}
            >
              {item.name}
            </Typography>
          )}
        </Box>
      </Stack>
    </Box>
  )
}

/**
 * One day card: its date header (today and tomorrow called out by name, today ringed in
 * the primary accent) and the day's reports grouped by session, or a muted "No reports"
 * when the day is quiet.
 */
function DayCard({ slot, today }: { slot: DaySlot; today: string }) {
  const isToday = slot.date === today
  const relative = dayRelativeLabel(slot.date, today)

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
          <Stack spacing={1}>
            {groupBySession(slot.items).map((group) => (
              <Box key={group.meta.key}>
                <SessionHeader meta={group.meta} count={group.items.length} />
                <Stack spacing={0.25}>
                  {group.items.map((item) => (
                    <ReportRow key={item.ticker} item={item} />
                  ))}
                </Stack>
              </Box>
            ))}
          </Stack>
        )}
      </Box>
    </Box>
  )
}

/**
 * One week section: a heading (This week / Next week / a bare date range further out)
 * with the week's report count, then that week's forward day cards — or a single muted
 * line when the whole week is quiet, so an off-season stretch stays compact instead of a
 * wall of empty columns.
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

/** Shown when the whole forward window carries no scheduled reports — off-season, or
 *  before the sweep has populated the dates. */
function EmptyState({
  weeks,
  onExtend,
  canExtend,
}: {
  weeks: number
  onExtend: () => void
  canExtend: boolean
}) {
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
        sx={{ maxWidth: 420, mx: 'auto', mb: canExtend ? 2.5 : 0 }}
      >
        Nothing is on the calendar for the next {weeks} weeks. This is normal
        between earnings seasons — check back closer to the next one.
      </Typography>
      {canExtend && (
        <Button
          variant="outlined"
          size="small"
          endIcon={<ExpandMoreIcon />}
          onClick={onExtend}
        >
          Look further ahead
        </Button>
      )}
    </Box>
  )
}

/**
 * Earnings calendar (`/earnings-calendar`): a forward-only agenda of which US companies
 * are scheduled to report earnings, starting **today** and running week by week — the
 * calendar never looks back, so a passed report drops off and the current week shows only
 * its remaining days. Companies are grouped per day into before-open / after-close
 * sessions, each linking to its stock page; "Show more" extends the horizon. Best-effort —
 * a quiet week collapses to a single line, a fully quiet window to an empty state.
 */
export default function EarningsCalendar() {
  usePageMeta(
    'Earnings Calendar — Upcoming US Earnings by Day | Nama Insights',
    'A forward calendar of upcoming US company earnings reports, grouped by week and day. See which S&P 500 and Nasdaq companies report next and when.',
  )

  const today = useMemo(() => todayIso(), [])
  const [weeks, setWeeks] = useState(INITIAL_WEEKS)
  const window = useMemo(() => forwardWindow(today, weeks), [today, weeks])

  const { data, isLoading, isFetching, isError, error } = useEarningsCalendar(
    window.from,
    window.to,
  )
  const groups = useMemo(
    () => buildForwardWeeks(today, weeks, data?.days ?? []),
    [today, weeks, data],
  )
  const total = data?.count ?? 0
  const canExtend = weeks < MAX_WEEKS
  const extend = () => setWeeks((w) => Math.min(MAX_WEEKS, w + WEEK_STEP))

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, sm: 5 } }}>
      <Box sx={{ mb: 3 }}>
        <PageHero
          eyebrowIcon={CalendarMonthIcon}
          eyebrow="Earnings calendar"
          title="Who reports next"
          subtitle="The US companies scheduled to report earnings from today onward, grouped by week and split into before the open and after the close each day. Dates are estimates and can change."
        />
      </Box>

      {!isLoading && total > 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
          {total} upcoming {total === 1 ? 'report' : 'reports'}
        </Typography>
      )}

      {isError ? (
        <Alert severity="error" variant="outlined">
          {errorMessage(error, 'Could not load the earnings calendar.')}
        </Alert>
      ) : isLoading && !data ? (
        <LoadingState />
      ) : total === 0 ? (
        <EmptyState weeks={weeks} onExtend={extend} canExtend={canExtend} />
      ) : (
        <>
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

          {canExtend && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <Button
                variant="outlined"
                endIcon={<ExpandMoreIcon />}
                onClick={extend}
                disabled={isFetching}
              >
                Show more weeks
              </Button>
            </Box>
          )}
        </>
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
