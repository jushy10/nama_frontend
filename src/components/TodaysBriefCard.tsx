import {
  Box,
  Button,
  Card,
  Chip,
  Container,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import { Link as RouterLink } from 'react-router-dom'
import BandHeader from '@/components/BandHeader'
import { useMarketBrief } from '@/lib/queries'
import { BRIEF_TONE } from '@/lib/briefTone'
import { longDate } from '@/lib/earningsWeek'
import type { MarketBrief } from '@/lib/api'

/** A left-to-right navy→gold rule — the masthead line that ties the dispatch to
 *  the brand (the same accent the app bar and drawer carry). */
const MASTHEAD_RULE = 'linear-gradient(90deg, #4f83e6 0%, #d7a739 100%)'

/** The loaded teaser: masthead (date + posture), the lede, a read link. */
function Loaded({ data }: { data: MarketBrief }) {
  const tone = BRIEF_TONE[data.tone] ?? BRIEF_TONE.mixed
  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        sx={{
          alignItems: { xs: 'flex-start', sm: 'center' },
          justifyContent: 'space-between',
        }}
      >
        <Typography
          component="p"
          sx={{
            fontSize: { xs: '1.15rem', sm: '1.3rem' },
            fontWeight: 700,
            letterSpacing: '-0.02em',
          }}
        >
          {longDate(data.date)}
        </Typography>
        <Chip label={tone.label} color={tone.color} size="small" />
      </Stack>

      <Typography
        sx={{
          fontSize: { xs: '1.1rem', sm: '1.25rem' },
          lineHeight: 1.55,
          color: 'text.primary',
          // Clamp the lede to a few lines — the full brief is one click away.
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {data.summary}
      </Typography>

      <Box>
        <Button
          component={RouterLink}
          to="/market/brief"
          variant="text"
          endIcon={<ArrowForwardIcon />}
          sx={{ px: 0, fontWeight: 700, color: 'primary.main' }}
        >
          Read the full brief
        </Button>
      </Box>
    </Stack>
  )
}

/** Placeholder while the latest brief loads. */
function LoadingState() {
  return (
    <Stack spacing={2}>
      <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
        <Skeleton variant="text" width={220} height={30} />
        <Skeleton variant="rounded" width={80} height={24} />
      </Stack>
      <Skeleton variant="text" width="100%" height={28} />
      <Skeleton variant="text" width="92%" height={28} />
      <Skeleton variant="text" width="60%" height={28} />
    </Stack>
  )
}

/**
 * Home-page "Today's brief" band: a teaser for the latest AI-written daily market
 * brief — the day's headline posture and lede, linking through to the full read.
 * Best-effort, like the market summary: if no brief has been written yet (a 404)
 * or the read fails, the query doesn't retry and the whole band quietly hides
 * rather than showing a broken card.
 */
export default function TodaysBriefCard() {
  const { data, isLoading, isError } = useMarketBrief()
  if (isError) return null

  return (
    <Box sx={{ borderTop: 1, borderColor: 'divider' }}>
      <Container maxWidth="xl" sx={{ py: { xs: 4, sm: 5, md: 6 } }}>
        <BandHeader
          icon={<AutoAwesomeIcon />}
          title="Today's brief"
          subtitle="A plain-language AI read of how the US market is moving today: the indices, the sectors, and the day's biggest movers."
        />

        <Card
          variant="outlined"
          sx={{ borderColor: 'divider', overflow: 'hidden' }}
        >
          {/* Masthead rule — the dispatch's navy→gold edge. */}
          <Box sx={{ height: 3, background: MASTHEAD_RULE }} />
          <Box sx={{ p: { xs: 2.5, sm: 3 } }}>
            {isLoading || !data ? <LoadingState /> : <Loaded data={data} />}
          </Box>
        </Card>
      </Container>
    </Box>
  )
}
