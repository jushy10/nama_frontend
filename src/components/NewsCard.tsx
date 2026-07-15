import { Fragment, useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Typography,
} from '@mui/material'
import NewspaperRoundedIcon from '@mui/icons-material/NewspaperRounded'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import NorthEastRoundedIcon from '@mui/icons-material/NorthEastRounded'
import SectionHeading from '@/components/SectionHeading'
import type { NewsArticle, StockNews } from '@/lib/api'

// The rail's brand accent — a faint blue→gold line down the timeline, echoing the
// app bar's ticker line. Written in rgba so it reads the same on light and dark.
const RAIL_LINE =
  'linear-gradient(180deg, rgba(79,131,230,0.5) 0%, rgba(215,167,57,0.45) 100%)'
// The latest node's fill: the gold→blue wordmark gradient, so the freshest
// headline is the one dot that carries the house colours.
const LEAD_NODE = 'linear-gradient(135deg, #d7a739 0%, #4f83e6 100%)'

// How many headlines the feed shows before the "show all" expander — keeps the
// initial list tight when a heavy name has dozens of stories.
const COLLAPSED_ROWS = 8

const MINUTE = 60_000
const HOUR = 3_600_000
const DAY = 86_400_000

/** ISO-8601 → epoch ms, or null when unparseable (a defensive guard on a
 *  best-effort upstream field). */
function parseMs(iso: string): number | null {
  const ms = Date.parse(iso)
  return Number.isNaN(ms) ? null : ms
}

/** A newspaper-style relative stamp: "just now" / "5m ago" / "3h ago" /
 *  "Yesterday" / "4d ago", then an absolute date past a week (with the year once
 *  it's not the current one). Empty string when the time can't be read. */
function relativeTime(iso: string, now: number): string {
  const ms = parseMs(iso)
  if (ms == null) return ''
  const diff = now - ms
  if (diff < MINUTE) return 'just now'
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`
  if (diff < 7 * DAY) {
    const days = Math.floor(diff / DAY)
    return days === 1 ? 'Yesterday' : `${days}d ago`
  }
  const date = new Date(ms)
  const sameYear = date.getFullYear() === new Date(now).getFullYear()
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}

/** The day-bucket a story falls in, by local calendar day — the timeline's
 *  structural markers. */
type Bucket = 'Today' | 'Yesterday' | 'This week' | 'Earlier'

function dayBucket(iso: string, now: number): Bucket {
  const ms = parseMs(iso)
  if (ms == null) return 'Earlier'
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const t = start.getTime()
  if (ms >= t) return 'Today'
  if (ms >= t - DAY) return 'Yesterday'
  if (ms >= t - 6 * DAY) return 'This week'
  return 'Earlier'
}

/** The freshness-tinted timeline node. The latest story carries the gold→blue
 *  gradient with a soft glow; a story under a day old is solid blue, one under a
 *  week the lighter blue, and older ones fade to the muted disabled tone. The
 *  paper-coloured ring makes the rail read as passing cleanly behind the dot. */
function Node({
  iso,
  isLead,
  now,
}: {
  iso: string
  isLead: boolean
  now: number
}) {
  const age = now - (parseMs(iso) ?? now)
  return (
    <Box
      aria-hidden
      sx={(theme) => ({
        mt: isLead ? '7px' : '6px',
        width: isLead ? 12 : 10,
        height: isLead ? 12 : 10,
        borderRadius: '50%',
        flexShrink: 0,
        background: isLead
          ? LEAD_NODE
          : age < DAY
            ? theme.palette.primary.main
            : age < 7 * DAY
              ? theme.palette.primary.light
              : theme.palette.text.disabled,
        boxShadow: isLead
          ? `0 0 0 3px ${theme.palette.background.paper}, 0 0 10px 1px ${theme.palette.primary.main}55`
          : `0 0 0 3px ${theme.palette.background.paper}`,
      })}
    />
  )
}

/** A story's preview image — best-effort, so it quietly removes itself if the
 *  source URL 404s. A video item overlays a play badge (and, lacking an image,
 *  shows a plain play tile so the row still reads as video). */
function Thumb({
  url,
  video,
  size,
}: {
  url: string | null
  video: boolean
  size: number
}) {
  const [broken, setBroken] = useState(false)
  const showImg = !!url && !broken

  if (!showImg && !video) return null

  return (
    <Box sx={{ position: 'relative', flexShrink: 0, lineHeight: 0 }}>
      {showImg ? (
        <Box
          component="img"
          src={url as string}
          alt=""
          loading="lazy"
          onError={() => setBroken(true)}
          sx={{
            width: size,
            height: size,
            objectFit: 'cover',
            borderRadius: 2,
            display: 'block',
            bgcolor: 'action.hover',
          }}
        />
      ) : (
        <Box
          sx={{
            width: size,
            height: size,
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'action.hover',
            color: 'text.secondary',
          }}
        >
          <PlayArrowRoundedIcon fontSize="small" />
        </Box>
      )}
      {video && showImg && (
        <Box
          sx={{
            position: 'absolute',
            left: 4,
            bottom: 4,
            width: 20,
            height: 20,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'rgba(0,0,0,0.6)',
            color: '#fff',
          }}
        >
          <PlayArrowRoundedIcon sx={{ fontSize: '0.9rem' }} />
        </Box>
      )}
    </Box>
  )
}

/** A day marker on the rail — an uppercase bucket label beside a small gold
 *  diamond that breaks the timeline into Today / Yesterday / This week / Earlier. */
function BucketLabel({ label }: { label: Bucket }) {
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', py: 1 }}>
      <Box
        sx={{
          width: 32,
          flexShrink: 0,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <Box
          aria-hidden
          sx={(theme) => ({
            width: 7,
            height: 7,
            transform: 'rotate(45deg)',
            bgcolor: 'secondary.main',
            boxShadow: `0 0 0 3px ${theme.palette.background.paper}`,
          })}
        />
      </Box>
      <Typography
        variant="caption"
        sx={{
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontWeight: 700,
          fontSize: '0.68rem',
          color: 'text.secondary',
        }}
      >
        {label}
      </Typography>
    </Stack>
  )
}

/** One headline on the timeline: the node, a publisher · time dateline, the
 *  headline, and (for the lead) its summary — with a best-effort thumbnail on the
 *  right. The whole row links out to the source in a new tab; a story with no
 *  link renders as a plain row. */
function ArticleRow({
  article,
  isLead,
  now,
}: {
  article: NewsArticle
  isLead: boolean
  now: number
}) {
  const rel = relativeTime(article.published_at, now)
  const hasLink = !!article.link
  const linkProps = hasLink
    ? {
        component: 'a' as const,
        href: article.link as string,
        target: '_blank',
        rel: 'noopener noreferrer',
      }
    : { component: 'div' as const }

  return (
    <Box
      {...linkProps}
      sx={{
        display: 'flex',
        gap: 1.5,
        alignItems: 'flex-start',
        textDecoration: 'none',
        color: 'inherit',
        borderRadius: 2,
        mx: -1,
        px: 1,
        py: 1,
        transition: 'background-color 0.15s ease',
        cursor: hasLink ? 'pointer' : 'default',
        '&:hover': hasLink ? { bgcolor: 'action.hover' } : undefined,
        '&:hover .news-headline': hasLink
          ? { color: 'primary.main' }
          : undefined,
        '&:hover .news-arrow': hasLink
          ? { opacity: 1, transform: 'translate(2px, -2px)' }
          : undefined,
        '&:focus-visible': {
          outline: '2px solid',
          outlineColor: 'primary.main',
          outlineOffset: 2,
        },
      }}
    >
      <Box
        sx={{
          width: 32,
          flexShrink: 0,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <Node iso={article.published_at} isLead={isLead} now={now} />
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack
          direction="row"
          spacing={0.75}
          sx={{ alignItems: 'center', flexWrap: 'wrap', mb: 0.25 }}
        >
          {article.publisher && (
            <Typography
              variant="caption"
              sx={{
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontWeight: 700,
                color: 'text.secondary',
              }}
            >
              {article.publisher}
            </Typography>
          )}
          {article.publisher && rel && (
            <Box
              component="span"
              sx={{ color: 'text.disabled', fontSize: '0.7rem' }}
            >
              ·
            </Box>
          )}
          {rel && (
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {rel}
            </Typography>
          )}
          {article.is_video && (
            <Box
              component="span"
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.25,
                px: 0.6,
                py: 0.1,
                borderRadius: 1,
                bgcolor: 'action.hover',
                color: 'text.secondary',
                fontSize: '0.62rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              <PlayArrowRoundedIcon sx={{ fontSize: '0.8rem' }} />
              Video
            </Box>
          )}
          {hasLink && (
            <NorthEastRoundedIcon
              className="news-arrow"
              sx={{
                fontSize: '0.85rem',
                color: 'primary.main',
                opacity: 0,
                transition: 'opacity 0.15s ease, transform 0.15s ease',
              }}
            />
          )}
        </Stack>

        <Typography
          className="news-headline"
          variant={isLead ? 'subtitle1' : 'body2'}
          sx={{
            fontWeight: isLead ? 700 : 600,
            lineHeight: 1.35,
            color: 'text.primary',
            transition: 'color 0.15s ease',
            display: '-webkit-box',
            WebkitLineClamp: isLead ? 3 : 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {article.title}
        </Typography>

        {isLead && article.summary && (
          <Typography
            variant="body2"
            sx={{
              mt: 0.5,
              color: 'text.secondary',
              lineHeight: 1.5,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {article.summary}
          </Typography>
        )}
      </Box>

      <Thumb
        url={article.thumbnail_url}
        video={article.is_video}
        size={isLead ? 72 : 56}
      />
    </Box>
  )
}

/** The header's freshness pill — the newest story's recency, its dot tinted by
 *  how fresh that is (green under a day, gold under a week, muted beyond). */
function FreshnessPill({ iso, now }: { iso: string; now: number }) {
  const rel = relativeTime(iso, now)
  if (!rel) return null
  const age = now - (parseMs(iso) ?? now)
  const dot =
    age < DAY
      ? 'success.main'
      : age < 7 * DAY
        ? 'secondary.main'
        : 'text.disabled'
  return (
    <Box
      sx={{
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        px: 1.25,
        py: 0.5,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'action.hover',
      }}
    >
      <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: dot }} />
      <Typography
        variant="caption"
        sx={{ fontWeight: 700, color: 'text.secondary', whiteSpace: 'nowrap' }}
      >
        Latest {rel}
      </Typography>
    </Box>
  )
}

/**
 * The News tab body — a stock's recent headlines as a chronological timeline. The
 * newest story leads (richer, with its summary); the rest are compact rows down a
 * blue→gold rail, grouped by day marker (Today / Yesterday / This week / Earlier),
 * each linking out to its source. A stock with no recent news shows an empty state.
 */
export default function NewsCard({ data }: { data: StockNews }) {
  const [expanded, setExpanded] = useState(false)
  const now = Date.now()

  if (data.articles.length === 0) {
    return (
      <Card variant="outlined" sx={{ borderColor: 'divider' }}>
        <CardContent sx={{ p: { xs: 2.5, sm: 3 }, textAlign: 'center' }}>
          <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
            No recent news
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            We don&apos;t have any recent headlines for {data.symbol} yet.
          </Typography>
        </CardContent>
      </Card>
    )
  }

  const visible = expanded
    ? data.articles
    : data.articles.slice(0, COLLAPSED_ROWS)

  let lastBucket: Bucket | null = null

  return (
    <Card variant="outlined" sx={{ borderColor: 'divider' }}>
      <CardContent
        sx={{
          p: { xs: 2, sm: 2.5 },
          '&:last-child': { pb: { xs: 2, sm: 2.5 } },
        }}
      >
        <SectionHeading
          component="h2"
          icon={<NewspaperRoundedIcon fontSize="small" />}
          title="In the news"
          subtitle={`Recent headlines about ${data.symbol}, newest first.`}
          action={
            data.latest ? (
              <FreshnessPill iso={data.latest.published_at} now={now} />
            ) : undefined
          }
        />

        {/* The timeline: a single continuous rail behind the nodes, with the
            stories threaded down it newest-first. The rail is absolutely
            positioned so it reads as one line the day markers punctuate. */}
        <Box sx={{ position: 'relative', mt: 1.75 }}>
          <Box
            aria-hidden
            sx={{
              position: 'absolute',
              left: 15,
              top: 10,
              bottom: 10,
              width: '2px',
              borderRadius: 1,
              background: RAIL_LINE,
            }}
          />
          <Box sx={{ position: 'relative' }}>
            {visible.map((article, i) => {
              const bucket = dayBucket(article.published_at, now)
              const showBucket = bucket !== lastBucket
              lastBucket = bucket
              return (
                <Fragment key={article.id}>
                  {showBucket && <BucketLabel label={bucket} />}
                  <ArticleRow article={article} isLead={i === 0} now={now} />
                </Fragment>
              )
            })}
          </Box>
        </Box>

        {data.articles.length > COLLAPSED_ROWS && (
          <Button
            size="small"
            onClick={() => setExpanded((e) => !e)}
            sx={{ mt: 1.5 }}
          >
            {expanded
              ? 'Show fewer'
              : `Show all ${data.articles.length} headlines`}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
