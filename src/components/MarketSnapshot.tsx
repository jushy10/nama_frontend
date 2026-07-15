import {
  Box,
  Divider,
  Skeleton,
  Stack,
  Typography,
  useTheme,
} from '@mui/material'
import type { SxProps, Theme } from '@mui/material/styles'
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import { Link as RouterLink } from 'react-router-dom'
import MarketStatusDot from '@/components/MarketStatusDot'
import FearGreedGauge from '@/components/FearGreedGauge'
import { fontFamilyMono } from '@/theme'
import { getMarketStatus } from '@/lib/market'
import { useMarketSentiment, useQuoteCards } from '@/lib/queries'
import type { FearGreedSnapshot, Quote, VixSnapshot } from '@/lib/api'

/** The three major US indices, tracked via their most liquid ETF proxies — the
 *  same proxies the "Markets today" chart below the fold charts. */
const INDICES: { label: string; symbol: string }[] = [
  { label: 'S&P 500', symbol: 'SPY' },
  { label: 'Nasdaq 100', symbol: 'QQQ' },
  { label: 'Dow Jones', symbol: 'DIA' },
]

/** Shared style for the two small section labels above each sentiment gauge. */
const GAUGE_LABEL_SX: SxProps<Theme> = {
  fontSize: '0.62rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  color: 'text.secondary',
}

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

/** The Fear & Greed leg: the compact semicircular dial (its own score + band
 *  label live in the well), under a small section label. */
function FearGreedMini({ fg }: { fg: FearGreedSnapshot }) {
  return (
    <Box sx={{ width: { xs: '100%', sm: 152 }, flexShrink: 0 }}>
      <Typography
        sx={{ ...GAUGE_LABEL_SX, textAlign: { xs: 'center', sm: 'left' } }}
      >
        Fear &amp; Greed
      </Typography>
      <FearGreedGauge score={fg.score} label={fg.label} maxWidth={152} />
    </Box>
  )
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

/** The volatility leg: the VIX level + regime, and the calm→turbulent scale with
 *  a marker riding it at the current level (VIX rarely prints above 50). */
function VixMini({ vix }: { vix: VixSnapshot }) {
  const theme = useTheme()
  const regimeColor = VIX_REGIME_COLOR[vix.regime] ?? 'text.secondary'
  const pct = Math.max(0, Math.min(1, vix.value / 50)) * 100

  return (
    <Box sx={{ flex: 1, minWidth: 0, alignSelf: { sm: 'center' } }}>
      <Typography sx={GAUGE_LABEL_SX}>Volatility</Typography>
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: 'baseline', mt: 0.25, mb: 1.25 }}
      >
        <Typography
          sx={{
            fontFamily: fontFamilyMono,
            fontWeight: 700,
            fontSize: '1.4rem',
            lineHeight: 1,
            color: regimeColor,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {vix.value.toFixed(1)}
        </Typography>
        <Typography
          sx={{
            fontSize: '0.72rem',
            color: 'text.secondary',
            textTransform: 'capitalize',
          }}
        >
          {vix.regime}
        </Typography>
      </Stack>
      <Box
        sx={{
          position: 'relative',
          height: 8,
          borderRadius: 4,
          background: `linear-gradient(90deg, ${theme.palette.success.main} 0%, ${theme.palette.warning.main} 55%, ${theme.palette.error.main} 100%)`,
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: `${pct}%`,
            width: 14,
            height: 14,
            borderRadius: '50%',
            transform: 'translate(-50%, -50%)',
            bgcolor: 'background.paper',
            border: 2,
            borderColor: 'text.primary',
            boxShadow: 1,
          }}
        />
      </Box>
      <Stack direction="row" sx={{ justifyContent: 'space-between', mt: 0.5 }}>
        <Typography sx={{ fontSize: '0.62rem', color: 'text.secondary' }}>
          Calm
        </Typography>
        <Typography sx={{ fontSize: '0.62rem', color: 'text.secondary' }}>
          Turbulent
        </Typography>
      </Stack>
    </Box>
  )
}

/**
 * The hero's live "market at a glance" card: the three major US indices with
 * their day move, and — where the two keyless sources are up — the market's mood
 * beneath, shown as a compact Fear & Greed dial beside the VIX calm→turbulent
 * scale. It puts "how the market is doing" on the first screen, beside the
 * search, so a visitor reads the market before scrolling to the fuller bands.
 *
 * Everything here is best-effort: index quotes self-refresh each minute and a
 * symbol that fails shows a dash; the sentiment gauges simply drop out when their
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

  const allFailed = quotes != null && quotes.every((q) => q == null)
  const fg = sentiment?.fear_greed ?? null
  const vix = sentiment?.vix ?? null
  const showSentiment = !sentimentError && (fg != null || vix != null)

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

      {showSentiment && (
        <>
          <Divider sx={{ my: 2 }} />
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              gap: { xs: 2, sm: 2.5 },
              alignItems: { xs: 'stretch', sm: 'flex-start' },
            }}
          >
            {fg != null && <FearGreedMini fg={fg} />}
            {vix != null && <VixMini vix={vix} />}
          </Box>
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
