import { createTheme, type PaletteMode, type Theme } from '@mui/material/styles'

const fontStack = [
  'system-ui',
  'Avenir',
  'Helvetica',
  'Arial',
  'sans-serif',
].join(',')

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
      h1: { fontWeight: 700, letterSpacing: '-0.02em' },
      h2: { fontWeight: 700, letterSpacing: '-0.02em' },
      h3: { fontWeight: 600, letterSpacing: '-0.01em' },
      h4: { fontWeight: 600 },
      h5: { fontWeight: 600 },
      h6: { fontWeight: 600 },
      button: { fontWeight: 600 },
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
