import {
  Box,
  Divider,
  Link,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined'
import AiReadHeader from '@/components/AiReadHeader'
import { sleekCardSx } from '@/components/homeCard'
import { fontFamilyMono } from '@/theme'
import { useSectorAnalysis } from '@/hooks/queries'
import type {
  SectorAnalysis,
  SectorHeadline,
  SectorHighlight,
  SectorMover,
} from '@/lib/api'

/** Signed percent, e.g. +1.84% / -0.64%. */
const fmtPct = (n: number | null) =>
  n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`

const moveColor = (n: number | null) =>
  n == null ? 'text.secondary' : n >= 0 ? 'success.main' : 'error.main'

/**
 * The stocks that drove the sector, as compact chips (ticker + its real day
 * move, mono and colour-coded), each linking to its own stock page — the
 * grounded "why" behind the note. Hovering a chip reveals the company name.
 */
function MoverChips({ movers }: { movers: SectorMover[] }) {
  return (
    <Stack
      direction="row"
      sx={{ flexWrap: 'wrap', gap: 0.75, mt: 1.25 }}
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
              gap: 0.6,
              px: 1,
              py: 0.4,
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
                fontFamily: fontFamilyMono,
                fontSize: '0.78rem',
                fontWeight: 600,
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
 * The catalyst headlines behind the move: a subtle line per headline, linking out
 * to the source article when one is available. Best-effort — often absent.
 */
function Catalysts({ headlines }: { headlines: SectorHeadline[] }) {
  return (
    <Stack spacing={0.5} sx={{ mt: 1.25 }}>
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

/** One leader/laggard: sector name + its real day move (mono), the AI's note,
 *  then the grounded drivers behind it — the moving stocks and any catalyst. */
function HighlightRow({ h }: { h: SectorHighlight }) {
  // Guard against a not-yet-deployed backend that omits the newer fields.
  const movers = h.movers ?? []
  const headlines = h.headlines ?? []
  return (
    <Box>
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: 'baseline', justifyContent: 'space-between' }}
      >
        <Typography sx={{ fontWeight: 700, lineHeight: 1.3 }}>
          {h.sector}
        </Typography>
        <Typography
          sx={{
            fontFamily: fontFamilyMono,
            fontWeight: 700,
            fontSize: '0.95rem',
            flexShrink: 0,
            color: moveColor(h.change_percent),
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {fmtPct(h.change_percent)}
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        {h.note}
      </Typography>
      {movers.length > 0 && <MoverChips movers={movers} />}
      {headlines.length > 0 && <Catalysts headlines={headlines} />}
    </Box>
  )
}

/** A titled group of highlights (Leading / Lagging), its trend arrow + label
 *  colour-coded to its side, then its rows split by hairlines. */
function HighlightGroup({
  title,
  up,
  items,
}: {
  title: string
  up: boolean
  items: SectorHighlight[]
}) {
  const color = up ? 'success.main' : 'error.main'
  return (
    <Box>
      <Stack
        direction="row"
        spacing={0.75}
        sx={{ alignItems: 'center', color, mb: 1.75 }}
      >
        {up ? (
          <TrendingUpIcon fontSize="small" />
        ) : (
          <TrendingDownIcon fontSize="small" />
        )}
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
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
        <Stack spacing={2} divider={<Divider flexItem />}>
          {items.map((h) => (
            <HighlightRow key={h.symbol} h={h} />
          ))}
        </Stack>
      )}
    </Box>
  )
}

/** The loaded card body: the summary lede, the leading/lagging groups, then the
 *  service disclaimer. The risk posture rides in the header as a `TonePill`. */
function Loaded({ data }: { data: SectorAnalysis }) {
  return (
    <Stack spacing={2.5}>
      <Typography sx={{ fontSize: '1.02rem', lineHeight: 1.65 }}>
        {data.summary}
      </Typography>

      <Divider />

      <Stack spacing={2.5} divider={<Divider flexItem />}>
        <HighlightGroup title="Leading" up items={data.leaders} />
        <HighlightGroup title="Lagging" up={false} items={data.laggards} />
      </Stack>

      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block' }}
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
      <Skeleton variant="text" width="100%" />
      <Skeleton variant="text" width="85%" />
      <Divider />
      {[0, 1].map((c) => (
        <Stack key={c} spacing={1}>
          <Skeleton variant="text" width={90} />
          <Skeleton variant="text" width="70%" />
          <Skeleton variant="text" width="55%" />
        </Stack>
      ))}
    </Stack>
  )
}

/**
 * Home-page "Sector pulse" widget: an AI read of which market sectors are leading
 * and lagging today, with the risk posture that rotation implies (shown as the
 * header's `TonePill`) and the stocks and headlines driving each move. The read
 * is best-effort — if the model is briefly unavailable or not configured (a
 * 502/503), the query doesn't retry and the whole widget quietly hides rather
 * than showing a broken card.
 */
export default function SectorPulse() {
  const { data, isLoading, isError } = useSectorAnalysis()
  if (isError) return null
  return (
    <Box>
      <AiReadHeader title="Sector pulse" tone={data?.tone} />
      <Box sx={(theme) => ({ ...sleekCardSx(theme), p: { xs: 2.5, sm: 3 } })}>
        {isLoading || !data ? <LoadingState /> : <Loaded data={data} />}
      </Box>
    </Box>
  )
}
