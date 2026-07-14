import { useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Chip,
  Container,
  IconButton,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import TodayIcon from '@mui/icons-material/Today'
import { Link as RouterLink } from 'react-router-dom'
import { humanizeClassification } from '@/lib/api'
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

/** One company row: ticker + name, its sector as a caption, linking to the stock. */
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
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: 'baseline', justifyContent: 'space-between' }}
      >
        <Typography sx={{ fontWeight: 700, lineHeight: 1.2 }}>
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
          <Stack spacing={0.25}>
            {slot.items.map((item) => (
              <ReportRow key={item.ticker} item={item} />
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
    <Container maxWidth="xl" sx={{ py: { xs: 4, sm: 6 } }}>
      <Box sx={{ mb: 3 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <CalendarMonthIcon sx={{ color: 'primary.main' }} />
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
            Earnings calendar
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Which US companies are scheduled to report earnings this week —
          grouped by day, newest scheduling first. Dates are estimates and can
          change.
        </Typography>
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
