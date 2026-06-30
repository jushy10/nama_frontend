import { useState } from 'react'
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
  Typography,
} from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined'
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined'
import { useColorMode } from '@/ColorModeProvider'
import Home from '@/pages/Home'
import Stocks from '@/pages/Stocks'
import Sectors from '@/pages/Sectors'
import Mag7 from '@/pages/Mag7'

const navItems = [
  { label: 'Home', to: '/', end: true },
  { label: 'Mag 7', to: '/mag7', end: false },
  { label: 'Stocks', to: '/stocks', end: false },
  { label: 'Sectors', to: '/sectors', end: false },
]

function Brand() {
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
        sx={{ height: 48, width: 48, display: 'block', flexShrink: 0 }}
      />
      <Typography
        variant="h5"
        sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}
      >
        Nama{' '}
        <Box component="span" sx={{ color: 'primary.light' }}>
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
        <Container maxWidth="lg">
          <Toolbar disableGutters sx={{ justifyContent: 'space-between' }}>
            <Brand />
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
          <Route path="/mag7" element={<Mag7 />} />
          <Route path="/stocks" element={<Stocks />} />
          <Route path="/sectors" element={<Sectors />} />
        </Routes>
      </Box>

      <Box component="footer" sx={{ borderTop: 1, borderColor: 'divider' }}>
        <Container maxWidth="lg">
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
