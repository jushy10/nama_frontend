import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Link,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined'
import { useSectorAnalysis } from '@/lib/queries'
import type {
  MarketTone,
  SectorAnalysis,
  SectorHeadline,
  SectorHighlight,
  SectorMover,
} from '@/lib/api'

/** Signed percent, e.g. +1.84% / -0.64% — matching SectorCard's formatting. */
const fmtPct = (n: number | null) =>
  n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`

const moveColor = (n: number | null) =>
  n == null ? 'text.secondary' : n >= 0 ? 'success.main' : 'error.main'

/** How each risk posture renders: a coloured chip + a plain-language gloss. */
const TONE: Record<
  MarketTone,
  { label: string; color: 'success' | 'warning' | 'default'; help: string }
> = {
  risk_on: {
    label: 'Risk-On',
    color: 'success',
    help: 'Growth-sensitive sectors are leading — an appetite for risk.',
  },
  risk_off: {
    label: 'Risk-Off',
    color: 'warning',
    help: 'Defensive sectors are leading — a flight to safety.',
  },
  mixed: {
    label: 'Mixed',
    color: 'default',
    help: 'No clear rotation between growth and defensive sectors.',
  },
}

/**
 * The stocks that drove the sector, as compact chips (ticker + its real day
 * move, colour-coded), each linking to its own stock page — the grounded "why"
 * behind the note. Hovering a chip reveals the company name.
 */
function MoverChips({ movers }: { movers: SectorMover[] }) {
  return (
    <Stack
      direction="row"
      sx={{ flexWrap: 'wrap', gap: 0.75, mt: 1 }}
      aria-label="Driving stocks"
    >
      {movers.map((m) => (
        <Tooltip key={m.ticker} title={m.name ?? m.ticker} arrow>
          <Link
            component={RouterLink}
            to={`/search?symbol=${encodeURIComponent(m.ticker)}`}
            underline="none"
            sx={{
              display: 'inline-flex',
              alignItems: 'baseline',
              gap: 0.5,
              px: 1,
              py: 0.25,
              borderRadius: 999,
              border: 1,
              borderColor: 'divider',
              bgcolor: 'action.hover',
              transition: 'border-color 0.15s ease',
              '&:hover': { borderColor: 'text.secondary' },
            }}
          >
            <Box
              component="span"
              sx={{
                fontWeight: 700,
                fontSize: '0.8125rem',
                color: 'text.primary',
              }}
            >
              {m.ticker}
            </Box>
            <Box
              component="span"
              sx={{
                fontSize: '0.8125rem',
                color: moveColor(m.change_percent),
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {fmtPct(m.change_percent)}
            </Box>
          </Link>
        </Tooltip>
      ))}
    </Stack>
  )
}

/**
 * The catalyst headlines behind the move: a subtle line per headline, linking
 * out to the source article when one is available. Best-effort — often absent.
 */
function Catalysts({ headlines }: { headlines: SectorHeadline[] }) {
  return (
    <Stack spacing={0.5} sx={{ mt: 1 }}>
      {headlines.map((hd, i) => {
        const body = (
          <Stack
            direction="row"
            spacing={0.75}
            sx={{ alignItems: 'flex-start', color: 'text.secondary' }}
          >
            <ArticleOutlinedIcon
              sx={{ fontSize: 15, mt: '2px', flexShrink: 0 }}
            />
            <Typography variant="caption" sx={{ lineHeight: 1.4 }}>
              {hd.title}
            </Typography>
          </Stack>
        )
        return hd.link ? (
          <Link
            key={i}
            href={hd.link}
            target="_blank"
            rel="noopener noreferrer"
            underline="hover"
            sx={{ color: 'text.secondary' }}
          >
            {body}
          </Link>
        ) : (
          <Box key={i}>{body}</Box>
        )
      })}
    </Stack>
  )
}

/** One leader/laggard: sector name + its real day move, the AI's note, then the
 *  grounded drivers behind it — the moving stocks and any catalyst headline. */
function HighlightRow({ h }: { h: SectorHighlight }) {
  // Guard against a not-yet-deployed backend that omits the new fields.
  const movers = h.movers ?? []
  const headlines = h.headlines ?? []
  return (
    <Box>
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: 'baseline', justifyContent: 'space-between' }}
      >
        <Typography sx={{ fontWeight: 600, lineHeight: 1.3 }}>
          {h.sector}
        </Typography>
        <Typography
          sx={{
            fontWeight: 700,
            flexShrink: 0,
            color: moveColor(h.change_percent),
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {fmtPct(h.change_percent)}
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
        {h.note}
      </Typography>
      {movers.length > 0 && <MoverChips movers={movers} />}
      {headlines.length > 0 && <Catalysts headlines={headlines} />}
    </Box>
  )
}

/** A titled column of highlights (Leading / Lagging), colour-coded to its side. */
function HighlightColumn({
  title,
  icon,
  color,
  items,
}: {
  title: string
  icon: React.ReactNode
  color: string
  items: SectorHighlight[]
}) {
  return (
    <Box>
      <Stack
        direction="row"
        spacing={0.75}
        sx={{ alignItems: 'center', color, mb: 1.5 }}
      >
        {icon}
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          {title}
        </Typography>
      </Stack>
      {items.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No standouts today.
        </Typography>
      ) : (
        <Stack spacing={1.5}>
          {items.map((h) => (
            <HighlightRow key={h.symbol} h={h} />
          ))}
        </Stack>
      )}
    </Box>
  )
}

/** The loaded card body: tone + summary, the two columns, then the disclaimer. */
function Loaded({ data }: { data: SectorAnalysis }) {
  const tone = TONE[data.tone] ?? TONE.mixed
  return (
    <Stack spacing={2.5}>
      <Box>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          sx={{
            alignItems: { xs: 'flex-start', sm: 'center' },
            justifyContent: 'space-between',
            mb: 1,
          }}
        >
          <Chip label={tone.label} color={tone.color} size="small" />
          <Typography variant="caption" color="text.secondary">
            {tone.help}
          </Typography>
        </Stack>
        <Typography sx={{ fontSize: '1.05rem', lineHeight: 1.6 }}>
          {data.summary}
        </Typography>
      </Box>

      <Divider />

      <Box
        sx={{
          display: 'grid',
          gap: 3,
          gridTemplateColumns: '1fr',
        }}
      >
        <HighlightColumn
          title="Leading"
          color="success.main"
          icon={<TrendingUpIcon fontSize="small" />}
          items={data.leaders}
        />
        <HighlightColumn
          title="Lagging"
          color="error.main"
          icon={<TrendingDownIcon fontSize="small" />}
          items={data.laggards}
        />
      </Box>

      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', pt: 0.5 }}
      >
        {data.disclaimer}
      </Typography>
    </Stack>
  )
}

/** Placeholder while the model read is generating. */
function LoadingState() {
  return (
    <Stack spacing={2}>
      <Skeleton variant="rounded" width={88} height={24} />
      <Skeleton variant="text" width="100%" />
      <Skeleton variant="text" width="85%" />
      <Divider />
      <Box
        sx={{
          display: 'grid',
          gap: 3,
          gridTemplateColumns: '1fr',
        }}
      >
        {[0, 1].map((c) => (
          <Stack key={c} spacing={1.5}>
            <Skeleton variant="text" width={90} />
            <Skeleton variant="text" width="70%" />
            <Skeleton variant="text" width="60%" />
          </Stack>
        ))}
      </Box>
    </Stack>
  )
}

/**
 * Home-page "Sector pulse" widget: an AI read of which market sectors are
 * leading and lagging today, with the risk posture that rotation implies. The
 * read is best-effort — if the model is briefly unavailable or not configured
 * (a 502/503), the query doesn't retry and the whole widget quietly hides
 * rather than showing a broken card.
 */
export default function SectorPulse() {
  const { data, isLoading, isError } = useSectorAnalysis()
  if (isError) return null
  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <AutoAwesomeIcon fontSize="small" sx={{ color: 'primary.main' }} />
          <Typography variant="h5" component="h2" sx={{ fontWeight: 600 }}>
            Sector pulse
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          An AI read of which corners of the market are leading and lagging
          today — and the stocks and headlines driving each move.
        </Typography>
      </Box>

      <Card variant="outlined" sx={{ borderColor: 'divider' }}>
        <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
          {isLoading || !data ? <LoadingState /> : <Loaded data={data} />}
        </CardContent>
      </Card>
    </Box>
  )
}
