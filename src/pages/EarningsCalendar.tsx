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
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import TodayIcon from '@mui/icons-material/Today'
import WbTwilightIcon from '@mui/icons-material/WbTwilight'
import NightsStayIcon from '@mui/icons-material/NightsStay'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import ScheduleIcon from '@mui/icons-material/Schedule'
import { Link as RouterLink } from 'react-router-dom'
import { humanizeClassification, stockLogoUrl } from '@/lib/api'
import { errorMessage, useEarningsCalendar } from '@/lib/queries'
import {
  addDays,
  buildWeek,
  mondayOf,
  todayIso,
  weekRangeLabel,
  type DaySlot,
} from '@/lib/earningsWeek'
import { usePageMeta } from '@/lib/usePageMeta'
import type { EarningsCalendarItem } from '@/lib/api'
import PageHero from '@/components/PageHero'

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

/** One weekday column: its date header (today highlighted) and the day's reports. */
function DayColumn({ slot, isToday }: { slot: DaySlot; isToday: boolean }) {
  return (
    <Box
      sx={{
        border: 1,
        borderColor: isToday ? 'primary.main' : 'divider',
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
          <Stack direction="row" spacing={0.75} sx={{ alignItems: 'baseline' }}>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: isToday ? 'primary.main' : 'text.secondary',
              }}
            >
              {slot.weekday}
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

/** The five day columns laid out as a week — a grid on desktop, stacked on phones. */
function WeekGrid({ slots, today }: { slots: DaySlot[]; today: string }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          sm: 'repeat(2, 1fr)',
          lg: 'repeat(5, 1fr)',
        },
        gap: 1.5,
        alignItems: 'stretch',
      }}
    >
      {slots.map((slot) => (
        <DayColumn key={slot.date} slot={slot} isToday={slot.date === today} />
      ))}
    </Box>
  )
}

/** Skeleton week while the first read lands. */
function LoadingGrid() {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          sm: 'repeat(2, 1fr)',
          lg: 'repeat(5, 1fr)',
        },
        gap: 1.5,
      }}
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <Skeleton key={i} variant="rounded" height={220} />
      ))}
    </Box>
  )
}

/**
 * Earnings calendar (`/earnings-calendar`): a Monday–Friday agenda of which US
 * companies are scheduled to report earnings each day, pulled from the scheduled
 * dates the app already tracks across the ≥$1B universe. Navigate week to week;
 * each company links to its stock page. Best-effort — a quiet day (or a whole
 * quiet week) simply shows "No reports".
 */
export default function EarningsCalendar() {
  usePageMeta(
    'Earnings Calendar — Upcoming US Earnings by Day | Nama Insights',
    'A weekly calendar of upcoming US company earnings reports, grouped by day. See which S&P 500 and Nasdaq companies report and when.',
  )

  const thisMonday = useMemo(() => mondayOf(todayIso()), [])
  const [monday, setMonday] = useState(thisMonday)
  const friday = addDays(monday, 4)
  const today = todayIso()

  const { data, isLoading, isError, error } = useEarningsCalendar(
    monday,
    friday,
  )
  const slots = useMemo(
    () => buildWeek(monday, data?.days ?? []),
    [monday, data],
  )
  const total = data?.count ?? 0

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 3, sm: 5 } }}>
      <Box sx={{ mb: 3 }}>
        <PageHero
          eyebrowIcon={CalendarMonthIcon}
          eyebrow="Earnings calendar"
          title="Who reports this week"
          subtitle="The US companies scheduled to report earnings this week, split into before the open and after the close each day. Dates are estimates and can change."
        />
      </Box>

      {/* Week navigator: the range, prev/next, and a jump back to this week. */}
      <Stack
        direction="row"
        spacing={1}
        sx={{
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2,
          flexWrap: 'wrap',
          rowGap: 1,
        }}
      >
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
          <IconButton
            aria-label="Previous week"
            onClick={() => setMonday((m) => addDays(m, -7))}
            size="small"
            sx={{ border: 1, borderColor: 'divider' }}
          >
            <ChevronLeftIcon />
          </IconButton>
          <IconButton
            aria-label="Next week"
            onClick={() => setMonday((m) => addDays(m, 7))}
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
            {weekRangeLabel(monday)}
          </Typography>
        </Stack>

        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          {!isLoading && (
            <Typography variant="body2" color="text.secondary">
              {total} {total === 1 ? 'report' : 'reports'}
            </Typography>
          )}
          <Chip
            icon={<TodayIcon />}
            label="This week"
            variant="outlined"
            size="small"
            onClick={() => setMonday(thisMonday)}
            disabled={monday === thisMonday}
            clickable={monday !== thisMonday}
          />
        </Stack>
      </Stack>

      {isError ? (
        <Alert severity="error" variant="outlined">
          {errorMessage(error, 'Could not load the earnings calendar.')}
        </Alert>
      ) : isLoading && !data ? (
        <LoadingGrid />
      ) : (
        <WeekGrid slots={slots} today={today} />
      )}

      {data?.disclaimer && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', mt: 2 }}
        >
          {data.disclaimer}
        </Typography>
      )}
    </Container>
  )
}
