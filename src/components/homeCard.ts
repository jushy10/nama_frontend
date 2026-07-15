import type { Theme } from '@mui/material/styles'

/**
 * The shared surface for the home page's premium content cards — the two AI
 * market reads and the growth-leader lists. A hairline border on paper with a
 * soft, background-tinted shadow and a generous radius, matching the hero's
 * "market at a glance" snapshot so the whole page reads as one card family
 * rather than a stack of flat outlined boxes.
 *
 * Spread it into a card's `sx` and add the padding there:
 *   sx={(theme) => ({ ...sleekCardSx(theme), p: 3 })}
 */
export function sleekCardSx(theme: Theme) {
  return {
    borderRadius: 3,
    border: 1,
    borderColor: 'divider',
    bgcolor: 'background.paper',
    boxShadow:
      theme.palette.mode === 'dark'
        ? '0 12px 40px -22px rgba(0,0,0,0.75)'
        : '0 12px 40px -24px rgba(15,23,42,0.28)',
  } as const
}
