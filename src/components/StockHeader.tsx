import {
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
} from '@mui/material'
import {
  humanizeClassification,
  stockLogoUrl,
  type TickerCard,
} from '@/lib/api'
import { heroWash } from '@/components/heroWash'

const fmt = (n: number | null) =>
  n == null
    ? '—'
    : n.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })

/** The "Sector · Industry" summary line, skipping whichever side is absent. */
const classificationLine = (
  sector: string | null,
  industry: string | null,
): string | null => {
  const parts = [sector, industry]
    .filter(Boolean)
    .map((s) => humanizeClassification(s!))
  return parts.length ? parts.join(' · ') : null
}

/**
 * The persistent identity + live-quote band that heads the stock detail and
 * stays put above the tab strip on every tab — so whichever section you're
 * reading (Fundamentals, Analysts, Options…) the ticker, name and price never
 * scroll out of mind. Lifted out of the old snapshot card, which now leads the
 * Overview tab with the key stats alone. Rides the same blue→gold hero wash as
 * the landing page so the detail opens on a recognisably "Nama" surface.
 */
export default function StockHeader({ stock }: { stock: TickerCard }) {
  const up = (stock.change ?? 0) >= 0
  const changeColor = up ? 'success.main' : 'error.main'
  const sign = up ? '+' : ''
  const classification = classificationLine(stock.sector, stock.industry)

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
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack
          direction="row"
          spacing={{ xs: 1.5, sm: 2.5 }}
          sx={{
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            rowGap: 1.5,
          }}
        >
          <Stack
            direction="row"
            spacing={{ xs: 1.5, sm: 2 }}
            sx={{ alignItems: 'center', minWidth: 0, flex: '1 1 auto' }}
          >
            <Avatar
              variant="rounded"
              src={stockLogoUrl(stock.ticker)}
              alt={`${stock.ticker} logo`}
              slotProps={{
                img: { loading: 'lazy', style: { objectFit: 'contain' } },
              }}
              sx={{
                width: { xs: 52, sm: 68 },
                height: { xs: 52, sm: 68 },
                flexShrink: 0,
                bgcolor: '#fff',
                color: '#111',
                fontWeight: 700,
                fontSize: { xs: '1.25rem', sm: '1.6rem' },
                p: 1,
                borderRadius: '16px',
                border: '1px solid',
                borderColor: 'divider',
                boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
              }}
            >
              {stock.ticker.charAt(0)}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Stack
                direction="row"
                spacing={1}
                sx={{ alignItems: 'center', flexWrap: 'wrap' }}
              >
                <Typography
                  component="h2"
                  sx={{
                    fontWeight: 700,
                    lineHeight: 1.05,
                    fontSize: { xs: '1.5rem', sm: '2rem' },
                  }}
                >
                  {stock.ticker}
                </Typography>
                {stock.exchange && (
                  <Chip
                    label={stock.exchange}
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
              {stock.name && (
                <Typography
                  sx={{
                    mt: 0.25,
                    color: 'text.primary',
                    fontSize: { xs: '0.95rem', sm: '1.1rem' },
                    fontWeight: 500,
                    lineHeight: 1.3,
                    display: '-webkit-box',
                    WebkitBoxOrient: 'vertical',
                    WebkitLineClamp: 2,
                    overflow: 'hidden',
                  }}
                >
                  {stock.name}
                </Typography>
              )}
              {classification && (
                <Typography
                  sx={{
                    display: 'block',
                    mt: 0.5,
                    color: 'text.secondary',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    fontSize: { xs: '0.68rem', sm: '0.75rem' },
                    fontWeight: 500,
                  }}
                >
                  {classification}
                </Typography>
              )}
            </Box>
          </Stack>
          <Box sx={{ textAlign: 'right', flexShrink: 0, ml: 'auto' }}>
            <Typography
              sx={{
                fontWeight: 700,
                fontSize: { xs: '1.75rem', sm: '2.25rem' },
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1.05,
                letterSpacing: '-0.01em',
              }}
            >
              ${fmt(stock.price)}
            </Typography>
            {/* the day's move as a tinted pill, so direction reads at a glance */}
            <Box
              sx={{
                mt: 0.75,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                px: 1.25,
                py: 0.5,
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
                sx={{ fontSize: '0.6rem', lineHeight: 1 }}
              >
                {up ? '▲' : '▼'}
              </Box>
              <Typography
                component="span"
                sx={{
                  fontWeight: 600,
                  fontSize: { xs: '0.82rem', sm: '0.9rem' },
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1,
                }}
              >
                {sign}
                {fmt(stock.change)} ({sign}
                {fmt(stock.change_percent)}%)
              </Typography>
            </Box>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  )
}
