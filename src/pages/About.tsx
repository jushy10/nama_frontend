import { Box, Container, Stack, Typography } from '@mui/material'

const goals = [
  'Make professional-grade insights accessible to everyone',
  'Explain the market in plain language, not jargon',
  'Surface what matters, and skip what doesn’t',
]

function About() {
  return (
    <Container maxWidth="sm" sx={{ py: 10 }}>
      <Typography variant="h4" component="h1" sx={{ mb: 2 }}>
        About
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Nama Insights helps everyday investors cut through the noise. We pull
        together live market data and turn it into clear, AI-powered analysis so
        you can understand what’s happening — and act with confidence.
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Our goal is simple:
      </Typography>
      <Stack
        component="ul"
        spacing={0.5}
        sx={{ pl: 3, m: 0, listStyleType: 'disc', color: 'text.secondary' }}
      >
        {goals.map((goal) => (
          <Box component="li" key={goal}>
            <Typography component="span" color="text.secondary">
              {goal}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Container>
  )
}

export default About
