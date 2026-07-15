import { useNavigate } from 'react-router-dom'
import {
  Avatar,
  Box,
  Card,
  CardContent,
  Container,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material'
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch'
import BandHeader from '@/components/BandHeader'
import { stockLogoUrl, type StockSearchResult } from '@/lib/api'
import { useStockSearch } from '@/lib/queries'

// How many names each list shows. The backend ranks the whole mega-cap slice by
// the blend; we only ever paint the leaders.
const TOP_N = 10

// Fixed widths that keep the two metric columns aligned across the column header,
// the loaded rows and the skeletons — the same lockstep trick the screener uses.
const RANK_W = 20
const METRIC_W = 62

/** Signed percent to one decimal, matching the screener's growth formatting. */
const fmtPct = (n: number | null) =>
  n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`

/** Growth is directional: green when positive, red when negative, dim when absent. */
const growthColor = (n: number | null) =>
  n == null ? 'text.secondary' : n >= 0 ? 'success.main' : 'error.main'

/** The two figures a list surfaces per row — its label and how to pull it off a
 *  screened row. Trailing lists read the `*_yoy` pair; forward lists the
 *  `forward_*_yoy` pair. */
type Metric = { label: string; value: (s: StockSearchResult) => number | null }

/** One growth list's identity: heading, the blend it's sorted by, and the two
 *  component figures it shows. `sort` is a server-side blend (equal-weight
 *  revenue + EPS growth) with no column of its own — the same key the screener's
 *  "Sort by" menu exposes. */
type GrowthList = {
  title: string
  caption: string
  sort: 'growth' | 'forward_growth'
  metrics: [Metric, Metric]
}

const TRAILING: GrowthList = {
  title: 'Trailing growth',
  caption: 'Latest reported revenue + EPS, year over year',
  sort: 'growth',
  metrics: [
    { label: 'Rev', value: (s) => s.revenue_growth_yoy },
    { label: 'EPS', value: (s) => s.eps_growth_yoy },
  ],
}

const FORWARD: GrowthList = {
  title: 'Forward growth',
  caption: 'Expected revenue + EPS, next fiscal year (analyst consensus)',
  sort: 'forward_growth',
  metrics: [
    { label: 'Rev', value: (s) => s.forward_revenue_growth_yoy },
    { label: 'EPS', value: (s) => s.forward_eps_growth_yoy },
  ],
}

/** Company logo in a white rounded tile, falling back to the ticker's initial —
 *  the screener's `StockLogo`, shrunk for a denser list. */
function LeaderLogo({ symbol }: { symbol: string }) {
  return (
    <Avatar
      variant="rounded"
      src={stockLogoUrl(symbol)}
      alt={`${symbol} logo`}
      slotProps={{ img: { loading: 'lazy', style: { objectFit: 'contain' } } }}
      sx={{ width: 28, height: 28, bgcolor: '#fff', color: '#111', p: 0.4 }}
    >
      {symbol.charAt(0)}
    </Avatar>
  )
}

/** One ranked name: position, logo, ticker/name, then the two growth figures.
 *  The whole row opens the stock's detail page (keyboard-reachable, like the
 *  screener's rows). */
function LeaderRow({
  stock,
  rank,
  metrics,
  onSelect,
}: {
  stock: StockSearchResult
  rank: number
  metrics: [Metric, Metric]
  onSelect: (ticker: string) => void
}) {
  return (
    <Box
      role="link"
      tabIndex={0}
      aria-label={`View ${stock.ticker} details`}
      onClick={() => onSelect(stock.ticker)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(stock.ticker)
        }
      }}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        px: 1,
        py: 0.85,
        borderRadius: 1.5,
        cursor: 'pointer',
        transition: 'background-color 120ms ease',
        '&:hover': { bgcolor: 'action.hover' },
        '&:focus-visible': {
          outline: 2,
          outlineColor: 'primary.main',
          outlineOffset: -2,
        },
      }}
    >
      <Typography
        variant="body2"
        sx={{
          width: RANK_W,
          flexShrink: 0,
          textAlign: 'right',
          fontWeight: 600,
          color: 'text.secondary',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {rank}
      </Typography>
      <LeaderLogo symbol={stock.ticker} />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontWeight: 700, lineHeight: 1.2 }}>
          {stock.ticker}
        </Typography>
        {stock.name && (
          <Typography
            variant="caption"
            color="text.secondary"
            noWrap
            sx={{ display: 'block' }}
          >
            {stock.name}
          </Typography>
        )}
      </Box>
      {metrics.map((m) => {
        const v = m.value(stock)
        return (
          <Typography
            key={m.label}
            sx={{
              width: METRIC_W,
              flexShrink: 0,
              textAlign: 'right',
              fontWeight: 600,
              color: growthColor(v),
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {fmtPct(v)}
          </Typography>
        )
      })}
    </Box>
  )
}

/** Placeholder row while the first read lands — mirrors `LeaderRow`'s layout so
 *  the list doesn't reflow when the data arrives. */
function SkeletonRow() {
  return (
    <Box
      sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 1, py: 0.85 }}
    >
      <Skeleton variant="text" width={RANK_W - 6} sx={{ flexShrink: 0 }} />
      <Skeleton
        variant="rounded"
        width={28}
        height={28}
        sx={{ flexShrink: 0 }}
      />
      <Box sx={{ flex: 1 }}>
        <Skeleton width={52} />
        <Skeleton width={120} />
      </Box>
      <Skeleton width={40} sx={{ flexShrink: 0 }} />
      <Skeleton width={40} sx={{ flexShrink: 0 }} />
    </Box>
  )
}

/** The two right-aligned metric labels over the list, in lockstep with the rows'
 *  metric columns. */
function ColumnHeader({ metrics }: { metrics: [Metric, Metric] }) {
  return (
    <Box
      sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 1, pb: 0.5 }}
    >
      <Box sx={{ flex: 1 }} />
      {metrics.map((m) => (
        <Typography
          key={m.label}
          variant="caption"
          sx={{
            width: METRIC_W,
            flexShrink: 0,
            textAlign: 'right',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'text.secondary',
          }}
        >
          {m.label}
        </Typography>
      ))}
    </Box>
  )
}

/** One growth list as a card: its heading, the Rev/EPS column labels, then the
 *  top-N mega caps ranked by that list's blend. DB-backed and cheap, so this
 *  shows a compact note on the rare error rather than vanishing. */
function GrowthLeadersCard({ list }: { list: GrowthList }) {
  const navigate = useNavigate()
  const { data, isLoading, isError } = useStockSearch({
    q: null,
    sectors: [],
    industries: [],
    inSp500: false,
    inNasdaq100: false,
    marketCaps: ['mega'],
    sort: list.sort,
    order: 'desc',
    limit: TOP_N,
    offset: 0,
  })
  const rows = data?.results ?? []
  const openStock = (ticker: string) =>
    navigate(`/search?symbol=${encodeURIComponent(ticker)}`)

  return (
    <Card variant="outlined" sx={{ borderColor: 'divider', height: '100%' }}>
      <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Box sx={{ mb: 1.5 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '1.05rem' }}>
            {list.title}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {list.caption}
          </Typography>
        </Box>

        <ColumnHeader metrics={list.metrics} />

        {isError && !data ? (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ py: 4, textAlign: 'center' }}
          >
            Couldn’t load these right now.
          </Typography>
        ) : isLoading ? (
          <Stack>
            {Array.from({ length: TOP_N }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </Stack>
        ) : rows.length === 0 ? (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ py: 4, textAlign: 'center' }}
          >
            No mega-cap data available.
          </Typography>
        ) : (
          <Stack>
            {rows.map((stock, i) => (
              <LeaderRow
                key={stock.ticker}
                stock={stock}
                rank={i + 1}
                metrics={list.metrics}
                onSelect={openStock}
              />
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Home-page "Mega-cap growth leaders" band: the largest US companies (≥ $200B)
 * growing the fastest, in two side-by-side lists — one on trailing results, one
 * on forward analyst expectations. Each list ranks the mega-cap slice by an
 * equal-weight revenue + EPS blend server-side and shows the top ten with both
 * component figures; a row opens that stock's detail page. The lists stack on
 * narrow screens.
 */
export default function MegaCapGrowthLeaders() {
  return (
    <Box sx={{ borderTop: 1, borderColor: 'divider' }}>
      <Container maxWidth="xl" sx={{ py: { xs: 5, sm: 7, md: 8 } }}>
        <BandHeader
          icon={<RocketLaunchIcon />}
          title="Mega-cap growth leaders"
          subtitle="The largest US companies growing the fastest, by trailing results and by what analysts expect next year."
        />

        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            alignItems: 'stretch',
            gap: 3,
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <GrowthLeadersCard list={TRAILING} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <GrowthLeadersCard list={FORWARD} />
          </Box>
        </Box>
      </Container>
    </Box>
  )
}
