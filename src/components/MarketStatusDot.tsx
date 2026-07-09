import { Box } from '@mui/material'
import type { MarketPhase } from '@/lib/market'

/** Status-dot colour per phase — emerald reads "live/open"; the rest cool as
 *  the session winds down (amber pre-market, blue after hours, grey closed). */
const PHASE_DOT: Record<MarketPhase, string> = {
  pre: '#fbbf24', // amber-400
  regular: '#34d399', // emerald-400
  after: '#7aa5f2', // blue
  closed: '#9ca3af', // gray-400
}

interface Props {
  phase: MarketPhase
  /** Diameter in px. Defaults to the hero eyebrow's 9. */
  size?: number
}

/**
 * The market-phase status dot: a small filled circle coloured by phase that
 * gently pulses while the regular session is open. Shared by the home-hero
 * eyebrow and the app-bar status so both read the market the same way — a
 * live "heartbeat" while trading, a quiet dot otherwise.
 */
export default function MarketStatusDot({ phase, size = 9 }: Props) {
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: '50%',
        bgcolor: PHASE_DOT[phase],
        flexShrink: 0,
        ...(phase === 'regular' && {
          boxShadow: '0 0 0 0 rgba(52,211,153,0.6)',
          animation: 'marketPulse 2s infinite',
          '@keyframes marketPulse': {
            '0%': { boxShadow: '0 0 0 0 rgba(52,211,153,0.55)' },
            '70%': { boxShadow: '0 0 0 6px rgba(52,211,153,0)' },
            '100%': { boxShadow: '0 0 0 0 rgba(52,211,153,0)' },
          },
        }),
      }}
    />
  )
}
