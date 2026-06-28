import type { ReactElement, ReactNode } from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ColorModeProvider } from '@/ColorModeProvider'

interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Router history stack to start from. Defaults to the home route. */
  initialEntries?: string[]
}

/**
 * Renders `ui` wrapped in the same providers the real app uses. Today that is
 * just the router; add context providers (theme, query client, auth, …) to the
 * `Wrapper` below as the app grows and every test picks them up for free.
 *
 * Also returns a `user` from `userEvent.setup()`, so a test gets render +
 * interaction in a single call:
 *
 *   const { user } = renderWithProviders(<App />)
 *   await user.click(screen.getByRole('link', { name: /about/i }))
 */
export function renderWithProviders(
  ui: ReactElement,
  { initialEntries = ['/'], ...renderOptions }: RenderWithProvidersOptions = {},
) {
  // A fresh client per render keeps tests isolated (no cache bleed between
  // them), and retry-off means a failed query surfaces its error immediately
  // instead of backing off — so error-state assertions resolve right away.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ColorModeProvider>
          <MemoryRouter initialEntries={initialEntries}>
            {children}
          </MemoryRouter>
        </ColorModeProvider>
      </QueryClientProvider>
    )
  }

  return {
    user: userEvent.setup(),
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  }
}

// Re-export the Testing Library API so tests import everything from one place:
//   import { renderWithProviders, screen } from '@/test/test-utils'
export * from '@testing-library/react'
export { default as userEvent } from '@testing-library/user-event'
