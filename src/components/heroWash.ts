import type { Theme } from '@mui/material/styles'

/**
 * The home-hero blue→gold radial wash — the "Nama Insights" accent colors
 * bled softly across a surface. Reused so the stock-detail hero cards echo the
 * landing page instead of each inventing their own background. Brighter in
 * dark, gentle in light so text stays legible either way.
 *
 * Assign it to a surface's `backgroundImage` (not `background`, so the card's
 * own paper color still shows through beneath the wash).
 */
export function heroWash(theme: Theme): string {
  return theme.palette.mode === 'dark'
    ? 'radial-gradient(1100px 380px at 15% -20%, rgba(47,99,180,0.22), transparent 60%), radial-gradient(900px 360px at 100% 0%, rgba(215,167,57,0.14), transparent 55%)'
    : 'radial-gradient(1100px 380px at 15% -20%, rgba(47,99,180,0.12), transparent 60%), radial-gradient(900px 360px at 100% 0%, rgba(215,167,57,0.09), transparent 55%)'
}
