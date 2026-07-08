import { useEffect, useState } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import {
  AppBar,
  Box,
  Button,
  Container,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined'
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined'
import WbSunnyRoundedIcon from '@mui/icons-material/WbSunnyRounded'
import WbTwilightRoundedIcon from '@mui/icons-material/WbTwilightRounded'
import NightsStayRoundedIcon from '@mui/icons-material/NightsStayRounded'
import BedtimeRoundedIcon from '@mui/icons-material/BedtimeRounded'
import type { SvgIconComponent } from '@mui/icons-material'
import { useColorMode } from '@/ColorModeProvider'
import { getMarketStatus, marketTooltip, type MarketPhase } from '@/lib/market'
import Home from '@/pages/Home'
import Screener from '@/pages/Screener'
import EtfScreener from '@/pages/EtfScreener'
import Search from '@/pages/Search'
import Sectors from '@/pages/Sectors'
import Mag7 from '@/pages/Mag7'
import RedirectToSearch from '@/components/RedirectToSearch'

const navItems = [
  { label: 'Home', to: '/', end: true },
  { label: 'Search', to: '/search', end: false },
  { label: 'Stock Screener', to: '/screener', end: false },
  { label: 'ETF Screener', to: '/etf-screener', end: false },
  { label: 'Mag 7', to: '/mag7', end: false },
  { label: 'Sectors', to: '/sectors', end: false },
]

/** `large` is for the top banner; the drawer keeps the compact size so the
 *  wordmark still fits its 260px panel. */
function Brand({ large = false }: { large?: boolean }) {
  return (
    <Box
      component={NavLink}
      to="/"
      end
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 1,
        textDecoration: 'none',
        color: 'text.primary',
      }}
    >
      <Box
        component="img"
        src="/nama-icon.png"
        alt="Nama Insights logo"
        sx={{
          height: large ? { xs: 48, md: 64 } : 48,
          width: large ? { xs: 48, md: 64 } : 48,
          display: 'block',
          flexShrink: 0,
        }}
      />
      {/* The large wordmark only fits beside the phone toolbar's buttons at
          its compact size, so `large` scales up from md; nowrap so a squeeze
          can never split "Nama Insights" onto two lines. */}
      <Typography
        variant={large ? 'h4' : 'h5'}
        sx={{
          fontWeight: 700,
          letterSpacing: '-0.01em',
          whiteSpace: 'nowrap',
          ...(large && { fontSize: { xs: '1.5rem', md: '2.125rem' } }),
        }}
      >
        Nama{' '}
        <Box component="span" sx={{ color: 'primary.light' }}>
          Insights
        </Box>
      </Typography>
    </Box>
  )
}

/**
 * How each trading phase reads at a glance — a warming-then-cooling arc: dawn
 * amber → bright sun → dusk indigo → muted moon. Filled + coloured on purpose,
 * so it never reads as a second copy of the outlined light/dark toggle.
 */
const PHASE_UI: Record<MarketPhase, { icon: SvgIconComponent; color: string }> =
  {
    pre: { icon: WbTwilightRoundedIcon, color: '#fbbf24' },
    regular: { icon: WbSunnyRoundedIcon, color: '#f59e0b' },
    after: { icon: NightsStayRoundedIcon, color: '#818cf8' },
    closed: { icon: BedtimeRoundedIcon, color: 'text.secondary' },
  }

/** The current phase (drives the icon) plus its hover summary, kept in sync. */
function useMarketStatus() {
  const read = () => ({
    phase: getMarketStatus(new Date()).phase,
    tooltip: marketTooltip(new Date()),
  })
  const [state, setState] = useState(read)
  useEffect(() => {
    const tick = () => setState(read())
    tick() // catch any drift between the initial render and mount
    const id = window.setInterval(tick, 60_000)
    return () => window.clearInterval(id)
  }, [])
  return state
}

/**
 * Small status hint beside the brand: the market's current phase as a sun/moon
 * that walks the trading day. A hint, not a control — no click. Hover shows a
 * one-line read: the phase and how long until it flips (e.g. "Market Open ·
 * Closes in 2h 14m"), or when it next opens when shut.
 */
function MarketStatus() {
  const { phase, tooltip } = useMarketStatus()
  const { icon: Icon, color } = PHASE_UI[phase]

  return (
    <Tooltip title={tooltip}>
      <Box
        role="img"
        aria-label={tooltip}
        sx={{ display: 'inline-flex', alignItems: 'center', color }}
      >
        <Icon sx={{ fontSize: 20 }} />
      </Box>
    </Tooltip>
  )
}

/** Sun/moon icon button that flips the app between light and dark mode. */
function ColorModeToggle() {
  const { mode, toggleColorMode } = useColorMode()
  const isDark = mode === 'dark'
  return (
    <IconButton
      onClick={toggleColorMode}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
    >
      {isDark ? <LightModeOutlinedIcon /> : <DarkModeOutlinedIcon />}
    </IconButton>
  )
}

function App() {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        bgcolor: 'background.default',
      }}
    >
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: (theme) =>
            theme.palette.mode === 'dark'
              ? 'rgba(10,10,15,0.8)'
              : 'rgba(247,248,250,0.8)',
          backdropFilter: 'blur(12px)',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Container maxWidth="xl">
          <Toolbar disableGutters sx={{ justifyContent: 'space-between' }}>
            <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
              <Brand large />
              <MarketStatus />
            </Stack>
            {/* Desktop: inline nav. Mobile (xs–sm): collapses to a drawer. */}
            <Stack
              direction="row"
              spacing={3}
              sx={{ alignItems: 'center', display: { xs: 'none', md: 'flex' } }}
            >
              {navItems.map((item) => (
                <Button
                  key={item.to}
                  component={NavLink}
                  to={item.to}
                  end={item.end}
                  variant="text"
                  sx={{
                    color: 'text.secondary',
                    fontWeight: 500,
                    fontSize: '1rem',
                    minWidth: 0,
                    p: 0,
                    '&:hover': {
                      color: 'text.primary',
                      bgcolor: 'transparent',
                    },
                    '&.active': { color: 'text.primary' },
                  }}
                >
                  {item.label}
                </Button>
              ))}
              <ColorModeToggle />
            </Stack>
            <Stack
              direction="row"
              spacing={0.5}
              sx={{ alignItems: 'center', display: { xs: 'flex', md: 'none' } }}
            >
              <ColorModeToggle />
              <IconButton
                aria-label="Open navigation menu"
                onClick={() => setDrawerOpen(true)}
                sx={{ color: 'text.primary' }}
              >
                <MenuIcon />
              </IconButton>
            </Stack>
          </Toolbar>
        </Container>
      </AppBar>

      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        slotProps={{
          paper: { sx: { width: 260, bgcolor: 'background.paper' } },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Brand />
        </Box>
        <Divider />
        <List>
          {navItems.map((item) => (
            <ListItemButton
              key={item.to}
              component={NavLink}
              to={item.to}
              end={item.end}
              onClick={() => setDrawerOpen(false)}
              sx={{
                color: 'text.secondary',
                '&.active': {
                  color: 'text.primary',
                  bgcolor: 'rgba(99,102,241,0.12)',
                },
              }}
            >
              <ListItemText primary={item.label} />
            </ListItemButton>
          ))}
        </List>
      </Drawer>

      <Box component="main" sx={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/screener" element={<Screener />} />
          <Route path="/etf-screener" element={<EtfScreener />} />
          <Route path="/mag7" element={<Mag7 />} />
          <Route path="/sectors" element={<Sectors />} />
          {/* Legacy detail URLs — the stock/fund views now live under /search. */}
          <Route path="/stocks" element={<RedirectToSearch />} />
          <Route path="/etfs" element={<RedirectToSearch />} />
        </Routes>
      </Box>

      <Box component="footer" sx={{ borderTop: 1, borderColor: 'divider' }}>
        <Container maxWidth="xl">
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            sx={{
              justifyContent: 'space-between',
              alignItems: 'center',
              py: 3,
              color: 'text.secondary',
            }}
          >
            <Typography variant="body2">
              © 2026 Nama Insights. All rights reserved.
            </Typography>
            <Typography variant="body2">
              Market data is for informational purposes only.
            </Typography>
          </Stack>
        </Container>
      </Box>
    </Box>
  )
}

export default App
