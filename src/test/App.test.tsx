import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen } from '@/test/test-utils'
import App from '@/App'

describe('App routing', () => {
  it('renders the home page by default', () => {
    renderWithProviders(<App />)

    expect(
      screen.getByRole('heading', { name: /markets today/i }),
    ).toBeInTheDocument()
  })

  it('renders the stock screener page at /screener', async () => {
    const { user } = renderWithProviders(<App />)

    // The screeners now live under a "Screener" dropdown: open it, then pick
    // Stocks. (Anchored names avoid the home page's feature tiles.)
    await user.click(screen.getByRole('button', { name: /^screener$/i }))
    await user.click(await screen.findByRole('menuitem', { name: /^stocks$/i }))

    expect(
      await screen.findByRole('heading', { name: /stock screener/i }),
    ).toBeInTheDocument()
  })

  it('renders the ETF screener page at /etf-screener', async () => {
    const { user } = renderWithProviders(<App />)

    await user.click(screen.getByRole('button', { name: /^screener$/i }))
    await user.click(await screen.findByRole('menuitem', { name: /^etfs$/i }))

    expect(
      await screen.findByRole('heading', { name: /etf screener/i }),
    ).toBeInTheDocument()
  })

  it('renders the unified search page at /search', async () => {
    const { user } = renderWithProviders(<App />)

    await user.click(screen.getByRole('link', { name: /^search$/i }))

    expect(
      await screen.findByRole('heading', { name: /^search$/i }),
    ).toBeInTheDocument()
  })
})
