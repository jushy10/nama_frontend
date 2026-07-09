import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen } from '@/test/test-utils'
import HomeHero from '@/components/HomeHero'

describe('HomeHero', () => {
  it('renders the headline, a live market-status eyebrow, and the two jumps', () => {
    renderWithProviders(<HomeHero />)

    // The two-tone headline (its accent phrase is a separate span, so match the
    // concatenated text).
    expect(
      screen.getByRole('heading', { level: 1, name: /read by ai/i }),
    ).toBeInTheDocument()

    // A phase label from the market clock — always one of these four.
    expect(
      screen.getByText(/market open|market closed|pre-market|after hours/i),
    ).toBeInTheDocument()

    // The CTAs link into the app.
    expect(
      screen.getByRole('link', { name: /open the screener/i }),
    ).toHaveAttribute('href', '/screener')
    expect(
      screen.getByRole('link', { name: /search a stock/i }),
    ).toHaveAttribute('href', '/search')
  })
})
