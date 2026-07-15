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
    // Stocks. (Anchored names avoid the home page's feature tiles.) The page's
    // h1 is its benefit headline; the "Stock screener" name still rides the hero
    // eyebrow and the document title.
    await user.click(screen.getByRole('button', { name: /^screener$/i }))
    await user.click(await screen.findByRole('menuitem', { name: /^stocks$/i }))

    expect(
      await screen.findByRole('heading', {
        name: /screen the u\.?s\.? stock market/i,
      }),
    ).toBeInTheDocument()
  })

  it('renders the ETF screener page at /etf-screener', async () => {
    const { user } = renderWithProviders(<App />)

    await user.click(screen.getByRole('button', { name: /^screener$/i }))
    await user.click(await screen.findByRole('menuitem', { name: /^etfs$/i }))

    expect(
      await screen.findByRole('heading', {
        name: /screen every major us etf/i,
      }),
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
