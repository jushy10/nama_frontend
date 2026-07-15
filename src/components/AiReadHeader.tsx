import { Box, Stack, Typography } from '@mui/material'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import TonePill from '@/components/TonePill'
import type { MarketTone } from '@/lib/api'

/**
 * The header shared by the two AI market reads (`MarketSummary`, `SectorPulse`):
 * a small tinted glyph, the title as an `<h2>`, and — once the read has loaded —
 * the market's risk posture as a {@link TonePill} pinned to the right. One
 * component so both reads open at the same scale and rhythm, and the posture
 * always renders the same way.
 */
export default function AiReadHeader({
  title,
  tone,
}: {
  title: string
  tone?: MarketTone | null
}) {
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 2.5 }}>
      <Box
        aria-hidden
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 38,
          height: 38,
          borderRadius: 2,
          flexShrink: 0,
          color: 'primary.main',
          bgcolor: 'action.hover',
          border: 1,
          borderColor: 'divider',
          '& svg': { fontSize: 20 },
        }}
      >
        <AutoAwesomeIcon />
      </Box>
      <Typography
        variant="h5"
        component="h2"
        sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}
      >
        {title}
      </Typography>
      {tone && (
        <Box sx={{ ml: 'auto', pl: 1 }}>
          <TonePill tone={tone} />
        </Box>
      )}
    </Stack>
  )
}
