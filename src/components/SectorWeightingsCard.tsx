import { Box, Card, CardContent, Stack, Typography } from '@mui/material'
import { humanizeClassification, type EtfSectorWeight } from '@/lib/api'

/** Percent of net assets, e.g. `39.13` → "39.13%". */
const fmtWeight = (n: number) => `${n.toFixed(2)}%`

/** One sector row: humanized name, weight, and a bar scaled to the heaviest
 *  sector so the fund's tilt reads at a glance. */
function SectorRow({
  weight,
  maxWeight,
}: {
  weight: EtfSectorWeight
  maxWeight: number
}) {
  const barWidth =
    maxWeight > 0 ? `${(weight.weight / maxWeight) * 100}%` : '0%'
  return (
    <Box sx={{ py: 1 }}>
      <Stack
        direction="row"
        spacing={1.5}
        sx={{ justifyContent: 'space-between', alignItems: 'baseline' }}
      >
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {humanizeClassification(weight.sector)}
        </Typography>
        <Typography
          variant="body2"
          sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
        >
          {fmtWeight(weight.weight)}
        </Typography>
      </Stack>
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
 * A fund's sector allocation — the backend returns the weightings already
 * sorted heaviest-first, each a percent of net assets, drawn as bars scaled to
 * the top sector. Renders nothing when the breakdown isn't available.
 */
export default function SectorWeightingsCard({
  weightings,
}: {
  weightings: EtfSectorWeight[]
}) {
  if (!weightings.length) return null
  const maxWeight = Math.max(...weightings.map((w) => w.weight), 0)

  return (
    <Card variant="outlined" sx={{ borderColor: 'divider', height: '100%' }}>
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        <Typography variant="h6" component="h2" sx={{ fontWeight: 600, mb: 1 }}>
          Sector Weightings
        </Typography>
        <Stack divider={<Box sx={{ borderTop: 1, borderColor: 'divider' }} />}>
          {weightings.map((w) => (
            <SectorRow key={w.sector} weight={w} maxWeight={maxWeight} />
          ))}
        </Stack>
      </CardContent>
    </Card>
  )
}
