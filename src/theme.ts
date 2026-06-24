import { createTheme } from '@mui/material/styles'

const fontStack = [
  'system-ui',
  'Avenir',
  'Helvetica',
  'Arial',
  'sans-serif',
].join(',')

/**
 * App-wide MUI theme. Dark, indigo-accented, tuned to the Nama Insights look
 * (near-black #0a0a0f canvas, indigo primary, emerald/red for up/down moves).
 * Applied once via ThemeProvider in src/main.tsx; tests pull it in through
 * the shared render wrapper in src/test/test-utils.tsx.
 */
export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#6366f1', // indigo-500
      light: '#818cf8', // indigo-400
      dark: '#4f46e5', // indigo-600
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#a855f7', // purple-500, for accents/gradients
    },
    success: { main: '#34d399' }, // emerald-400 — price up
    error: { main: '#f87171' }, // red-400 — price down
    background: {
      default: '#0a0a0f',
      paper: '#111118',
    },
    text: {
      primary: '#f3f4f6', // gray-100
      secondary: '#9ca3af', // gray-400
    },
    divider: 'rgba(255,255,255,0.08)',
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

export default theme
