import { useState } from 'react'
import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import {
  AppBar,
  Box,
  Button,
  Collapse,
  Container,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Toolbar,
  Typography,
} from '@mui/material'
import type { CSSObject } from '@mui/material/styles'
import type { SvgIconComponent } from '@mui/icons-material'
import MenuIcon from '@mui/icons-material/Menu'
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded'
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined'
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined'
import ArticleOutlined from '@mui/icons-material/ArticleOutlined'
import SearchOutlined from '@mui/icons-material/SearchOutlined'
import TuneOutlined from '@mui/icons-material/TuneOutlined'
import ShowChartOutlined from '@mui/icons-material/ShowChartOutlined'
import LayersOutlined from '@mui/icons-material/LayersOutlined'
import TrendingUpOutlined from '@mui/icons-material/TrendingUpOutlined'
import TimelineOutlined from '@mui/icons-material/TimelineOutlined'
import CalendarMonthOutlined from '@mui/icons-material/CalendarMonthOutlined'
import GridViewOutlined from '@mui/icons-material/GridViewOutlined'
import CategoryOutlined from '@mui/icons-material/CategoryOutlined'
import AccountBalanceOutlined from '@mui/icons-material/AccountBalanceOutlined'
import AutoAwesomeOutlined from '@mui/icons-material/AutoAwesomeOutlined'
import { useColorMode } from '@/ColorModeProvider'
import { brand } from '@/theme'
import Home from '@/pages/Home'
import Screener from '@/pages/Screener'
import EtfScreener from '@/pages/EtfScreener'
import Search from '@/pages/Search'
import Sectors from '@/pages/Sectors'
import Mag7 from '@/pages/Mag7'
import HeatMapPage from '@/pages/HeatMap'
import MarketBrief from '@/pages/MarketBrief'
import EarningsCalendar from '@/pages/EarningsCalendar'
import Congress from '@/pages/Congress'
import YieldCurve from '@/pages/YieldCurve'
import RedirectToSearch from '@/components/RedirectToSearch'

// Leaves carry an icon (shown in the drawer + dropdowns) and, for grouped
// destinations, a one-line description that turns the dropdowns into a compact
// mega-menu instead of a plain text list. Groups carry an icon too, so the
// drawer's rows stay aligned whether they're a single link or a section header.
type NavLeaf = {
  label: string
  to: string
  end?: boolean
  icon: SvgIconComponent
  description?: string
}
type NavGroup = { label: string; icon: SvgIconComponent; children: NavLeaf[] }
type NavEntry = NavLeaf | NavGroup

const isGroup = (entry: NavEntry): entry is NavGroup => 'children' in entry

// Home isn't listed here — the brand logo links to `/`, so the bar stays lean:
// two direct links, then the Screener and Markets groups.
const navItems: NavEntry[] = [
  { label: 'Brief', to: '/market/brief', icon: ArticleOutlined },
  { label: 'Search', to: '/search', icon: SearchOutlined },
  {
    label: 'Screener',
    icon: TuneOutlined,
    children: [
      {
        label: 'Stocks',
        to: '/screener',
        icon: ShowChartOutlined,
        description: 'Filter US stocks by fundamentals',
      },
      {
        label: 'ETFs',
        to: '/etf-screener',
        icon: LayersOutlined,
        description: 'Screen funds by assets and fees',
      },
    ],
  },
  {
    label: 'Markets',
    icon: TrendingUpOutlined,
    children: [
      {
        label: 'Yields',
        to: '/yields',
        icon: TimelineOutlined,
        description: 'Treasury curve and spreads',
      },
      {
        label: 'Earnings',
        to: '/earnings-calendar',
        icon: CalendarMonthOutlined,
        description: 'Upcoming reports and estimates',
      },
      {
        label: 'Heat Map',
        to: '/heatmap',
        icon: GridViewOutlined,
        description: 'Market moves at a glance',
      },
      {
        label: 'Sectors',
        to: '/sectors',
        icon: CategoryOutlined,
        description: 'Performance by sector',
      },
      {
        label: 'Congress',
        to: '/congress',
        icon: AccountBalanceOutlined,
        description: 'Congressional trading activity',
      },
      {
        label: 'Mag 7',
        to: '/mag7',
        icon: AutoAwesomeOutlined,
        description: 'The mega-cap tech leaders',
      },
    ],
  },
]

/** True when the current URL sits inside one of the group's child routes. */
function useGroupActive(group: NavGroup) {
  const { pathname } = useLocation()
  return group.children.some(
    (child) => pathname === child.to || pathname.startsWith(`${child.to}/`),
  )
}

// House brand accents, reused across the nav — all derived from the shared
// `brand` tokens (src/theme.ts) so they can't drift from the wordmark colours.
// The blue→gold hairline is the identity motif: it edges the AppBar and drawer,
// and reappears as the animated underline under desktop nav items. Dropdown and
// drawer rows mark the current page with a quiet brand-tinted fill + 1px ring
// (a highlighted row reads better than an underline inside a list).
const BRAND_LINE = `linear-gradient(90deg, transparent 0%, ${brand.blue} 28%, ${brand.gold} 72%, transparent 100%)`
const NAV_UNDERLINE = `linear-gradient(90deg, ${brand.blue}, ${brand.gold})`
const ACTIVE_TINT = `rgba(${brand.blueGlowRgb}, 0.12)`
const ACTIVE_TINT_HOVER = `rgba(${brand.blueGlowRgb}, 0.18)`
const ACTIVE_RING = `inset 0 0 0 1px rgba(${brand.blueGlowRgb}, 0.30)`
// The logo stays crisp at rest; a soft brand glow only blooms on hover.
const LOGO_GLOW_HOVER = `drop-shadow(0 0 10px rgba(${brand.blueGlowRgb}, 0.55))`

// The blue→gold underline drawn under desktop nav items. Hidden at rest, it
// grows from the centre on hover and locks in solid under the active item.
// Transform + opacity only, so it stays on the compositor; under reduced-motion
// it swaps instantly instead of sliding.
const navUnderline: CSSObject = {
  content: '""',
  position: 'absolute',
  left: 14,
  right: 14,
  bottom: 4,
  height: '2px',
  borderRadius: '2px',
  background: NAV_UNDERLINE,
  transform: 'scaleX(0)',
  transformOrigin: 'center',
  opacity: 0,
  transition:
    'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease',
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
}

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
        '&:hover img': { filter: LOGO_GLOW_HOVER },
      }}
    >
      <Box
        component="img"
        src="/nama-icon.png"
        alt="Nama Insights logo"
        sx={{
          height: large ? { xs: 36, md: 46 } : 40,
          width: large ? { xs: 36, md: 46 } : 40,
          display: 'block',
          flexShrink: 0,
          transition: 'filter 0.25s ease',
        }}
      />
      {/* Slimmed wordmark — a compact lockup keeps the bar low. `large` still
          scales up a touch from md; nowrap so a squeeze can never split
          "Nama Insights" onto two lines. */}
      <Typography
        variant={large ? 'h5' : 'h6'}
        sx={{
          fontWeight: 700,
          letterSpacing: '-0.015em',
          whiteSpace: 'nowrap',
          fontSize: large
            ? { xs: '1.3rem', sm: '1.45rem', md: '1.6rem' }
            : '1.3rem',
        }}
      >
        <Box
          component="span"
          sx={{
            // Exact logo navy on light; lifted blue on dark for legibility.
            color: (theme) =>
              theme.palette.mode === 'dark'
                ? theme.palette.primary.light
                : theme.palette.primary.dark,
          }}
        >
          Nama
        </Box>{' '}
        <Box component="span" sx={{ color: 'secondary.main' }}>
          Insights
        </Box>
      </Typography>
    </Box>
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
      sx={{
        // 44x44 minimum tap target (10px padding + 24px icon) for comfortable
        // thumb use — this sits in the top bar on mobile. Borderless ghost so it
        // sits quietly beside the underline nav; brand tint blooms on hover.
        p: 1.25,
        color: 'text.secondary',
        transition: 'color 0.2s ease, background-color 0.2s ease',
        '&:hover': {
          color: 'primary.main',
          bgcolor: 'action.hover',
        },
      }}
    >
      {isDark ? <LightModeOutlinedIcon /> : <DarkModeOutlinedIcon />}
    </IconButton>
  )
}

/** Desktop nav: a text button that opens a dropdown of its child routes. The
 *  brand underline locks in whenever a child route is open or the menu is. */
function DesktopNavGroup({ group }: { group: NavGroup }) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const open = Boolean(anchorEl)
  const lit = useGroupActive(group) || open

  return (
    <>
      <Button
        variant="text"
        disableRipple
        onClick={(event) => setAnchorEl(event.currentTarget)}
        aria-haspopup="menu"
        aria-expanded={open ? 'true' : undefined}
        endIcon={
          <KeyboardArrowDownRoundedIcon
            sx={{
              fontSize: 20,
              transition: 'transform 0.2s ease',
              transform: open ? 'rotate(180deg)' : 'none',
            }}
          />
        }
        sx={{
          position: 'relative',
          px: 1.75,
          py: 0.75,
          minWidth: 0,
          borderRadius: 999,
          fontWeight: 600,
          fontSize: '1rem',
          lineHeight: 1.2,
          whiteSpace: 'nowrap',
          color: lit ? 'primary.main' : 'text.secondary',
          transition: 'color 0.2s ease',
          '& .MuiButton-endIcon': { ml: 0.25 },
          '&::after': {
            ...navUnderline,
            ...(lit && { transform: 'scaleX(1)', opacity: 1 }),
          },
          '&:hover': {
            color: lit ? 'primary.main' : 'text.primary',
            bgcolor: 'transparent',
          },
          '&:hover::after': { transform: 'scaleX(1)', opacity: lit ? 1 : 0.5 },
        }}
      >
        {group.label}
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: {
              mt: 1,
              minWidth: 284,
              p: 0.75,
              borderRadius: 2.5,
              border: 1,
              borderColor: 'divider',
              bgcolor: (theme) =>
                theme.palette.mode === 'dark'
                  ? 'rgba(16,18,27,0.94)'
                  : 'rgba(255,255,255,0.97)',
              backdropFilter: 'blur(12px)',
              boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
            },
          },
          list: { sx: { py: 0 } },
        }}
      >
        {group.children.map((item) => {
          const Icon = item.icon
          // Keep the menu item's accessible name the label alone; the one-line
          // description rides along as `aria-describedby` so a screen reader
          // announces "Stocks, Filter US stocks by fundamentals" without the
          // description bloating the name.
          const descId = item.description
            ? `nav-desc-${item.to.replace(/[^a-z0-9]+/gi, '-')}`
            : undefined
          return (
            <MenuItem
              key={item.to}
              component={NavLink}
              to={item.to}
              end={item.end}
              aria-label={item.label}
              aria-describedby={descId}
              onClick={() => setAnchorEl(null)}
              sx={{
                borderRadius: 2,
                px: 1,
                py: 1,
                my: 0.25,
                gap: 1.25,
                alignItems: 'center',
                color: 'text.secondary',
                transition: 'color 0.15s ease, background-color 0.2s ease',
                '& .nav-tile': {
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                  width: 38,
                  height: 38,
                  borderRadius: 1.5,
                  border: 1,
                  borderColor: 'divider',
                  color: 'text.secondary',
                  transition:
                    'color 0.15s ease, background-color 0.2s ease, border-color 0.2s ease',
                },
                '&:hover': { color: 'text.primary', bgcolor: 'action.hover' },
                '&:hover .nav-tile': { color: 'text.primary' },
                '&.active': {
                  color: 'primary.main',
                  bgcolor: ACTIVE_TINT,
                  boxShadow: ACTIVE_RING,
                  '&:hover': { bgcolor: ACTIVE_TINT_HOVER },
                },
                '&.active .nav-tile': {
                  color: 'primary.main',
                  bgcolor: ACTIVE_TINT,
                  borderColor: 'transparent',
                },
              }}
            >
              <Box className="nav-tile">
                <Icon sx={{ fontSize: 20 }} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  sx={{
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    lineHeight: 1.35,
                    color: 'inherit',
                  }}
                >
                  {item.label}
                </Typography>
                {item.description && (
                  <Typography
                    id={descId}
                    sx={{
                      fontSize: '0.78rem',
                      lineHeight: 1.35,
                      color: 'text.secondary',
                    }}
                  >
                    {item.description}
                  </Typography>
                )}
              </Box>
            </MenuItem>
          )
        })}
      </Menu>
    </>
  )
}

/** Mobile drawer: a collapsible section listing the group's child routes,
 *  auto-expanded when one of them is the current page. */
function MobileNavGroup({
  group,
  onNavigate,
}: {
  group: NavGroup
  onNavigate: () => void
}) {
  const active = useGroupActive(group)
  const [open, setOpen] = useState(active)
  const GroupIcon = group.icon

  return (
    <>
      <ListItemButton
        onClick={() => setOpen((value) => !value)}
        sx={{
          borderRadius: 2,
          my: 0.5,
          py: 1.25,
          color: active ? 'text.primary' : 'text.secondary',
          '&:hover': { color: 'text.primary', bgcolor: 'action.hover' },
          '& .MuiListItemText-primary': { fontWeight: 600, fontSize: '1.1rem' },
        }}
      >
        <ListItemIcon sx={{ minWidth: 40, color: 'inherit' }}>
          <GroupIcon sx={{ fontSize: 22 }} />
        </ListItemIcon>
        <ListItemText primary={group.label} />
        <KeyboardArrowDownRoundedIcon
          sx={{
            color: 'text.secondary',
            transition: 'transform 0.2s ease',
            transform: open ? 'rotate(180deg)' : 'none',
          }}
        />
      </ListItemButton>
      <Collapse in={open} timeout="auto" unmountOnExit>
        <List disablePadding sx={{ pl: 1 }}>
          {group.children.map((item) => {
            const Icon = item.icon
            return (
              <ListItemButton
                key={item.to}
                component={NavLink}
                to={item.to}
                end={item.end}
                onClick={onNavigate}
                sx={{
                  borderRadius: 2,
                  my: 0.5,
                  py: 1,
                  pl: 2,
                  color: 'text.secondary',
                  transition: 'color 0.2s ease, background-color 0.2s ease',
                  '&:hover': { color: 'text.primary', bgcolor: 'action.hover' },
                  '&.active': {
                    color: 'primary.main',
                    bgcolor: ACTIVE_TINT,
                    boxShadow: ACTIVE_RING,
                    '&:hover': {
                      color: 'primary.main',
                      bgcolor: ACTIVE_TINT_HOVER,
                    },
                  },
                  '& .MuiListItemText-primary': {
                    fontWeight: 600,
                    fontSize: '1.02rem',
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 34, color: 'inherit' }}>
                  <Icon sx={{ fontSize: 20 }} />
                </ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            )
          })}
        </List>
      </Collapse>
    </>
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
        {/* Thin blue→gold ticker line echoing the hero headline gradient. */}
        <Box sx={{ height: 2, background: BRAND_LINE }} />
        <Container maxWidth="xl">
          <Toolbar
            disableGutters
            sx={{
              justifyContent: 'space-between',
              minHeight: { xs: 62, md: 70 },
            }}
          >
            <Brand large />
            {/* Desktop (lg+): inline nav. Below lg the seven items no longer fit
                beside the wordmark, so the bar collapses to the drawer. */}
            <Stack
              direction="row"
              spacing={1.5}
              sx={{ alignItems: 'center', display: { xs: 'none', lg: 'flex' } }}
            >
              <Stack
                direction="row"
                spacing={0.5}
                sx={{ alignItems: 'center' }}
              >
                {navItems.map((item) =>
                  isGroup(item) ? (
                    <DesktopNavGroup key={item.label} group={item} />
                  ) : (
                    <Button
                      key={item.to}
                      component={NavLink}
                      to={item.to}
                      end={item.end}
                      variant="text"
                      disableRipple
                      sx={{
                        position: 'relative',
                        px: 1.75,
                        py: 0.75,
                        minWidth: 0,
                        borderRadius: 999,
                        fontWeight: 600,
                        fontSize: '1rem',
                        lineHeight: 1.2,
                        whiteSpace: 'nowrap',
                        color: 'text.secondary',
                        transition: 'color 0.2s ease',
                        '&::after': navUnderline,
                        '&:hover': {
                          color: 'text.primary',
                          bgcolor: 'transparent',
                        },
                        '&:hover::after': {
                          transform: 'scaleX(1)',
                          opacity: 0.5,
                        },
                        '&.active': { color: 'primary.main' },
                        '&.active::after': {
                          transform: 'scaleX(1)',
                          opacity: 1,
                        },
                      }}
                    >
                      {item.label}
                    </Button>
                  ),
                )}
              </Stack>
              <ColorModeToggle />
            </Stack>
            <Stack
              direction="row"
              spacing={0.5}
              sx={{ alignItems: 'center', display: { xs: 'flex', lg: 'none' } }}
            >
              <ColorModeToggle />
              <IconButton
                aria-label="Open navigation menu"
                onClick={() => setDrawerOpen(true)}
                // 44x44 minimum tap target (10px padding + 24px icon).
                sx={{ color: 'text.primary', p: 1.25 }}
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
          paper: { sx: { width: 288, bgcolor: 'background.paper' } },
        }}
      >
        {/* Mirror the AppBar's blue→gold accent along the drawer's top edge. */}
        <Box
          sx={{
            height: 3,
            background: `linear-gradient(90deg, ${brand.blue} 0%, ${brand.gold} 100%)`,
          }}
        />
        <Box sx={{ p: 2 }}>
          <Brand />
        </Box>
        <Divider />
        <List sx={{ px: 1, py: 1.5 }}>
          {navItems.map((item) =>
            isGroup(item) ? (
              <MobileNavGroup
                key={item.label}
                group={item}
                onNavigate={() => setDrawerOpen(false)}
              />
            ) : (
              (() => {
                const Icon = item.icon
                return (
                  <ListItemButton
                    key={item.to}
                    component={NavLink}
                    to={item.to}
                    end={item.end}
                    onClick={() => setDrawerOpen(false)}
                    sx={{
                      borderRadius: 2,
                      my: 0.5,
                      py: 1.25,
                      color: 'text.secondary',
                      transition: 'color 0.2s ease, background-color 0.2s ease',
                      '&:hover': {
                        color: 'text.primary',
                        bgcolor: 'action.hover',
                      },
                      '&.active': {
                        color: 'primary.main',
                        bgcolor: ACTIVE_TINT,
                        boxShadow: ACTIVE_RING,
                        '&:hover': {
                          color: 'primary.main',
                          bgcolor: ACTIVE_TINT_HOVER,
                        },
                      },
                      '& .MuiListItemText-primary': {
                        fontWeight: 600,
                        fontSize: '1.1rem',
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 40, color: 'inherit' }}>
                      <Icon sx={{ fontSize: 22 }} />
                    </ListItemIcon>
                    <ListItemText primary={item.label} />
                  </ListItemButton>
                )
              })()
            ),
          )}
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
          <Route path="/yields" element={<YieldCurve />} />
          <Route path="/heatmap" element={<HeatMapPage />} />
          <Route path="/market/brief" element={<MarketBrief />} />
          <Route path="/market/brief/:date" element={<MarketBrief />} />
          <Route path="/earnings-calendar" element={<EarningsCalendar />} />
          <Route path="/congress" element={<Congress />} />
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
