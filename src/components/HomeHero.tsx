import { Link as RouterLink } from 'react-router-dom'
import { Box, Button, Container, Stack, Typography } from '@mui/material'
import type { SvgIconComponent } from '@mui/icons-material'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import TableRowsIcon from '@mui/icons-material/TableRows'
import BoltIcon from '@mui/icons-material/Bolt'
import ShowChartIcon from '@mui/icons-material/ShowChart'
import UpdateIcon from '@mui/icons-material/Update'
import LockOpenIcon from '@mui/icons-material/LockOpen'
import { heroWash } from '@/components/heroWash'
import { fontFamilyMono } from '@/theme'
import HomeSearchBar from '@/components/HomeSearchBar'
import MarketSnapshot from '@/components/MarketSnapshot'
import MarketStatusDot from '@/components/MarketStatusDot'
import { getMarketStatus, marketLabel } from '@/lib/market'

/** Today, compact (e.g. "Tue, Jul 10") for the mono market-status line. */
function todayLabel(now: Date): string {
  return now.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

/** The coverage markers under the search bar — what the engine spans and that
 *  it's free, each a quiet tag rather than a run of middle-dots. "Powered by
 *  Claude" lives here, so it isn't repeated in a separate badge above. */
const MARKERS: { icon: SvgIconComponent; label: string }[] = [
  { icon: ShowChartIcon, label: '1,000+ US stocks & ETFs' },
  { icon: UpdateIcon, label: 'Refreshed daily' },
  { icon: AutoAwesomeIcon, label: 'Powered by Claude' },
  { icon: LockOpenIcon, label: 'No login, no paywall' },
]

/**
 * Home-page hero, redesigned as a split: the pitch and the universe search on
 * the left, a live "market at a glance" snapshot on the right — so a visitor
 * sees how the market is doing *and* can look up any name without scrolling. The
 * left column keeps the search-first identity (a live market-status ticker line,
 * a two-tone headline, one tight line of copy, the search itself as the primary
 * action, two jumps into the screener/heat map, and quiet coverage tags); the
 * right column carries {@link MarketSnapshot}. On phones the two columns stack,
 * search above the snapshot. The soft brand wash + masked grid give the band
 * depth; the left stack eases in on load (reduced-motion safe).
 */
export default function HomeHero() {
  const now = new Date()
  const phase = getMarketStatus(now).phase

  return (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        // The soft blue→gold wash, shared with the stock-detail hero cards.
        background: (theme) => heroWash(theme),
      }}
    >
      {/* A faint grid, masked to fade out toward the edges — texture behind the
          copy without competing with it. */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          backgroundImage: (theme) =>
            `linear-gradient(${theme.palette.divider} 1px, transparent 1px), linear-gradient(90deg, ${theme.palette.divider} 1px, transparent 1px)`,
          backgroundSize: '44px 44px',
          maskImage:
            'radial-gradient(circle at 30% 0%, rgba(0,0,0,0.5), transparent 70%)',
          WebkitMaskImage:
            'radial-gradient(circle at 30% 0%, rgba(0,0,0,0.5), transparent 70%)',
        }}
      />

      <Container
        maxWidth="xl"
        sx={{ position: 'relative', py: { xs: 5, sm: 6, md: 8 } }}
      >
        <Box
          sx={{
            display: 'grid',
            gap: { xs: 4, md: 6 },
            alignItems: 'center',
            gridTemplateColumns: {
              xs: '1fr',
              md: 'minmax(0, 1.3fr) minmax(0, 1fr)',
            },
          }}
        >
          <Stack
            spacing={{ xs: 2.25, sm: 2.75 }}
            sx={{
              // A single, gentle entrance on load — the hero settles into place
              // rather than snapping in. Purely additive, and disabled for
              // visitors who ask for less motion.
              '@keyframes heroIn': {
                from: { opacity: 0, transform: 'translateY(14px)' },
                to: { opacity: 1, transform: 'none' },
              },
              animation: 'heroIn 0.7s cubic-bezier(0.16, 1, 0.3, 1) both',
              '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
            }}
          >
            {/* Eyebrow: the live market phase + today's date, set in mono like a
                ticker, reading the same phase as the app-bar status dot. */}
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: 'center', color: 'text.primary' }}
            >
              <MarketStatusDot phase={phase} />
              <Typography
                variant="caption"
                sx={{
                  fontFamily: fontFamilyMono,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  fontSize: '0.72rem',
                }}
              >
                {marketLabel(now)} · {todayLabel(now)}
              </Typography>
            </Stack>

            {/* Headline: the accent phrase in solid brand blue (not a gradient) —
                restraint, and it holds contrast on the wash in both modes. */}
            <Typography
              variant="h1"
              component="h1"
              sx={{
                fontWeight: 700,
                letterSpacing: '-0.035em',
                lineHeight: 1.03,
                fontSize: { xs: '2.2rem', sm: '2.9rem', md: '3.35rem' },
              }}
            >
              The stock screener,{' '}
              {/* Keep the accent phrase "driven by AI" on one line so it never
                  breaks mid-phrase (or clips "AI"). */}
              <Box
                component="span"
                sx={{ whiteSpace: 'nowrap', color: 'primary.main' }}
              >
                driven by AI
              </Box>
            </Typography>

            <Typography
              sx={{
                color: 'text.secondary',
                fontSize: { xs: '1.05rem', sm: '1.15rem' },
                lineHeight: 1.55,
                maxWidth: 520,
              }}
            >
              Screen 1,000+ US stocks and ETFs, then let AI read any name in
              plain English.
            </Typography>

            {/* Primary action: the universe search itself. */}
            <Box sx={{ pt: 0.5 }}>
              <HomeSearchBar />
            </Box>

            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.5}
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              <Button
                component={RouterLink}
                to="/screener"
                variant="outlined"
                size="large"
                startIcon={<TableRowsIcon />}
                sx={{
                  borderColor: 'divider',
                  color: 'text.primary',
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
                variant="outlined"
                size="large"
                startIcon={<BoltIcon />}
                sx={{
                  borderColor: 'divider',
                  color: 'text.primary',
                  '&:hover': {
                    borderColor: 'primary.main',
                    bgcolor: 'action.hover',
                  },
                }}
              >
                Market heat map
              </Button>
            </Stack>

            {/* Coverage tags — quiet proof of what the engine spans and that it's
                free, each a small bordered marker instead of dot-separated text. */}
            <Stack
              direction="row"
              spacing={1}
              useFlexGap
              sx={{ pt: 0.5, flexWrap: 'wrap' }}
            >
              {MARKERS.map(({ icon: Icon, label }) => (
                <Stack
                  key={label}
                  direction="row"
                  spacing={0.75}
                  sx={{
                    alignItems: 'center',
                    px: 1.25,
                    py: 0.5,
                    borderRadius: 999,
                    border: 1,
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                    color: 'text.secondary',
                  }}
                >
                  <Icon sx={{ fontSize: 15, color: 'secondary.main' }} />
                  <Typography
                    variant="caption"
                    sx={{ fontWeight: 600, lineHeight: 1 }}
                  >
                    {label}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Stack>

          {/* Right column: the live market snapshot. On phones it drops below the
              search (source order), so the pitch and the primary action stay first. */}
          <Box sx={{ width: '100%' }}>
            <MarketSnapshot />
          </Box>
        </Box>
      </Container>
    </Box>
  )
}
