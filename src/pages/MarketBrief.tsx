import {
  Box,
  Button,
  Chip,
  Container,
  Divider,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { Link as RouterLink, useParams } from 'react-router-dom'
import { useMarketBrief } from '@/lib/queries'
import { errorMessage } from '@/lib/queries'
import { BRIEF_TONE, SERIF } from '@/lib/briefTone'
import { longDate } from '@/lib/earningsWeek'
import { usePageMeta } from '@/lib/usePageMeta'
import type { MarketBrief } from '@/lib/api'

const MASTHEAD_RULE = 'linear-gradient(90deg, #4f83e6 0%, #d7a739 100%)'

/** "Written Jul 14, 2026, 6:00 AM" — the dateline, in the viewer's locale. */
function writtenAt(iso: string): string {
  const dt = new Date(iso)
  if (Number.isNaN(dt.getTime())) return ''
  return dt.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** The masthead: eyebrow, the dated headline in serif, and the posture. */
function Masthead({ data }: { data: MarketBrief }) {
  const tone = BRIEF_TONE[data.tone] ?? BRIEF_TONE.mixed
  return (
    <Box>
      <Stack
        direction="row"
        spacing={0.75}
        sx={{ alignItems: 'center', mb: 1 }}
      >
        <AutoAwesomeIcon fontSize="small" sx={{ color: 'secondary.main' }} />
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.14em',
            color: 'text.secondary',
          }}
        >
          AI Market Brief
        </Typography>
      </Stack>

      <Typography
        component="h1"
        sx={{
          fontFamily: SERIF,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
          fontSize: { xs: '2rem', sm: '2.75rem' },
        }}
      >
        {longDate(data.date)}
      </Typography>

      <Box
        sx={{
          height: 3,
          background: MASTHEAD_RULE,
          borderRadius: 2,
          my: 2,
          maxWidth: 240,
        }}
      />

      <Stack
        direction="row"
        spacing={1.25}
        sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}
      >
        <Chip label={tone.label} color={tone.color} size="small" />
        <Typography variant="body2" color="text.secondary">
          {tone.help}
        </Typography>
      </Stack>
    </Box>
  )
}

/** The loaded article: masthead, serif lede, the sections, then the dateline. */
function Article({ data }: { data: MarketBrief }) {
  return (
    <Stack spacing={{ xs: 3, sm: 4 }}>
      <Masthead data={data} />

      <Typography
        sx={{
          fontFamily: SERIF,
          fontSize: { xs: '1.3rem', sm: '1.5rem' },
          lineHeight: 1.55,
          fontWeight: 500,
        }}
      >
        {data.summary}
      </Typography>

      <Divider />

      <Stack spacing={{ xs: 3, sm: 3.5 }}>
        {data.sections.map((section, i) => (
          <Box key={`${section.heading}-${i}`} component="section">
            <Typography
              component="h2"
              sx={{
                fontFamily: SERIF,
                fontWeight: 600,
                fontSize: { xs: '1.3rem', sm: '1.5rem' },
                letterSpacing: '-0.01em',
                mb: 1,
              }}
            >
              {section.heading}
            </Typography>
            <Typography
              sx={{
                fontSize: '1.05rem',
                lineHeight: 1.7,
                color: 'text.primary',
              }}
            >
              {section.body}
            </Typography>
          </Box>
        ))}
      </Stack>

      <Divider />

      <Stack spacing={0.5}>
        {data.generated_at && (
          <Typography variant="caption" color="text.secondary">
            Written {writtenAt(data.generated_at)}
            {data.model ? ` · ${data.model}` : ''}
          </Typography>
        )}
        <Typography variant="caption" color="text.secondary">
          {data.disclaimer}
        </Typography>
      </Stack>
    </Stack>
  )
}

/** Skeleton while the brief loads. */
function LoadingState() {
  return (
    <Stack spacing={4}>
      <Box>
        <Skeleton variant="text" width={140} height={20} />
        <Skeleton variant="text" width="70%" height={56} />
        <Skeleton variant="rounded" width={90} height={24} sx={{ mt: 1 }} />
      </Box>
      <Skeleton variant="text" width="100%" height={36} />
      <Skeleton variant="text" width="85%" height={36} />
      <Divider />
      {[0, 1, 2].map((i) => (
        <Stack key={i} spacing={1}>
          <Skeleton variant="text" width={200} height={32} />
          <Skeleton variant="text" width="100%" />
          <Skeleton variant="text" width="95%" />
          <Skeleton variant="text" width="80%" />
        </Stack>
      ))}
    </Stack>
  )
}

/** Empty/error state — a friendly note when no brief exists for the day yet. */
function EmptyState({ dated, message }: { dated: boolean; message: string }) {
  return (
    <Stack spacing={2} sx={{ py: 4, alignItems: 'flex-start' }}>
      <Typography
        component="h1"
        sx={{ fontFamily: SERIF, fontSize: '1.75rem', fontWeight: 600 }}
      >
        No brief for this day
      </Typography>
      <Typography color="text.secondary">
        {dated
          ? "We don't have a market brief for that date. Briefs are written on trading days."
          : message}
      </Typography>
      <Button component={RouterLink} to="/market/brief" variant="outlined">
        See the latest brief
      </Button>
    </Stack>
  )
}

/**
 * The daily market brief reader (`/market/brief` and `/market/brief/{date}`) — the
 * full editorial read of how the US market moved on a given day, styled as a dated
 * dispatch. The latest brief serves the bare `/market/brief`; a dated URL serves
 * that specific day (the SEO-indexed archive). Best-effort: a day with no brief is
 * a friendly empty state, not an error page.
 */
export default function MarketBrief() {
  const { date } = useParams<{ date?: string }>()
  const { data, isLoading, isError, error } = useMarketBrief(date)

  usePageMeta(
    data
      ? `Market Brief — ${longDate(data.date)} | Nama Insights`
      : 'Daily Market Brief | Nama Insights',
    data
      ? data.summary.slice(0, 155)
      : 'A plain-language AI read of how the US stock market moved today — the indices, the sectors, and the day’s biggest movers. Updated daily.',
  )

  return (
    <Container maxWidth="md" sx={{ py: { xs: 4, sm: 6 } }}>
      <Box sx={{ mb: 3 }}>
        <Button
          component={RouterLink}
          to="/"
          size="small"
          startIcon={<ArrowBackIcon />}
          sx={{ color: 'text.secondary', px: 0 }}
        >
          Home
        </Button>
      </Box>

      {isError ? (
        <EmptyState dated={!!date} message={errorMessage(error)} />
      ) : isLoading || !data ? (
        <LoadingState />
      ) : (
        <Article data={data} />
      )}
    </Container>
  )
}
