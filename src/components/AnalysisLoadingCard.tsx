import {
  Box,
  Card,
  CardContent,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import { heroWash } from '@/components/heroWash'

/**
 * The shared "the model is thinking" state for every AI-analysis card — shown
 * while a slow model read is generating, in place of the card it will become.
 * It mirrors that card's shape so the swap-in is seamless: the same sparkle
 * header and blue→gold hero wash, a "Generating…" label whose ellipsis animates,
 * a verdict-chip-shaped placeholder, and shimmering skeleton lines standing in
 * for the summary and its points. Used by the stock and ETF AI takes and the
 * earnings analysis, so every generating state across the app reads the same.
 */
export default function AnalysisLoadingCard({
  title = 'AI Analysis',
  subtitle = 'Generating your analysis',
  points = 3,
}: {
  /** The header title — matches the card being awaited ("AI Analysis",
   *  "Earnings Analysis"). */
  title?: string
  /** The line beneath the title; its trailing ellipsis animates. */
  subtitle?: string
  /** How many shimmer "point" rows to draw beneath the summary lines. */
  points?: number
}) {
  return (
    <Card
      variant="outlined"
      sx={{
        position: 'relative',
        overflow: 'hidden',
        borderColor: 'divider',
        backgroundImage: (theme) => heroWash(theme),
      }}
    >
      <CardContent
        sx={{
          p: { xs: 2, sm: 2.5 },
          '&:last-child': { pb: { xs: 2, sm: 2.5 } },
        }}
      >
        <Stack
          direction="row"
          spacing={2}
          sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}
        >
          <Box>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
              {/* The sparkle breathes while the read is in flight — the one bit
                  of motion that signals "working", the rest is a calm shimmer. */}
              <AutoAwesomeIcon
                fontSize="small"
                sx={{
                  color: 'primary.main',
                  animation: 'aiSparklePulse 1.6s ease-in-out infinite',
                  '@keyframes aiSparklePulse': {
                    '0%, 100%': { opacity: 0.45, transform: 'scale(0.9)' },
                    '50%': { opacity: 1, transform: 'scale(1.12)' },
                  },
                  '@media (prefers-reduced-motion: reduce)': {
                    animation: 'none',
                  },
                }}
              />
              <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
                {title}
              </Typography>
            </Stack>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'inline-flex', alignItems: 'baseline' }}
            >
              {subtitle}
              {/* An animated ellipsis: three dots revealed one at a time, so the
                  label reads as actively working rather than stalled. */}
              <Box
                component="span"
                aria-hidden
                sx={{
                  display: 'inline-block',
                  width: '1.1em',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  animation: 'aiEllipsis 1.6s steps(4, jump-none) infinite',
                  '@keyframes aiEllipsis': {
                    from: { width: '0em' },
                    to: { width: '1.1em' },
                  },
                  '@media (prefers-reduced-motion: reduce)': {
                    width: '1.1em',
                    animation: 'none',
                  },
                }}
              >
                …
              </Box>
            </Typography>
          </Box>

          {/* Stands in for the verdict / trend chip the loaded card carries. */}
          <Skeleton
            animation="wave"
            variant="rounded"
            width={108}
            height={34}
            sx={{ borderRadius: 2, flexShrink: 0 }}
          />
        </Stack>

        {/* The summary paragraph. */}
        <Stack spacing={1} sx={{ mt: 2 }}>
          <Skeleton animation="wave" variant="text" width="100%" height={22} />
          <Skeleton animation="wave" variant="text" width="96%" height={22} />
          <Skeleton animation="wave" variant="text" width="88%" height={22} />
        </Stack>

        {/* The points / highlights beneath it — a small dot and a line each. */}
        <Stack spacing={1.5} sx={{ mt: 2 }}>
          {Array.from({ length: points }).map((_, i) => (
            <Stack
              key={i}
              direction="row"
              spacing={1.25}
              sx={{ alignItems: 'center' }}
            >
              <Skeleton
                animation="wave"
                variant="circular"
                width={8}
                height={8}
                sx={{ flexShrink: 0 }}
              />
              <Skeleton
                animation="wave"
                variant="text"
                height={18}
                sx={{ width: `${82 - i * 12}%` }}
              />
            </Stack>
          ))}
        </Stack>
      </CardContent>
    </Card>
  )
}
