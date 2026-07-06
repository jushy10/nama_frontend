import {
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Typography,
} from '@mui/material'
import {
  humanizeClassification,
  stockLogoUrl,
  type EtfDetail,
} from '@/lib/api'

const fmt = (n: number | null) =>
  n == null
    ? '—'
    : n.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })

/** Compact dollar magnitude, e.g. $1.70T / $845.0B / $12.4M. */
const fmtMoney = (n: number | null) =>
  n == null
    ? '—'
    : '$' +
      n.toLocaleString('en-US', {
        notation: 'compact',
        maximumFractionDigits: 2,
      })

/** Unsigned percent — a yield or a fee has no direction. */
const fmtPct = (n: number | null) => (n == null ? '—' : `${n.toFixed(2)}%`)

/** A NAV / price dollar amount. */
const fmtDollars = (n: number | null) => (n == null ? '—' : `$${fmt(n)}`)

/** The "Category · Fund family" summary line, skipping whichever side is absent. */
const profileLine = (
  category: string | null,
  fundFamily: string | null,
): string | null => {
  const parts = [
    category ? humanizeClassification(category) : null,
    fundFamily,
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : null
}

/** One labelled figure in the key-stats grid (mirrors the stock snapshot). */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Box
      sx={{
        borderRadius: 2,
        bgcolor: 'action.hover',
        px: 2,
        py: 1.5,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: 0.75,
      }}
    >
      <Typography
        component="dt"
        variant="caption"
        sx={{
          color: 'text.secondary',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          fontSize: '0.72rem',
          lineHeight: 1.2,
        }}
      >
        {label}
      </Typography>
      <Typography
        component="dd"
        sx={{
          m: 0,
          fontWeight: 700,
          fontSize: '1.5rem',
          lineHeight: 1.15,
          letterSpacing: '-0.01em',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </Typography>
    </Box>
  )
}

/**
 * The fund snapshot card — the ETF analogue of `StockCard`. Leads with the
 * identity (logo, ticker, an `ETF` badge that tells it apart from a stock, and
 * the category/fund-family line), the live quote and day's move, then a 2×2
 * grid of the figures that define a fund: assets under management, the annual
 * expense ratio, the distribution yield, and NAV.
 */
export default function EtfCard({ etf }: { etf: EtfDetail }) {
  const up = (etf.change ?? 0) >= 0
  const changeColor = up ? 'success.main' : 'error.main'
  const sign = up ? '+' : ''
  const profile = profileLine(etf.category, etf.fund_family)

  return (
    <Card
      variant="outlined"
      sx={{
        borderColor: 'divider',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <CardContent
        sx={{ p: 3, flexGrow: 1, display: 'flex', flexDirection: 'column' }}
      >
        <Stack
          direction="row"
          spacing={2.5}
          sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}
        >
          <Stack
            direction="row"
            spacing={2}
            sx={{ alignItems: 'flex-start', minWidth: 0 }}
          >
            <Avatar
              variant="rounded"
              src={stockLogoUrl(etf.ticker)}
              alt={`${etf.ticker} logo`}
              slotProps={{
                img: { loading: 'lazy', style: { objectFit: 'contain' } },
              }}
              sx={{
                width: 76,
                height: 76,
                flexShrink: 0,
                bgcolor: '#fff',
                color: '#111',
                fontWeight: 700,
                fontSize: '1.75rem',
                p: 1.25,
                borderRadius: '18px',
                border: '1px solid',
                borderColor: 'divider',
                boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
              }}
            >
              {etf.ticker.charAt(0)}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Stack
                direction="row"
                spacing={1}
                sx={{ alignItems: 'center', flexWrap: 'wrap' }}
              >
                <Typography
                  component="h2"
                  sx={{ fontWeight: 700, lineHeight: 1.05, fontSize: '2rem' }}
                >
                  {etf.ticker}
                </Typography>
                {/* The badge that tells a fund apart from a stock at a glance. */}
                <Chip
                  label="ETF"
                  size="small"
                  color="primary"
                  sx={{ height: 22, fontSize: '0.72rem', fontWeight: 700 }}
                />
                {etf.exchange && (
                  <Chip
                    label={etf.exchange}
                    size="small"
                    variant="outlined"
                    sx={{
                      height: 22,
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      color: 'text.secondary',
                      borderColor: 'divider',
                    }}
                  />
                )}
              </Stack>
              {etf.name && (
                <Typography
                  sx={{
                    mt: 0.5,
                    color: 'text.primary',
                    fontSize: '1.15rem',
                    fontWeight: 500,
                    lineHeight: 1.3,
                    display: '-webkit-box',
                    WebkitBoxOrient: 'vertical',
                    WebkitLineClamp: 2,
                    overflow: 'hidden',
                  }}
                >
                  {etf.name}
                </Typography>
              )}
              {profile && (
                <Typography
                  sx={{
                    display: 'block',
                    mt: 0.75,
                    color: 'text.secondary',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    fontSize: '0.8rem',
                    fontWeight: 500,
                  }}
                >
                  {profile}
                </Typography>
              )}
            </Box>
          </Stack>
          <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
            <Typography
              sx={{
                fontWeight: 700,
                fontSize: '2.25rem',
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1.05,
                letterSpacing: '-0.01em',
              }}
            >
              ${fmt(etf.price)}
            </Typography>
            <Box
              sx={{
                mt: 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                px: 1.5,
                py: 0.6,
                borderRadius: 999,
                color: changeColor,
                bgcolor: up
                  ? 'rgba(52,211,153,0.14)'
                  : 'rgba(248,113,113,0.14)',
              }}
            >
              <Box
                component="span"
                aria-hidden
                sx={{ fontSize: '0.65rem', lineHeight: 1 }}
              >
                {up ? '▲' : '▼'}
              </Box>
              <Typography
                component="span"
                sx={{
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1,
                }}
              >
                {sign}
                {fmt(etf.change)} ({sign}
                {fmt(etf.change_percent)}%)
              </Typography>
            </Box>
          </Box>
        </Stack>

        <Divider sx={{ mt: 2.5, mb: 2.5 }} />

        {/* The figures that define a fund, filling the height the snapshot
            borrows from the taller returns + about stack beside it. */}
        <Box
          component="dl"
          sx={{
            m: 0,
            flexGrow: 1,
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gridAutoRows: '1fr',
            gap: 1,
          }}
        >
          <Stat label="AUM" value={fmtMoney(etf.net_assets)} />
          <Stat label="Expense Ratio" value={fmtPct(etf.expense_ratio)} />
          <Stat label="Yield" value={fmtPct(etf.dividend_yield)} />
          <Stat label="NAV" value={fmtDollars(etf.nav)} />
        </Box>
      </CardContent>
    </Card>
  )
}
