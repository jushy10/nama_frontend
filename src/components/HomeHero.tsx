import { Link as RouterLink } from 'react-router-dom'
import { Box, Button, Chip, Container, Stack, Typography } from '@mui/material'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import TableRowsIcon from '@mui/icons-material/TableRows'
import BoltIcon from '@mui/icons-material/Bolt'
import { heroWash } from '@/components/heroWash'
import HomeSearchBar from '@/components/HomeSearchBar'
import MarketStatusDot from '@/components/MarketStatusDot'
import { getMarketStatus, marketLabel } from '@/lib/market'

/** Today, spelled out (e.g. "Thursday, July 10") for the hero eyebrow. */
function todayLabel(now: Date): string {
  return now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

/** The three trust markers under the search bar — what the engine covers. */
const TRUST = [
  '1,000+ US stocks & ETFs',
  'Refreshed daily',
  'Powered by Claude',
]

/**
 * Home-page hero: the app's front door, built around what it is — an AI-driven
 * stock screener. A live market-status eyebrow, a two-tone headline that states
 * the pitch, a one-line description of the coverage, and — as the primary call
 * to action — the universe search itself, so a visitor's first move is to look
 * something up rather than read about it. A "Powered by Claude" badge and a few
 * coverage chips underline the AI angle; a secondary button opens the full
 * screener. The blue→gold wash (shared with the stock-detail hero cards) plus a
 * faint grid gives the band depth; everything stacks and scales on phones.
 */
export default function HomeHero() {
  const now = new Date()
  const phase = getMarketStatus(now).phase

  return (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        // The blue→gold wash, shared with the stock-detail hero cards.
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
        sx={{ position: 'relative', py: { xs: 5, sm: 8 } }}
      >
        <Stack
          spacing={{ xs: 2, sm: 2.5 }}
          sx={{ maxWidth: { xs: '100%', md: 940 } }}
        >
          {/* Eyebrow: live market phase + today's date, reading the same phase
              as the app-bar status dot. */}
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: 'center', color: 'text.primary' }}
          >
            <MarketStatusDot phase={phase} />
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              {marketLabel(now)} · {todayLabel(now)}
            </Typography>
          </Stack>

          {/* Powered-by-Claude badge — the AI angle, stated plainly. */}
          <Chip
            icon={<AutoAwesomeIcon />}
            label="AI stock screener · Powered by Claude"
            size="small"
            sx={{
              alignSelf: 'flex-start',
              fontWeight: 600,
              color: 'text.primary',
              bgcolor: 'background.paper',
              border: 1,
              borderColor: 'divider',
              '& .MuiChip-icon': { color: 'secondary.main' },
            }}
          />

          {/* Two-tone headline: the accent phrase carries the brand gradient. */}
          <Typography
            variant="h1"
            component="h1"
            sx={{
              fontWeight: 700,
              letterSpacing: '-0.02em',
              lineHeight: 1.08,
              fontSize: { xs: '2.1rem', sm: '3rem', md: '3.5rem' },
            }}
          >
            The stock screener,{' '}
            {/* Keep "driven by AI." together so the accent phrase never breaks
                mid-line (and "AI" never lands alone or clipped). */}
            <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
              <Box
                component="span"
                sx={{
                  background:
                    'linear-gradient(90deg, #4f83e6 0%, #d7a739 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                driven by AI
              </Box>
              .
            </Box>
          </Typography>

          <Typography
            sx={{
              color: 'text.secondary',
              fontSize: { xs: '1rem', sm: '1.15rem' },
              lineHeight: 1.6,
              maxWidth: 720,
            }}
          >
            Screen 1,000+ US stocks and ETFs, then let AI read each one for you
            — fundamentals, earnings, analyst coverage and options, in plain
            English. Start with any name below.
          </Typography>

          {/* Primary action: the universe search itself. */}
          <Box sx={{ pt: 0.5 }}>
            <HomeSearchBar />
          </Box>

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            sx={{ pt: 0.5, width: { xs: '100%', sm: 'auto' } }}
          >
            <Button
              component={RouterLink}
              to="/screener"
              variant="outlined"
              size="large"
              startIcon={<TableRowsIcon />}
              sx={{ borderColor: 'divider', color: 'text.primary' }}
            >
              Open the Screener
            </Button>
            <Button
              component={RouterLink}
              to="/heatmap"
              variant="outlined"
              size="large"
              startIcon={<BoltIcon />}
              sx={{ borderColor: 'divider', color: 'text.primary' }}
            >
              Market heat map
            </Button>
          </Stack>

          {/* Coverage chips — quiet proof of what the engine spans. */}
          <Stack
            direction="row"
            spacing={0}
            useFlexGap
            sx={{ pt: 1, flexWrap: 'wrap' }}
          >
            {TRUST.map((t) => (
              <Typography
                key={t}
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  fontWeight: 600,
                  '&:not(:last-of-type):after': {
                    content: '"·"',
                    px: 1.25,
                    opacity: 0.5,
                  },
                }}
              >
                {t}
              </Typography>
            ))}
          </Stack>
        </Stack>
      </Container>
    </Box>
  )
}
