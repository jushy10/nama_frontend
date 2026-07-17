import {
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
} from '@mui/material'
import BedtimeOutlinedIcon from '@mui/icons-material/BedtimeOutlined'
import WbTwilightOutlinedIcon from '@mui/icons-material/WbTwilightOutlined'
import {
  humanizeClassification,
  stockLogoUrl,
  type ExtendedHours,
  type TickerCard,
} from '@/lib/api'
import { heroWash } from '@/components/heroWash'
import { brand } from '@/theme'

// The app-bar's blue→gold ticker line, reused along the header's bottom edge so
// the detail opens on the same house accent that heads the whole app.
const BRAND_LINE = `linear-gradient(90deg, transparent 0%, ${brand.blue} 26%, ${brand.gold} 74%, transparent 100%)`

// The two extended-hours sessions, each with its at-a-glance mark. Colours match
// MarketStatusDot's phase palette (amber pre-market, blue after-hours) so the two
// reads of "where the market is" stay in sync; the moon/sunrise icons carry the
// meaning without a coloured status dot the header doesn't need.
const SESSION_META: Record<
  ExtendedHours['session'],
  { label: string; color: string; Icon: typeof WbTwilightOutlinedIcon }
> = {
  pre_market: {
    label: 'Pre-Market',
    color: '#fbbf24',
    Icon: WbTwilightOutlinedIcon,
  },
  after_hours: {
    label: 'After Hours',
    color: '#7aa5f2',
    Icon: BedtimeOutlinedIcon,
  },
}

const fmt = (n: number | null) =>
  n == null
    ? '—'
    : n.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })

// One reusable ET wall-clock, so the extended print's timestamp reads in market
// time ("4:33 PM ET") no matter the viewer's zone — the honest "as of" for a
// snapshot the card fetches once, not a live tick.
const ET_CLOCK = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hour: 'numeric',
  minute: '2-digit',
})
const etClock = (iso: string) => `${ET_CLOCK.format(new Date(iso))} ET`

/** The "Sector · Industry" summary line, skipping whichever side is absent. */
const classificationLine = (
  sector: string | null,
  industry: string | null,
): string | null => {
  const parts = [sector, industry]
    .filter(Boolean)
    .map((s) => humanizeClassification(s!))
  return parts.length ? parts.join(' · ') : null
}

/**
 * The pre-market / after-hours line under the main price: a sunrise (pre-market)
 * or moon (after-hours) mark, the session label, and the extended print with its
 * move *since the regular close* — the after-bell action shown apart from the
 * day's move on the pill above. The "As of" timestamp keeps it honest: the card
 * fetches a snapshot, it isn't a live extended-hours tick.
 */
function ExtendedHoursLine({ ext }: { ext: ExtendedHours }) {
  const { label, color, Icon } = SESSION_META[ext.session]
  const extUp = (ext.change ?? 0) >= 0
  const extSign = extUp ? '+' : ''
  return (
    <Box sx={{ mt: 1 }}>
      <Stack
        direction="row"
        spacing={0.75}
        sx={{
          alignItems: 'center',
          justifyContent: 'flex-end',
          flexWrap: 'wrap',
          rowGap: 0.25,
        }}
      >
        <Icon aria-hidden sx={{ fontSize: 16, color }} />
        <Typography
          component="span"
          sx={{
            fontSize: '0.72rem',
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'text.secondary',
          }}
        >
          {label}
        </Typography>
        <Typography
          component="span"
          sx={{
            fontSize: '0.95rem',
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          ${fmt(ext.price)}
        </Typography>
        <Box
          component="span"
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.25,
            color: extUp ? 'success.main' : 'error.main',
          }}
        >
          <Box
            component="span"
            aria-hidden
            sx={{ fontSize: '0.55rem', lineHeight: 1 }}
          >
            {extUp ? '▲' : '▼'}
          </Box>
          <Typography
            component="span"
            sx={{
              fontWeight: 600,
              fontSize: '0.82rem',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
            }}
          >
            {extSign}
            {fmt(ext.change_percent)}%
          </Typography>
        </Box>
      </Stack>
      {ext.as_of && (
        <Typography
          sx={{
            mt: 0.25,
            fontSize: '0.66rem',
            color: 'text.disabled',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          As of {etClock(ext.as_of)}
        </Typography>
      )}
    </Box>
  )
}

/**
 * The persistent identity + live-quote band that heads the stock detail and
 * stays put above the tab strip on every tab — so whichever section you're
 * reading (Fundamentals, Analysts, Options…) the ticker, name and price never
 * scroll out of mind. Lifted out of the old snapshot card, which now leads the
 * Overview tab with the key stats alone. Rides the same blue→gold hero wash as
 * the landing page so the detail opens on a recognisably "Nama" surface.
 */
export default function StockHeader({ stock }: { stock: TickerCard }) {
  // Outside the regular session the card carries an extended-hours split. When it
  // does, the primary number becomes the regular 16:00 close and its *day* move
  // (regular vs previous close), while the after-bell move shows on its own line
  // below — the two-part price a broker shows after hours, instead of the single
  // blended figure. During the regular session (ext == null) nothing changes.
  const ext = stock.extended_hours
  const price = ext ? ext.regular_price : stock.price
  const change = ext ? ext.regular_change : stock.change
  const changePercent = ext ? ext.regular_change_percent : stock.change_percent

  const up = (change ?? 0) >= 0
  const changeColor = up ? 'success.main' : 'error.main'
  const sign = up ? '+' : ''
  const classification = classificationLine(stock.sector, stock.industry)

  return (
    <Card
      variant="outlined"
      sx={{
        position: 'relative',
        overflow: 'hidden',
        borderColor: 'divider',
        backgroundImage: (theme) => heroWash(theme),
      }}
    >
      <CardContent
        sx={{
          p: { xs: 2, sm: 2.5 },
          '&:last-child': { pb: { xs: 2, sm: 2.5 } },
        }}
      >
        <Stack
          direction="row"
          spacing={{ xs: 1.5, sm: 2.5 }}
          sx={{
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            rowGap: 1.5,
          }}
        >
          <Stack
            direction="row"
            spacing={{ xs: 1.5, sm: 2 }}
            sx={{ alignItems: 'center', minWidth: 0, flex: '1 1 auto' }}
          >
            <Avatar
              variant="rounded"
              src={stockLogoUrl(stock.ticker)}
              alt={`${stock.ticker} logo`}
              slotProps={{
                img: { loading: 'lazy', style: { objectFit: 'contain' } },
              }}
              sx={{
                width: { xs: 46, sm: 58 },
                height: { xs: 46, sm: 58 },
                flexShrink: 0,
                bgcolor: '#fff',
                color: '#111',
                fontWeight: 700,
                fontSize: { xs: '1.15rem', sm: '1.5rem' },
                p: 1,
                borderRadius: '14px',
                border: '1px solid',
                borderColor: 'divider',
                boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
              }}
            >
              {stock.ticker.charAt(0)}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Stack
                direction="row"
                spacing={1}
                sx={{ alignItems: 'center', flexWrap: 'wrap' }}
              >
                <Typography
                  component="h2"
                  sx={{
                    fontWeight: 700,
                    lineHeight: 1.05,
                    fontSize: { xs: '1.5rem', sm: '2rem' },
                  }}
                >
                  {stock.ticker}
                </Typography>
                {stock.exchange && (
                  <Chip
                    label={stock.exchange}
                    size="small"
                    variant="outlined"
                    sx={{
                      height: 22,
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      color: 'text.secondary',
                      borderColor: 'divider',
                    }}
                  />
                )}
              </Stack>
              {stock.name && (
                <Typography
                  sx={{
                    mt: 0.25,
                    color: 'text.primary',
                    fontSize: { xs: '0.95rem', sm: '1.1rem' },
                    fontWeight: 500,
                    lineHeight: 1.3,
                    display: '-webkit-box',
                    WebkitBoxOrient: 'vertical',
                    WebkitLineClamp: 2,
                    overflow: 'hidden',
                  }}
                >
                  {stock.name}
                </Typography>
              )}
              {classification && (
                <Typography
                  sx={{
                    display: 'block',
                    mt: 0.5,
                    color: 'text.secondary',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    fontSize: { xs: '0.68rem', sm: '0.75rem' },
                    fontWeight: 500,
                  }}
                >
                  {classification}
                </Typography>
              )}
            </Box>
          </Stack>
          <Box sx={{ textAlign: 'right', flexShrink: 0, ml: 'auto' }}>
            <Typography
              sx={{
                fontWeight: 700,
                fontSize: { xs: '1.75rem', sm: '2.25rem' },
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1.05,
                letterSpacing: '-0.01em',
              }}
            >
              ${fmt(price)}
            </Typography>
            {/* the day's move as a tinted pill, so direction reads at a glance.
                In extended hours this is the *regular*-session move (close vs the
                prior close); the after-bell move rides the line below. */}
            <Box
              sx={{
                mt: 0.75,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                px: 1.25,
                py: 0.5,
                borderRadius: 999,
                color: changeColor,
                bgcolor: up
                  ? 'rgba(52,211,153,0.14)'
                  : 'rgba(248,113,113,0.14)',
              }}
            >
              <Box
                component="span"
                aria-hidden
                sx={{ fontSize: '0.6rem', lineHeight: 1 }}
              >
                {up ? '▲' : '▼'}
              </Box>
              <Typography
                component="span"
                sx={{
                  fontWeight: 600,
                  fontSize: { xs: '0.82rem', sm: '0.9rem' },
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1,
                }}
              >
                {sign}
                {fmt(change)} ({sign}
                {fmt(changePercent)}%)
              </Typography>
            </Box>
            {ext && <ExtendedHoursLine ext={ext} />}
          </Box>
        </Stack>
      </CardContent>
      {/* House blue→gold accent along the bottom edge, echoing the app bar's
          ticker line so the detail reads as the same surface family. */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 2,
          background: BRAND_LINE,
        }}
      />
    </Card>
  )
}
