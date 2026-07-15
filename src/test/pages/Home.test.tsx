import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen } from '@/test/test-utils'
import Home from '@/pages/Home'

describe('Home', () => {
  it('renders the market indices', () => {
    renderWithProviders(<Home />)

    expect(
      screen.getByRole('heading', { name: /markets today/i }),
    ).toBeInTheDocument()
  })

  it('leads with the AI market read', () => {
    renderWithProviders(<Home />)

    // The two AI reads open with an <h2>; use the level to disambiguate from the
    // like-named <h3> tiles in the feature grid lower down the page.
    expect(
      screen.getByRole('heading', { level: 2, name: /market summary/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 2, name: /sector pulse/i }),
    ).toBeInTheDocument()
  })

  it('no longer embeds the screener', () => {
    renderWithProviders(<Home />)

    expect(
      screen.queryByRole('heading', { name: /^screener$/i }),
    ).not.toBeInTheDocument()
  })
})
