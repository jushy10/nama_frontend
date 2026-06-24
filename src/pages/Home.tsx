import type { ReactNode } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'

type Feature = {
  title: string
  description: string
  icon: ReactNode
}

const features: Feature[] = [
  {
    title: 'Real-time market data',
    description:
      'Live prices, volume, and the day’s biggest movers across thousands of equities — refreshed by the second.',
    icon: <TrendingUpIcon />,
  },
  {
    title: 'AI-powered analysis',
    description:
      'Plain-English summaries of earnings, filings, and sentiment so you understand what’s moving and why.',
    icon: <AutoAwesomeIcon />,
  },
  {
    title: 'Portfolio tracking',
    description:
      'Connect your holdings and get personalized alerts the moment something needs your attention.',
    icon: <AccountBalanceWalletIcon />,
  },
]

const stats = [
  { value: '8,000+', label: 'Tickers covered' },
  { value: '60s', label: 'Data refresh' },
  { value: '24/7', label: 'Market monitoring' },
]

function FeatureCard({ title, description, icon }: Feature) {
  return (
    <Card
      variant="outlined"
      sx={{
        height: '100%',
        bgcolor: 'rgba(255,255,255,0.03)',
        borderColor: 'rgba(255,255,255,0.1)',
        transition: 'border-color 150ms',
        '&:hover': { borderColor: 'rgba(99,102,241,0.4)' },
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Box
          sx={{
            display: 'inline-flex',
            p: 1.25,
            mb: 2,
            borderRadius: 2,
            bgcolor: 'rgba(99,102,241,0.1)',
            color: 'primary.light',
          }}
        >
          {icon}
        </Box>
        <Typography variant="h6" component="h3" sx={{ mb: 1 }}>
          {title}
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ lineHeight: 1.7 }}
        >
          {description}
        </Typography>
      </CardContent>
    </Card>
  )
}

function SampleCard() {
  return (
    <Card
      variant="outlined"
      sx={{
        width: '100%',
        maxWidth: 360,
        borderColor: 'rgba(255,255,255,0.1)',
        background:
          'linear-gradient(to bottom, rgba(255,255,255,0.1), rgba(255,255,255,0.02))',
        boxShadow: '0 25px 50px -12px rgba(30,27,75,0.4)',
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Stack
          direction="row"
          sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}
        >
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              NVDA
            </Typography>
            <Typography variant="caption" color="text.secondary">
              NVIDIA Corp
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              $128.40
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: 'success.main', fontWeight: 500 }}
            >
              +2.41%
            </Typography>
          </Box>
        </Stack>

        <Box
          component="svg"
          viewBox="0 0 300 80"
          preserveAspectRatio="none"
          aria-hidden="true"
          sx={{ mt: 2.5, height: 80, width: '100%' }}
        >
          <polyline
            points="0,60 40,52 80,58 120,40 160,44 200,28 240,30 300,12"
            fill="none"
            stroke="#34d399"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Box>

        <Box
          sx={{
            mt: 2.5,
            p: 1.5,
            borderRadius: 2,
            border: 1,
            borderColor: 'rgba(99,102,241,0.2)',
            bgcolor: 'rgba(99,102,241,0.1)',
          }}
        >
          <Typography
            variant="caption"
            sx={{
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'primary.light',
            }}
          >
            AI Insight
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5, color: 'text.primary' }}>
            Momentum stays strong into earnings, with rising volume and
            improving sentiment across analyst notes.
          </Typography>
        </Box>
      </CardContent>
    </Card>
  )
}

function Home() {
  return (
    <>
      {/* Hero */}
      <Box sx={{ position: 'relative', overflow: 'hidden' }}>
        <Box
          aria-hidden="true"
          sx={{
            pointerEvents: 'none',
            position: 'absolute',
            top: -160,
            left: '50%',
            transform: 'translateX(-50%)',
            height: 384,
            width: 640,
            borderRadius: '50%',
            bgcolor: 'rgba(79,70,229,0.2)',
            filter: 'blur(96px)',
          }}
        />
        <Container
          maxWidth="lg"
          sx={{ position: 'relative', py: { xs: 10, lg: 14 } }}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
              gap: 6,
              alignItems: 'center',
            }}
          >
            <Box>
              <Chip
                label="Now in early access"
                size="small"
                sx={{
                  color: 'primary.light',
                  bgcolor: 'rgba(99,102,241,0.1)',
                  border: 1,
                  borderColor: 'rgba(99,102,241,0.3)',
                }}
              />
              <Typography
                variant="h2"
                component="h1"
                sx={{ mt: 2.5, fontSize: { xs: '2.25rem', sm: '3rem' } }}
              >
                Make smarter stock decisions, faster.
              </Typography>
              <Typography
                variant="h6"
                component="p"
                color="text.secondary"
                sx={{
                  mt: 2.5,
                  maxWidth: 560,
                  fontWeight: 400,
                  lineHeight: 1.7,
                }}
              >
                Nama Insights turns raw market data into clear, AI-powered
                analysis — so you always know what’s moving and why, without the
                noise.
              </Typography>
              <Stack
                direction="row"
                spacing={1.5}
                sx={{ mt: 4, flexWrap: 'wrap' }}
              >
                <Button href="#waitlist" variant="contained" size="large">
                  Start for free
                </Button>
                <Button
                  href="#features"
                  variant="outlined"
                  color="inherit"
                  size="large"
                >
                  See how it works
                </Button>
              </Stack>
            </Box>

            <Box
              sx={{
                display: 'flex',
                justifyContent: { xs: 'center', lg: 'flex-end' },
              }}
            >
              <SampleCard />
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Stats */}
      <Box
        sx={{
          borderTop: 1,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'rgba(255,255,255,0.02)',
        }}
      >
        <Container maxWidth="lg" sx={{ py: 5 }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
              gap: 4,
            }}
          >
            {stats.map((stat) => (
              <Box key={stat.label} sx={{ textAlign: 'center' }}>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {stat.value}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 0.5 }}
                >
                  {stat.label}
                </Typography>
              </Box>
            ))}
          </Box>
        </Container>
      </Box>

      {/* Features */}
      <Container id="features" maxWidth="lg" sx={{ py: 10 }}>
        <Box sx={{ maxWidth: 640, mx: 'auto', textAlign: 'center' }}>
          <Typography variant="h3" component="h2">
            Everything you need to stay ahead
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 2 }}>
            Built for investors who want signal, not spreadsheets.
          </Typography>
        </Box>
        <Box
          sx={{
            mt: 6,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
            gap: 3,
          }}
        >
          {features.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </Box>
      </Container>

      {/* CTA */}
      <Container id="waitlist" maxWidth="lg" sx={{ pb: 12 }}>
        <Paper
          variant="outlined"
          sx={{
            px: { xs: 4, sm: 8 },
            py: 7,
            textAlign: 'center',
            borderColor: 'rgba(99,102,241,0.2)',
            background:
              'linear-gradient(to right, rgba(79,70,229,0.2), rgba(168,85,247,0.1))',
          }}
        >
          <Typography variant="h3" component="h2">
            Ready to see the market more clearly?
          </Typography>
          <Typography
            color="text.secondary"
            sx={{ mt: 2, maxWidth: 560, mx: 'auto' }}
          >
            Join the early access list and be the first to try Nama Insights.
          </Typography>
          <Button href="#" variant="contained" size="large" sx={{ mt: 4 }}>
            Get early access
          </Button>
        </Paper>
      </Container>
    </>
  )
}

export default Home
