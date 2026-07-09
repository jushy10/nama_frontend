import { Link as RouterLink } from 'react-router-dom'
import { Box, Button, Container, Stack, Typography } from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import TableRowsIcon from '@mui/icons-material/TableRows'
import { marketLabel } from '@/lib/market'

/** Today, spelled out (e.g. "Thursday, July 9") for the hero eyebrow. */
function todayLabel(now: Date): string {
  return now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

/**
 * Home-page hero: a compact, gradient-washed intro that anchors the dashboard.
 * A live status eyebrow (market phase + today's date), a two-tone headline, a
 * one-line description of what's below, and two quick jumps into the app. The
 * gradient is tuned for both themes; everything stacks and scales down cleanly
 * on phones.
 */
export default function HomeHero() {
  const now = new Date()

  return (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        // A soft blue→gold wash over the canvas — brighter in dark, gentle
        // in light so text stays legible either way.
        background: (theme) =>
          theme.palette.mode === 'dark'
            ? 'radial-gradient(1100px 380px at 15% -20%, rgba(47,99,180,0.22), transparent 60%), radial-gradient(900px 360px at 100% 0%, rgba(215,167,57,0.14), transparent 55%)'
            : 'radial-gradient(1100px 380px at 15% -20%, rgba(47,99,180,0.12), transparent 60%), radial-gradient(900px 360px at 100% 0%, rgba(215,167,57,0.09), transparent 55%)',
      }}
    >
      <Container maxWidth="lg" sx={{ py: { xs: 5, sm: 8 } }}>
        <Stack spacing={{ xs: 2, sm: 2.5 }} sx={{ maxWidth: 720 }}>
          {/* Live status eyebrow: the phase label, then today's date. The
              live status dot now lives in the app bar. */}
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}
          >
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'text.primary',
              }}
            >
              {marketLabel(now)}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              · {todayLabel(now)}
            </Typography>
          </Stack>

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
            The U.S. market,{' '}
            <Box
              component="span"
              sx={{
                background: 'linear-gradient(90deg, #4f83e6 0%, #d7a739 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              read by AI
            </Box>
            .
          </Typography>

          <Typography
            sx={{
              color: 'text.secondary',
              fontSize: { xs: '1rem', sm: '1.15rem' },
              lineHeight: 1.6,
            }}
          >
            Live index moves, plain-language reads of the market and its
            sectors, and the fastest-growing mega caps — all on one page.
          </Typography>

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            sx={{ pt: 1, width: { xs: '100%', sm: 'auto' } }}
          >
            <Button
              component={RouterLink}
              to="/screener"
              variant="contained"
              size="large"
              startIcon={<TableRowsIcon />}
            >
              Open the Screener
            </Button>
            <Button
              component={RouterLink}
              to="/search"
              variant="outlined"
              size="large"
              startIcon={<SearchIcon />}
              sx={{ borderColor: 'divider', color: 'text.primary' }}
            >
              Search a Stock or ETF
            </Button>
          </Stack>
        </Stack>
      </Container>
    </Box>
  )
}
