import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { ThemeProvider, type PaletteMode } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { createAppTheme } from '@/theme'

const STORAGE_KEY = 'nama-color-mode'

interface ColorModeContextValue {
  mode: PaletteMode
  toggleColorMode: () => void
}

const ColorModeContext = createContext<ColorModeContextValue | null>(null)

/** Reads the persisted mode, falling back to the OS preference, then dark. */
function getInitialMode(): PaletteMode {
  if (typeof window === 'undefined') return 'dark'

  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored

  const prefersLight = window.matchMedia?.(
    '(prefers-color-scheme: light)',
  )?.matches
  return prefersLight ? 'light' : 'dark'
}

/**
 * Owns the light/dark palette mode for the whole app: persists the user's
 * choice to localStorage, rebuilds the MUI theme when it changes, and exposes
 * a toggle via {@link useColorMode}. Renders ThemeProvider + CssBaseline so it
 * fully replaces the static providers that used to live in main.tsx.
 */
export function ColorModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<PaletteMode>(getInitialMode)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, mode)
  }, [mode])

  const toggleColorMode = useCallback(() => {
    setMode((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }, [])

  const theme = useMemo(() => createAppTheme(mode), [mode])
  const value = useMemo(
    () => ({ mode, toggleColorMode }),
    [mode, toggleColorMode],
  )

  return (
    <ColorModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  )
}

/** Access the current palette mode and a toggle for it. */
export function useColorMode(): ColorModeContextValue {
  const ctx = useContext(ColorModeContext)
  if (!ctx) {
    throw new Error('useColorMode must be used within a ColorModeProvider')
  }
  return ctx
}
