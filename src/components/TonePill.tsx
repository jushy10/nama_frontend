import { Box, Typography } from '@mui/material'
import { alpha, type Theme } from '@mui/material/styles'
import type { MarketTone } from '@/lib/api'

/** The market's risk posture as a small, refined pill: a status-coloured dot and
 *  a readable label on a faint tint of the same colour. Green reads risk-on,
 *  amber risk-off, neutral for a mixed tape. Shared by the AI market reads
 *  (`MarketSummary`, `SectorPulse`) so the posture renders identically in both.
 *  The label stays in the primary text colour for contrast; the dot + tint carry
 *  the semantic colour. */
const TONE: Record<
  MarketTone,
  { label: string; key: 'up' | 'warn' | 'neutral' }
> = {
  risk_on: { label: 'Risk-On', key: 'up' },
  risk_off: { label: 'Risk-Off', key: 'warn' },
  mixed: { label: 'Mixed', key: 'neutral' },
}

function toneColor(theme: Theme, key: 'up' | 'warn' | 'neutral'): string {
  if (key === 'up') return theme.palette.success.main
  if (key === 'warn') return theme.palette.warning.main
  return theme.palette.text.secondary
}

export default function TonePill({ tone }: { tone: MarketTone }) {
  const cfg = TONE[tone] ?? TONE.mixed
  return (
    <Box
      sx={(theme) => {
        const c = toneColor(theme, cfg.key)
        return {
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.75,
          px: 1.25,
          py: 0.4,
          borderRadius: 999,
          border: 1,
          borderColor: alpha(c, 0.35),
          bgcolor: alpha(c, 0.12),
          flexShrink: 0,
        }
      }}
    >
      <Box
        sx={(theme) => ({
          width: 7,
          height: 7,
          borderRadius: '50%',
          bgcolor: toneColor(theme, cfg.key),
        })}
      />
      <Typography
        sx={{
          fontWeight: 700,
          fontSize: '0.72rem',
          letterSpacing: '0.02em',
          lineHeight: 1,
          color: 'text.primary',
        }}
      >
        {cfg.label}
      </Typography>
    </Box>
  )
}
