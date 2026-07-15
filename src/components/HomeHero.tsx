import { Link as RouterLink } from 'react-router-dom'
import { Box, Button, Container, Stack, Typography } from '@mui/material'
import type { SvgIconComponent } from '@mui/icons-material'
import ShowChartIcon from '@mui/icons-material/ShowChart'
import UpdateIcon from '@mui/icons-material/Update'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import LockOpenIcon from '@mui/icons-material/LockOpen'
import TableRowsIcon from '@mui/icons-material/TableRows'
import BoltIcon from '@mui/icons-material/Bolt'
import { heroWash } from '@/components/heroWash'
import HomeSearchBar from '@/components/HomeSearchBar'
import MarketStatusDot from '@/components/MarketStatusDot'
import { getMarketStatus, marketLabel } from '@/lib/market'

/** Today, compact (e.g. "Jul 10") for the live market-status pill. */
function todayLabel(now: Date): string {
  return now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** Coverage markers under the search bar — what the engine spans, each a quiet
 *  icon + label rather than a run of middle-dots. */
const MARKERS: { icon: SvgIconComponent; label: string }[] = [
  { icon: ShowChartIcon, label: '1,000+ US stocks & ETFs' },
  { icon: UpdateIcon, label: 'Refreshed daily' },
  { icon: AutoAwesomeIcon, label: 'Powered by Claude' },
  { icon: LockOpenIcon, label: 'No login, no paywall' },
]

/**
 * Home-page hero: the app's front door, built around its one job — search a
 * name, get an AI read. A live market-status pill, a confident two-tone
 * headline, one line of value, and the universe search itself as the primary
 * action; four quiet coverage markers and two secondary routes sit beneath. The
 * blue→gold wash (shared with the stock-detail hero cards) plus a soft radial
 * lift gives the band depth without competing with the copy. Everything stacks
 * and scales on phones.
 */
export default function HomeHero() {
  const now = new Date()
  const phase = getMarketStatus(now).phase

  return (
    <Box
      component="section"
      sx={{
        position: 'relative',
        overflow: 'hidden',
        background: (theme) => heroWash(theme),
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      {/* Soft radial lift at top-left — depth behind the copy, faded out before
          it reaches the text so nothing competes with it. */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: (theme) =>
            theme.palette.mode === 'dark'
              ? 'radial-gradient(60% 80% at 8% -10%, rgba(79,131,230,0.16), transparent 70%)'
              : 'radial-gradient(60% 80% at 8% -10%, rgba(79,131,230,0.10), transparent 70%)',
        }}
      />

      <Container
        maxWidth="xl"
        sx={{ position: 'relative', py: { xs: 6, sm: 9, md: 11 } }}
      >
        <Stack spacing={{ xs: 3, sm: 3.5 }} sx={{ maxWidth: 780 }}>
          {/* Live market-status pill — a real signal, not decoration. */}
          <Box
            sx={{
              alignSelf: 'flex-start',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              pl: 1.25,
              pr: 1.75,
              py: 0.6,
              borderRadius: 999,
              border: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper',
            }}
          >
            <MarketStatusDot phase={phase} />
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                letterSpacing: '0.03em',
                color: 'text.primary',
              }}
            >
              {marketLabel(now)} · {todayLabel(now)}
            </Typography>
          </Box>

          {/* Headline — confident, on a fluid scale, with the accent in solid
              brand blue. */}
          <Typography
            variant="h1"
            component="h1"
            sx={{
              fontWeight: 800,
              letterSpacing: '-0.03em',
              lineHeight: 1.03,
              fontSize: 'clamp(2.5rem, 6vw, 4.25rem)',
              textWrap: 'balance',
            }}
          >
            The stock screener,{' '}
            <Box
              component="span"
              sx={{ color: 'primary.main', whiteSpace: 'nowrap' }}
            >
              driven by AI
            </Box>
          </Typography>

          {/* One line of value. */}
          <Typography
            sx={{
              color: 'text.secondary',
              fontSize: { xs: '1.05rem', sm: '1.2rem' },
              lineHeight: 1.6,
              maxWidth: 600,
              textWrap: 'pretty',
            }}
          >
            Screen 1,000+ US stocks and ETFs, then let AI read any one in plain
            English — fundamentals, earnings, analyst coverage and options, in
            seconds.
          </Typography>

          {/* Primary action: the universe search itself. */}
          <Box sx={{ width: '100%' }}>
            <HomeSearchBar />
          </Box>

          {/* Coverage markers — quiet proof of what the engine spans. */}
          <Stack
            direction="row"
            useFlexGap
            sx={{ flexWrap: 'wrap', columnGap: 2.5, rowGap: 1 }}
          >
            {MARKERS.map(({ icon: Icon, label }) => (
              <Stack
                key={label}
                direction="row"
                spacing={0.75}
                sx={{ alignItems: 'center' }}
              >
                <Icon sx={{ fontSize: 17, color: 'primary.main' }} />
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.secondary',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                  }}
                >
                  {label}
                </Typography>
              </Stack>
            ))}
          </Stack>

          {/* Secondary routes into the product — one primary-weighted, one quiet,
              so the hierarchy under the search is clear. */}
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={{ xs: 1, sm: 1.5 }}
            sx={{ pt: 0.5, width: { xs: '100%', sm: 'auto' } }}
          >
            <Button
              component={RouterLink}
              to="/screener"
              variant="outlined"
              size="large"
              startIcon={<TableRowsIcon />}
              sx={{
                borderColor: 'primary.main',
                color: 'primary.main',
                '&:hover': {
                  borderColor: 'primary.main',
                  bgcolor: 'action.hover',
                },
              }}
            >
              Open the Screener
            </Button>
            <Button
              component={RouterLink}
              to="/heatmap"
              variant="text"
              size="large"
              startIcon={<BoltIcon />}
              sx={{ color: 'text.primary' }}
            >
              Market heat map
            </Button>
          </Stack>
        </Stack>
      </Container>
    </Box>
  )
}
