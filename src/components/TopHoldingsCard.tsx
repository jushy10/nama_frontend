import { Box, Card, CardContent, Link, Stack, Typography } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import { type EtfHolding } from '@/lib/api'

/** Percent of net assets, e.g. `7.89` → "7.89%"; a dash when unknown. */
const fmtWeight = (n: number | null) => (n == null ? '—' : `${n.toFixed(2)}%`)

/** One holding row: rank, ticker (linked to its stock page), name, and a weight
 *  bar scaled so the fund's largest holding fills the track. */
function HoldingRow({
  holding,
  rank,
  maxWeight,
}: {
  holding: EtfHolding
  rank: number
  maxWeight: number
}) {
  const pct = holding.weight ?? 0
  const barWidth = maxWeight > 0 ? `${(pct / maxWeight) * 100}%` : '0%'
  return (
    <Box sx={{ py: 1 }}>
      <Stack
        direction="row"
        spacing={1.5}
        sx={{ alignItems: 'baseline', justifyContent: 'space-between' }}
      >
        <Stack
          direction="row"
          spacing={1.25}
          sx={{ alignItems: 'baseline', minWidth: 0 }}
        >
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              fontVariantNumeric: 'tabular-nums',
              width: 18,
              flexShrink: 0,
            }}
          >
            {rank}
          </Typography>
          {/* A holding almost always carries a ticker; an odd row without one
              (a vendor quirk) shows its name plain rather than a dead link. */}
          {holding.ticker ? (
            <Link
              component={RouterLink}
              to={`/stocks?symbol=${encodeURIComponent(holding.ticker)}`}
              underline="hover"
              sx={{ fontWeight: 700, color: 'text.primary', flexShrink: 0 }}
            >
              {holding.ticker}
            </Link>
          ) : (
            <Typography sx={{ fontWeight: 700, flexShrink: 0 }}>—</Typography>
          )}
          {holding.name && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {holding.name}
            </Typography>
          )}
        </Stack>
        <Typography
          sx={{
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
            flexShrink: 0,
          }}
        >
          {fmtWeight(holding.weight)}
        </Typography>
      </Stack>
      {/* Weight bar, relative to the top holding. */}
      <Box
        sx={{
          mt: 0.75,
          height: 4,
          borderRadius: 999,
          bgcolor: 'action.hover',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{ width: barWidth, height: '100%', bgcolor: 'primary.main' }}
        />
      </Box>
    </Box>
  )
}

/**
 * A fund's largest positions (up to the top 10 the backend returns), each
 * weight shown as a percent of net assets with a bar scaled to the biggest
 * holding. Every ticker links to its own stock page, so the fund is a jumping-off
 * point into what it owns. Renders nothing when holdings aren't available.
 */
export default function TopHoldingsCard({
  holdings,
}: {
  holdings: EtfHolding[]
}) {
  if (!holdings.length) return null
  const maxWeight = Math.max(...holdings.map((h) => h.weight ?? 0), 0)

  return (
    <Card variant="outlined" sx={{ borderColor: 'divider', height: '100%' }}>
      <CardContent sx={{ p: 3 }}>
        <Stack
          direction="row"
          spacing={1}
          sx={{
            justifyContent: 'space-between',
            alignItems: 'baseline',
            mb: 1,
          }}
        >
          <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
            Top Holdings
          </Typography>
          <Typography variant="caption" color="text.secondary">
            % of net assets
          </Typography>
        </Stack>
        <Stack divider={<Box sx={{ borderTop: 1, borderColor: 'divider' }} />}>
          {holdings.map((h, i) => (
            <HoldingRow
              key={h.ticker ?? `row-${i}`}
              holding={h}
              rank={i + 1}
              maxWeight={maxWeight}
            />
          ))}
        </Stack>
      </CardContent>
    </Card>
  )
}
