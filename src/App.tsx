import { useEffect, useState, type ComponentType } from 'react'
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
import { useColorMode } from '@/ColorModeProvider'
import {
  getMarketStatus,
  marketLabel,
  marketTooltip,
  type MarketPhase,
} from '@/lib/market'
import Home from '@/pages/Home'
import Screener from '@/pages/Screener'
import EtfScreener from '@/pages/EtfScreener'
import Search from '@/pages/Search'
import Sectors from '@/pages/Sectors'
import Mag7 from '@/pages/Mag7'
import RedirectToSearch from '@/components/RedirectToSearch'
import { MoonIcon, SunIcon } from '@/components/MarketIcons'

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
          height: large ? { xs: 40, md: 64 } : 48,
          width: large ? { xs: 40, md: 64 } : 48,
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
          ...(large && {
            fontSize: { xs: '1.25rem', sm: '1.75rem', md: '2.125rem' },
          }),
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
 * Two hand-drawn, universally-read glyphs — a Sun over the daytime half of the
 * market (pre-market into the regular session) and a Moon over the evening/
 * overnight half (after-hours into closed). The colour carries the finer read
 * across a warming-then-cooling arc: dawn amber → bright sun → dusk indigo →
 * muted moon. Filled + coloured, so they never read as a second copy of the
 * outlined light/dark toggle sitting at the other end of the bar.
 */
const PHASE_UI: Record<
  MarketPhase,
  { icon: ComponentType<{ size?: number }>; color: string }
> = {
  pre: { icon: SunIcon, color: '#fbbf24' },
  regular: { icon: SunIcon, color: '#f59e0b' },
  after: { icon: MoonIcon, color: '#818cf8' },
  closed: { icon: MoonIcon, color: 'text.secondary' },
}

/** Compact phase wording for the tightest (xs) phones, where the full label
 *  won't fit beside the wordmark; the icon and tooltip carry the rest. */
const SHORT_LABEL: Record<MarketPhase, string> = {
  pre: 'Pre',
  regular: 'Open',
  after: 'After',
  closed: 'Closed',
}

/** The current phase (drives the icon), its short label, and hover summary. */
function useMarketStatus() {
  const read = () => ({
    phase: getMarketStatus(new Date()).phase,
    label: marketLabel(new Date()),
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
 * that walks the trading day, with an always-visible label ("Market Open",
 * "After Hours", …) so the status reads without a hover. A hint, not a control
 * — no click. Hover still adds the countdown (e.g. "Market Open · Closes in 2h
 * 14m"). On the tightest (xs) phones the label shrinks to a compact form
 * ("Open" / "After" / "Closed") rather than folding away, so touch — which
 * can't hover — still reads the phase.
 */
function MarketStatus() {
  const { phase, label, tooltip } = useMarketStatus()
  const { icon: Icon, color } = PHASE_UI[phase]
  const shortLabel = SHORT_LABEL[phase]

  return (
    <Tooltip title={tooltip}>
      <Box
        role="img"
        aria-label={tooltip}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.75,
          // Optical centering: Roboto's caps sit ~0.06em below their line-box
          // centre, so a straight center-align leaves the icon reading high
          // against the wordmark. Nudge the unit down onto the letterforms.
          position: 'relative',
          top: '2px',
        }}
      >
        <Box component="span" sx={{ display: 'inline-flex', color }}>
          <Icon size={20} />
        </Box>
        {/* Compact wording on xs; the full label from sm up. Both are static
            so the phase reads on touch, where the tooltip is out of reach. */}
        <Typography
          component="span"
          sx={{
            display: { xs: 'block', sm: 'none' },
            fontSize: '0.6875rem',
            fontWeight: 600,
            lineHeight: 1,
            letterSpacing: '0.01em',
            color: 'text.secondary',
            whiteSpace: 'nowrap',
          }}
        >
          {shortLabel}
        </Typography>
        <Typography
          component="span"
          sx={{
            display: { xs: 'none', sm: 'block' },
            fontSize: '0.8125rem',
            fontWeight: 600,
            lineHeight: 1,
            letterSpacing: '0.01em',
            color: 'text.secondary',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </Typography>
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
            <Stack
              direction="row"
              spacing={{ xs: 0.75, sm: 1.25 }}
              sx={{ alignItems: 'center' }}
            >
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
