import {
  Box,
  Divider,
  Skeleton,
  Stack,
  Typography,
  useTheme,
} from '@mui/material'
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import { Link as RouterLink } from 'react-router-dom'
import MarketStatusDot from '@/components/MarketStatusDot'
import { fontFamilyMono } from '@/theme'
import { getMarketStatus } from '@/lib/market'
import { useMarketSentiment, useQuoteCards } from '@/lib/queries'
import type { Quote } from '@/lib/api'

/** The three major US indices, tracked via their most liquid ETF proxies — the
 *  same proxies the "Markets today" chart below the fold charts. */
const INDICES: { label: string; symbol: string }[] = [
  { label: 'S&P 500', symbol: 'SPY' },
  { label: 'Nasdaq 100', symbol: 'QQQ' },
  { label: 'Dow Jones', symbol: 'DIA' },
]

const fmtPrice = (n: number) =>
  n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

const fmtPct = (n: number | null) =>
  n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`

/** One index's live line: its name on the left, price + coloured day move on the
 *  right. A symbol that hasn't resolved shows a dash rather than blanking. */
function IndexRow({ label, quote }: { label: string; quote: Quote | null }) {
  const pct = quote?.change_percent ?? null
  const up = (pct ?? 0) >= 0
  const color =
    pct == null ? 'text.secondary' : up ? 'success.main' : 'error.main'

  return (
    <Stack
      direction="row"
      sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1.5 }}
    >
      <Typography sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
        {label}
      </Typography>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline' }}>
        <Typography
          sx={{
            fontFamily: fontFamilyMono,
            fontWeight: 600,
            fontSize: '0.9rem',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {quote ? fmtPrice(quote.price) : '—'}
        </Typography>
        <Stack
          direction="row"
          sx={{
            alignItems: 'center',
            color,
            minWidth: 78,
            justifyContent: 'flex-end',
          }}
        >
          {pct != null &&
            (up ? (
              <ArrowDropUpIcon sx={{ fontSize: 18, mx: -0.5 }} />
            ) : (
              <ArrowDropDownIcon sx={{ fontSize: 18, mx: -0.5 }} />
            ))}
          <Typography
            sx={{
              fontWeight: 700,
              fontSize: '0.85rem',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {fmtPct(pct)}
          </Typography>
        </Stack>
      </Stack>
    </Stack>
  )
}

/** One sentiment read in the footer — a tiny label, a big mono figure in its
 *  band colour, and the band's word beneath. */
function SentimentStat({
  label,
  value,
  caption,
  color,
}: {
  label: string
  value: string
  caption: string
  color: string
}) {
  return (
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography
        sx={{
          fontSize: '0.62rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          color: 'text.secondary',
        }}
      >
        {label}
      </Typography>
      <Stack direction="row" spacing={0.75} sx={{ alignItems: 'baseline' }}>
        <Typography
          sx={{
            fontFamily: fontFamilyMono,
            fontWeight: 700,
            fontSize: '1.15rem',
            lineHeight: 1.1,
            color,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}
        </Typography>
        <Typography
          noWrap
          sx={{
            fontSize: '0.72rem',
            color: 'text.secondary',
            textTransform: 'capitalize',
          }}
        >
          {caption}
        </Typography>
      </Stack>
    </Box>
  )
}

/** The colour a 0–100 Fear & Greed score paints in, on CNN's bands. */
function useFearGreedColor() {
  const theme = useTheme()
  return (score: number): string =>
    score < 25
      ? theme.palette.error.main
      : score < 45
        ? theme.palette.warning.main
        : score <= 55
          ? theme.palette.text.secondary
          : score <= 75
            ? theme.palette.success.light
            : theme.palette.success.main
}

/** How each VIX regime colours its figure — calm reads green, stress red. */
const VIX_REGIME_COLOR: Record<
  string,
  'success.main' | 'warning.main' | 'error.main'
> = {
  low: 'success.main',
  normal: 'success.main',
  elevated: 'warning.main',
  high: 'error.main',
  extreme: 'error.main',
}

/**
 * The hero's live "market at a glance" card: the three major US indices with
 * their day move, and — where the two keyless sources are up — a compact
 * Fear & Greed + VIX read beneath. It puts "how the market is doing" on the
 * first screen, beside the search, so a visitor sees the market before scrolling
 * to the fuller chart and sentiment bands below.
 *
 * Everything here is best-effort: index quotes self-refresh each minute and a
 * symbol that fails shows a dash; the sentiment footer simply drops out when its
 * read is unavailable — the card can only ever add context, never break the hero.
 */
export default function MarketSnapshot() {
  const now = new Date()
  const phase = getMarketStatus(now).phase
  const { data: quotes } = useQuoteCards(
    INDICES.map((i) => i.symbol),
    { source: 'etf', refetchInterval: 60_000 },
  )
  const { data: sentiment, isError: sentimentError } = useMarketSentiment()
  const fearGreedColor = useFearGreedColor()

  const allFailed = quotes != null && quotes.every((q) => q == null)
  const fg = sentiment?.fear_greed ?? null
  const vix = sentiment?.vix ?? null
  const showFooter = !sentimentError && (fg != null || vix != null)

  return (
    <Box
      sx={{
        borderRadius: 3,
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        boxShadow: (theme) =>
          theme.palette.mode === 'dark'
            ? '0 12px 40px -18px rgba(0,0,0,0.7)'
            : '0 12px 40px -20px rgba(15,23,42,0.35)',
        p: { xs: 2.25, sm: 2.5 },
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
        <MarketStatusDot phase={phase} size={8} />
        <Typography
          sx={{
            fontFamily: fontFamilyMono,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.09em',
            fontSize: '0.7rem',
          }}
        >
          Market at a glance
        </Typography>
      </Stack>

      {allFailed ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
          Live market data is unavailable right now.
        </Typography>
      ) : (
        <Stack divider={<Divider flexItem />} spacing={1.25}>
          {INDICES.map((idx, i) =>
            quotes == null ? (
              <Stack
                key={idx.symbol}
                direction="row"
                sx={{ justifyContent: 'space-between' }}
              >
                <Skeleton width={72} />
                <Skeleton width={96} />
              </Stack>
            ) : (
              <IndexRow key={idx.symbol} label={idx.label} quote={quotes[i]} />
            ),
          )}
        </Stack>
      )}

      {showFooter && (
        <>
          <Divider sx={{ my: 2 }} />
          <Stack
            direction="row"
            spacing={2}
            divider={<Divider orientation="vertical" flexItem />}
          >
            {fg != null && (
              <SentimentStat
                label="Fear & Greed"
                value={String(Math.round(fg.score))}
                caption={fg.label}
                color={fearGreedColor(fg.score)}
              />
            )}
            {vix != null && (
              <SentimentStat
                label="Volatility · VIX"
                value={vix.value.toFixed(1)}
                caption={vix.regime}
                color={VIX_REGIME_COLOR[vix.regime] ?? 'text.secondary'}
              />
            )}
          </Stack>
        </>
      )}

      <Typography
        component={RouterLink}
        to="/market/brief"
        sx={{
          display: 'block',
          mt: 2,
          fontSize: '0.78rem',
          fontWeight: 600,
          color: 'primary.main',
          textDecoration: 'none',
          '&:hover': { textDecoration: 'underline' },
        }}
      >
        Read today&apos;s market brief →
      </Typography>
    </Box>
  )
}
