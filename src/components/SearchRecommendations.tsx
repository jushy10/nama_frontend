import { useMemo } from 'react'
import {
  Avatar,
  Box,
  ButtonBase,
  Chip,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material'
import HistoryIcon from '@mui/icons-material/History'
import StarBorderRoundedIcon from '@mui/icons-material/StarBorderRounded'
import WhatshotRoundedIcon from '@mui/icons-material/WhatshotRounded'
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import { stockLogoUrl, type ScreenedStock } from '@/lib/api'
import { useScreener } from '@/hooks/queries'
import { getRecentSymbols } from '@/lib/recentSymbols'

/**
 * Search-landing recommendations shown before a ticker is chosen: a chip row of
 * the visitor's own recent lookups, a curated grid of well-known names, and a
 * live strip of the day's biggest gainers pulled from the screener. Every tile
 * calls `onPick`, which drives the same search path a typed query would.
 */

// ---- Curated "popular" names -----------------------------------------------

// A recognizable spread across sectors, not just the Mag 7 (those get their own
// page). Names are baked in so the row renders instantly with no extra fetch.
const POPULAR: { symbol: string; name: string }[] = [
  { symbol: 'AAPL', name: 'Apple' },
  { symbol: 'MSFT', name: 'Microsoft' },
  { symbol: 'NVDA', name: 'NVIDIA' },
  { symbol: 'AMZN', name: 'Amazon' },
  { symbol: 'GOOGL', name: 'Alphabet' },
  { symbol: 'META', name: 'Meta' },
  { symbol: 'TSLA', name: 'Tesla' },
  { symbol: 'AMD', name: 'AMD' },
  { symbol: 'JPM', name: 'JPMorgan' },
  { symbol: 'V', name: 'Visa' },
  { symbol: 'NFLX', name: 'Netflix' },
  { symbol: 'DIS', name: 'Disney' },
]

// ---- Formatting ------------------------------------------------------------

const fmtPrice = (n: number | null) =>
  n == null
    ? '—'
    : n.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })

const fmtPct = (n: number | null) =>
  n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`

// ---- Shared bits -----------------------------------------------------------

/** A logo avatar with the ticker's first letter as fallback. */
function TickerLogo({ symbol, size = 32 }: { symbol: string; size?: number }) {
  return (
    <Avatar
      variant="rounded"
      src={stockLogoUrl(symbol)}
      alt={`${symbol} logo`}
      slotProps={{ img: { loading: 'lazy', style: { objectFit: 'contain' } } }}
      sx={{
        width: size,
        height: size,
        bgcolor: '#fff',
        color: '#111',
        p: 0.5,
        flexShrink: 0,
      }}
    >
      {symbol.charAt(0)}
    </Avatar>
  )
}

/** Section header: a muted icon + label sitting above one recommendation block. */
function SectionLabel({
  icon,
  children,
}: {
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Stack
      direction="row"
      spacing={0.75}
      sx={{ alignItems: 'center', color: 'text.secondary', mb: 1.5 }}
    >
      <Box
        sx={{ display: 'inline-flex', fontSize: 18, '& svg': { fontSize: 18 } }}
      >
        {icon}
      </Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
        {children}
      </Typography>
    </Stack>
  )
}

// ---- Popular tile ----------------------------------------------------------

function PopularTile({
  symbol,
  name,
  onPick,
}: {
  symbol: string
  name: string
  onPick: (symbol: string) => void
}) {
  return (
    <ButtonBase
      onClick={() => onPick(symbol)}
      aria-label={`View ${symbol}`}
      sx={{
        justifyContent: 'flex-start',
        textAlign: 'left',
        gap: 1.25,
        px: 1.5,
        py: 1,
        borderRadius: 2,
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        transition: (t) =>
          t.transitions.create(
            ['border-color', 'background-color', 'transform'],
            {
              duration: 150,
            },
          ),
        '&:hover': {
          borderColor: 'primary.main',
          bgcolor: 'action.hover',
          transform: 'translateY(-1px)',
        },
        '@media (prefers-reduced-motion: reduce)': {
          transition: 'none',
          '&:hover': { transform: 'none' },
        },
      }}
    >
      <TickerLogo symbol={symbol} size={30} />
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, lineHeight: 1.2 }}>
          {symbol}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: 96,
          }}
        >
          {name}
        </Typography>
      </Box>
    </ButtonBase>
  )
}

// ---- Trending tile ---------------------------------------------------------

function TrendingTile({
  stock,
  onPick,
}: {
  stock: ScreenedStock
  onPick: (symbol: string) => void
}) {
  const pct = stock.change_percent
  const up = (pct ?? 0) >= 0
  const moveColor =
    pct == null ? 'text.secondary' : up ? 'success.main' : 'error.main'
  return (
    <ButtonBase
      onClick={() => onPick(stock.symbol)}
      aria-label={`View ${stock.symbol}`}
      sx={{
        width: '100%',
        justifyContent: 'flex-start',
        textAlign: 'left',
        gap: 1.5,
        p: 1.5,
        borderRadius: 2,
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        transition: (t) =>
          t.transitions.create(
            ['border-color', 'background-color', 'transform'],
            {
              duration: 150,
            },
          ),
        '&:hover': {
          borderColor: 'primary.main',
          bgcolor: 'action.hover',
          transform: 'translateY(-1px)',
        },
        '@media (prefers-reduced-motion: reduce)': {
          transition: 'none',
          '&:hover': { transform: 'none' },
        },
      }}
    >
      <TickerLogo symbol={stock.symbol} size={36} />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontWeight: 700, lineHeight: 1.2 }}>
          {stock.symbol}
        </Typography>
        {stock.name && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {stock.name}
          </Typography>
        )}
      </Box>
      <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
        <Typography
          sx={{
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.2,
          }}
        >
          ${fmtPrice(stock.price)}
        </Typography>
        <Stack
          direction="row"
          sx={{
            alignItems: 'center',
            justifyContent: 'flex-end',
            color: moveColor,
          }}
        >
          {pct != null &&
            (up ? (
              <ArrowDropUpIcon fontSize="small" sx={{ mx: -0.5 }} />
            ) : (
              <ArrowDropDownIcon fontSize="small" sx={{ mx: -0.5 }} />
            ))}
          <Typography
            variant="body2"
            sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
          >
            {fmtPct(pct)}
          </Typography>
        </Stack>
      </Box>
    </ButtonBase>
  )
}

// ---- Landing ---------------------------------------------------------------

export default function SearchRecommendations({
  onPick,
}: {
  onPick: (symbol: string) => void
}) {
  const recent = useMemo(getRecentSymbols, [])

  // One lightweight screener call, no filters, top movers. Re-poll on the same
  // minute cadence the rest of the app uses. On error the strip just hides —
  // a "trending" nicety shouldn't put a red alert on the empty state.
  const trendingQuery = useScreener(
    { index: null, sector: null, limit: 6 },
    { refetchInterval: 60_000 },
  )
  const trending = trendingQuery.data?.gainers.slice(0, 6) ?? []

  return (
    <Stack spacing={5}>
      {recent.length > 0 && (
        <Box>
          <SectionLabel icon={<HistoryIcon />}>Recently viewed</SectionLabel>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
            {recent.map((sym) => (
              <Chip
                key={sym}
                label={sym}
                variant="outlined"
                onClick={() => onPick(sym)}
                avatar={<TickerLogo symbol={sym} size={24} />}
                sx={{
                  fontWeight: 600,
                  borderColor: 'divider',
                  '& .MuiChip-avatar': { width: 24, height: 24 },
                  '&:hover': {
                    borderColor: 'primary.main',
                    bgcolor: 'action.hover',
                  },
                }}
              />
            ))}
          </Stack>
        </Box>
      )}

      <Box>
        <SectionLabel icon={<StarBorderRoundedIcon />}>
          Popular stocks
        </SectionLabel>
        <Box
          sx={{
            display: 'grid',
            gap: 1.25,
            gridTemplateColumns: {
              xs: 'repeat(2, minmax(0, 1fr))',
              sm: 'repeat(3, minmax(0, 1fr))',
              md: 'repeat(4, minmax(0, 1fr))',
            },
          }}
        >
          {POPULAR.map((p) => (
            <PopularTile
              key={p.symbol}
              symbol={p.symbol}
              name={p.name}
              onPick={onPick}
            />
          ))}
        </Box>
      </Box>

      {(trendingQuery.isLoading || trending.length > 0) && (
        <Box>
          <SectionLabel icon={<WhatshotRoundedIcon />}>
            Trending today
          </SectionLabel>
          <Box
            sx={{
              display: 'grid',
              gap: 1.25,
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, minmax(0, 1fr))',
                lg: 'repeat(3, minmax(0, 1fr))',
              },
            }}
          >
            {trendingQuery.isLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton
                    key={i}
                    variant="rounded"
                    height={68}
                    sx={{ borderRadius: 2 }}
                  />
                ))
              : trending.map((s) => (
                  <TrendingTile key={s.symbol} stock={s} onPick={onPick} />
                ))}
          </Box>
        </Box>
      )}
    </Stack>
  )
}
