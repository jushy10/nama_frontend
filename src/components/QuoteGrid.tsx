import { Avatar, Box, Skeleton, Stack, Typography } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import { stockLogoUrl, type TickerCard } from '@/lib/api'
import { useTickerCards } from '@/lib/queries'

export type QuoteDef = {
  /** Friendly name shown to the user (index name or company). */
  label: string
  /** Tradeable ticker the API can quote (ETF proxy or the stock itself). */
  symbol: string
}

const fmtPrice = (n: number) =>
  n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

const fmtPct = (n: number | null) =>
  n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`

const fmtChange = (n: number | null) =>
  n == null ? '' : `${n >= 0 ? '+' : ''}${n.toFixed(2)}`

// Shared tile chrome. As a link it also carries color/decoration resets so the
// anchor reads like the surrounding card, and a hover cue for its clickability.
const TILE_SX = {
  display: 'block',
  border: 1,
  borderColor: 'divider',
  borderRadius: 2,
  bgcolor: 'action.hover',
  p: 2,
  color: 'inherit',
  textDecoration: 'none',
  transition: 'border-color 150ms',
  '&:hover': { borderColor: 'rgba(99,102,241,0.4)' },
} as const

function QuoteTile({
  def,
  stock,
  linkToStock,
  selected,
  onSelect,
}: {
  def: QuoteDef
  stock: TickerCard | null
  linkToStock: boolean
  selected: boolean
  onSelect?: (symbol: string) => void
}) {
  const pct = stock?.change_percent ?? null
  const up = (pct ?? 0) >= 0
  const color =
    pct == null ? 'text.secondary' : up ? 'success.main' : 'error.main'

  const body = (
    <>
      <Stack
        direction="row"
        sx={{
          justifyContent: 'space-between',
          alignItems: linkToStock ? 'center' : 'baseline',
          gap: 1,
        }}
      >
        <Stack
          direction="row"
          sx={{ alignItems: 'center', gap: 1, minWidth: 0 }}
        >
          {/* Only company tiles carry a logo; the Avatar falls back to the
              ticker's first letter if the logo image fails to load. */}
          {linkToStock && (
            <Avatar
              variant="rounded"
              src={stockLogoUrl(def.symbol)}
              alt={`${def.symbol} logo`}
              slotProps={{
                img: { loading: 'lazy', style: { objectFit: 'contain' } },
              }}
              sx={{
                width: 28,
                height: 28,
                bgcolor: '#fff',
                color: '#111',
                p: 0.5,
                flexShrink: 0,
                fontSize: '0.8rem',
                fontWeight: 700,
              }}
            >
              {def.symbol.charAt(0)}
            </Avatar>
          )}
          <Typography
            variant="subtitle2"
            noWrap
            sx={{ fontWeight: 600, minWidth: 0 }}
          >
            {def.label}
          </Typography>
        </Stack>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ flexShrink: 0 }}
        >
          {def.symbol}
        </Typography>
      </Stack>

      <Typography
        sx={{
          mt: 0.75,
          fontWeight: 700,
          fontSize: '1.15rem',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {stock ? `$${fmtPrice(stock.price)}` : '—'}
      </Typography>

      <Stack
        direction="row"
        sx={{ alignItems: 'center', color, mt: 0.25, minHeight: 24 }}
      >
        {pct != null &&
          (up ? (
            <ArrowDropUpIcon fontSize="small" sx={{ mx: -0.5 }} />
          ) : (
            <ArrowDropDownIcon fontSize="small" sx={{ mx: -0.5 }} />
          ))}
        <Typography
          variant="body2"
          sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
        >
          {fmtPct(pct)}
        </Typography>
        {stock?.change != null && (
          <Typography
            variant="caption"
            sx={{
              ml: 0.75,
              color: 'text.secondary',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {fmtChange(stock.change)}
          </Typography>
        )}
      </Stack>
    </>
  )

  // A selectable tile is a toggle button that elects its symbol (e.g. picking
  // which index the home-page chart shows); a company tile is a link to that
  // ticker's snapshot; anything else is a plain, non-interactive card.
  if (onSelect) {
    return (
      <Box
        component="button"
        type="button"
        onClick={() => onSelect(def.symbol)}
        aria-pressed={selected}
        sx={{
          ...TILE_SX,
          width: '100%',
          textAlign: 'left',
          font: 'inherit',
          cursor: 'pointer',
          ...(selected && {
            borderColor: 'primary.main',
            '&:hover': { borderColor: 'primary.main' },
          }),
        }}
      >
        {body}
      </Box>
    )
  }

  if (linkToStock) {
    return (
      <Box
        component={RouterLink}
        to={`/stocks?symbol=${encodeURIComponent(def.symbol)}`}
        aria-label={`View ${def.label} (${def.symbol}) details`}
        sx={TILE_SX}
      >
        {body}
      </Box>
    )
  }

  return <Box sx={TILE_SX}>{body}</Box>
}

function SkeletonTile({ linkToStock }: { linkToStock: boolean }) {
  return (
    <Box
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        bgcolor: 'action.hover',
        p: 2,
      }}
    >
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
        {linkToStock && (
          <Skeleton
            variant="rounded"
            width={28}
            height={28}
            sx={{ flexShrink: 0 }}
          />
        )}
        <Skeleton width="60%" />
      </Stack>
      <Skeleton width="50%" sx={{ mt: 0.75, fontSize: '1.15rem' }} />
      <Skeleton width="40%" />
    </Box>
  )
}

const GRID_SX = {
  display: 'grid',
  gridTemplateColumns: {
    xs: 'repeat(2, 1fr)',
    sm: 'repeat(3, 1fr)',
    md: 'repeat(4, 1fr)',
  },
  gap: 2,
} as const

/**
 * A self-refreshing grid of price tiles, one per `item`, each showing the day's
 * move. Loads on mount and re-polls every `refreshMs`; a symbol that fails comes
 * back as a dash rather than blanking the row, and a wholesale failure shows a
 * single unavailable note instead of a wall of dashes.
 *
 * With `linkToStock`, each tile carries the company logo and links to that
 * ticker's snapshot (/stocks?symbol=…) — for the Mag 7, where every tile is a
 * real, drill-into-able company. Index proxies leave it off.
 *
 * With `onSelect`, each tile is instead a toggle button and the tile matching
 * `selectedSymbol` is highlighted — for the home page, where picking a tile
 * chooses which index the chart below shows.
 */
export default function QuoteGrid({
  items,
  refreshMs = 60_000,
  linkToStock = false,
  selectedSymbol = null,
  onSelect,
}: {
  items: QuoteDef[]
  refreshMs?: number
  linkToStock?: boolean
  selectedSymbol?: string | null
  onSelect?: (symbol: string) => void
}) {
  const symbols = items.map((i) => i.symbol)
  const { data } = useTickerCards(symbols, { refetchInterval: refreshMs })
  const quotes = data ?? null

  const allFailed = quotes != null && quotes.every((q) => q == null)

  if (allFailed) {
    return (
      <Typography variant="body2" color="text.secondary">
        Live market data is unavailable right now. Please check back shortly.
      </Typography>
    )
  }

  return (
    <Box sx={GRID_SX}>
      {quotes == null
        ? items.map((def) => (
            <SkeletonTile key={def.symbol} linkToStock={linkToStock} />
          ))
        : items.map((def, i) => (
            <QuoteTile
              key={def.symbol}
              def={def}
              stock={quotes[i]}
              linkToStock={linkToStock}
              selected={def.symbol === selectedSymbol}
              onSelect={onSelect}
            />
          ))}
    </Box>
  )
}
