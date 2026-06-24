import { NavLink, Route, Routes } from 'react-router-dom'
import {
  AppBar,
  Box,
  Button,
  Container,
  Stack,
  Toolbar,
  Typography,
} from '@mui/material'
import ShowChartIcon from '@mui/icons-material/ShowChart'
import Home from '@/pages/Home'
import About from '@/pages/About'
import Stocks from '@/pages/Stocks'

const navItems = [
  { label: 'Home', to: '/', end: true },
  { label: 'Stocks', to: '/stocks', end: false },
  { label: 'About', to: '/about', end: false },
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
      <ShowChartIcon sx={{ color: 'primary.light' }} />
      <Typography
        variant="h6"
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

function App() {
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
          bgcolor: 'rgba(10,10,15,0.8)',
          backdropFilter: 'blur(12px)',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Container maxWidth="lg">
          <Toolbar disableGutters sx={{ justifyContent: 'space-between' }}>
            <Brand />
            <Stack
              direction="row"
              spacing={{ xs: 2, sm: 3 }}
              sx={{ alignItems: 'center' }}
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
              <Button href="#waitlist" variant="contained" color="primary">
                Get started
              </Button>
            </Stack>
          </Toolbar>
        </Container>
      </AppBar>

      <Box component="main" sx={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/stocks" element={<Stocks />} />
          <Route path="/about" element={<About />} />
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
