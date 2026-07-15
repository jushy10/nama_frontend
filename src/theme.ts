import { createTheme, type PaletteMode, type Theme } from '@mui/material/styles'

// Geist drives the whole UI — a precise, highly legible variable grotesque
// (self-hosted, loaded in main.tsx). A system stack is the fallback while it
// loads or if it fails. A neutral, credible face is doing brand work here, not
// decoration: legibility is the point.
const fontStack = [
  '"Geist Variable"',
  'system-ui',
  '-apple-system',
  '"Segoe UI"',
  'Roboto',
  'Helvetica',
  'Arial',
  'sans-serif',
].join(',')

/**
 * Monospace stack for tabular figures, tickers and terminal-style labels.
 * Exported so components can opt in via `fontFamily: fontFamilyMono` (the hero's
 * live market-status line, coverage counts, etc.) — a run of digits reads
 * cleaner, and more precisely, in a mono than in a proportional face.
 */
export const fontFamilyMono = [
  '"Geist Mono Variable"',
  'ui-monospace',
  '"SF Mono"',
  'Menlo',
  'Consolas',
  'monospace',
].join(',')

/**
 * Canonical "Nama Insights" brand-accent values, in one place so the nav's
 * blue→gold line, active-pill, logo glow and hero wash can't drift from the
 * wordmark colours. Deliberately mode-independent — these brand gradients look
 * the same in light and dark; the mode-adaptive palette lives in createAppTheme
 * below. The `*GlowRgb` values are bare "r, g, b" triples for use in rgba(...).
 */
export const brand = {
  navy: '#07378e', // "Nama" wordmark navy (matches palette.primary.dark)
  blue: '#4f83e6', // lifted brand blue
  gold: '#d7a739', // "Insights" wordmark gold (matches palette.secondary.main)
  blueGlowRgb: '47, 99, 180',
  goldGlowRgb: '215, 167, 57',
} as const

/**
 * Builds the app-wide MUI theme for a given palette mode. Blue + gold accents
 * in both modes — the exact "Nama Insights" wordmark colors (navy #07378e,
 * gold #d7a739). Dark is the original near-black #0a0a0f canvas, light is a
 * clean white/paper surface. Emerald/red carry up/down moves (deepened in
 * light mode so gains/losses stay legible on white).
 *
 * Wired up via ColorModeProvider (src/ColorModeProvider.tsx), which persists
 * the choice and feeds the chosen mode in here. Tests pull the default (dark)
 * theme in through the shared render wrapper in src/test/test-utils.tsx.
 */
export function createAppTheme(mode: PaletteMode): Theme {
  const isDark = mode === 'dark'

  return createTheme({
    palette: {
      mode,
      primary: {
        // Blue — the "Nama" half of the wordmark. Exact logo navy on white;
        // lifted to a legible blue on the near-black dark canvas.
        main: isDark ? '#4f83e6' : '#07378e', // lifted navy / exact logo navy
        light: isDark ? '#7aa5f2' : '#3a63b0',
        dark: '#07378e', // exact logo navy — the "Nama" wordmark
        contrastText: '#ffffff',
      },
      secondary: {
        // Gold/orange — the "Insights" half of the wordmark and accent fills.
        main: '#d7a739', // exact logo gold — the "Insights" wordmark
        light: '#e6bd57',
        dark: '#a87f22',
        contrastText: '#1a1206', // dark ink for text on gold surfaces
      },
      // Price up/down. Brighter in dark, deeper in light for contrast on white.
      success: { main: isDark ? '#34d399' : '#059669' }, // emerald-400 / -600
      error: { main: isDark ? '#f87171' : '#dc2626' }, // red-400 / -600
      background: {
        default: isDark ? '#0a0a0f' : '#f7f8fa',
        paper: isDark ? '#111118' : '#ffffff',
      },
      text: {
        primary: isDark ? '#f3f4f6' : '#111118', // gray-100 / near-black
        secondary: isDark ? '#9ca3af' : '#5b6472', // gray-400 / slate
      },
      divider: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)',
    },
    shape: { borderRadius: 12 },
    typography: {
      fontFamily: fontStack,
      // Tighter tracking + shorter line-heights at the display end — Geist has
      // open metrics, so headlines read crisper pulled in a touch. Hierarchy is
      // carried by weight and this scale, never by ever-larger raw sizes.
      h1: { fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.05 },
      h2: { fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.12 },
      h3: { fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2 },
      h4: { fontWeight: 600, letterSpacing: '-0.015em' },
      h5: { fontWeight: 600, letterSpacing: '-0.01em' },
      h6: { fontWeight: 600, letterSpacing: '-0.01em' },
      button: { fontWeight: 600, letterSpacing: 0 },
    },
    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { textTransform: 'none', borderRadius: 8 },
        },
      },
      MuiCard: {
        styleOverrides: {
          // Kill MUI's default elevation gradient overlay so our solid
          // paper color shows through cleanly.
          root: { backgroundImage: 'none' },
        },
      },
      MuiAppBar: {
        styleOverrides: { root: { backgroundImage: 'none' } },
      },
    },
  })
}

/** Default dark theme, used by tests and as the app's initial fallback. */
export const theme = createAppTheme('dark')

export default theme
