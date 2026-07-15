import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen } from '@/test/test-utils'
import HomeHero from '@/components/HomeHero'

describe('HomeHero', () => {
  it('renders the headline, the market-status eyebrow, the search box, and the jumps', () => {
    renderWithProviders(<HomeHero />)

    // The two-tone headline (its accent phrase "driven by AI" is a separate
    // span, so match the concatenated text).
    expect(
      screen.getByRole('heading', { level: 1, name: /driven by ai/i }),
    ).toBeInTheDocument()

    // The status pill carries the live market phase and today's compact date,
    // e.g. "Market Closed · Jul 14".
    expect(
      screen.getByText(
        /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2}\b/i,
      ),
    ).toBeInTheDocument()

    // The coverage markers spell out what the engine spans, incl. the free angle.
    expect(screen.getByText(/no login, no paywall/i)).toBeInTheDocument()

    // The primary action is the universe search box itself.
    expect(
      screen.getByPlaceholderText(/search a stock or etf/i),
    ).toBeInTheDocument()

    // The secondary CTAs link into the app.
    expect(
      screen.getByRole('link', { name: /open the screener/i }),
    ).toHaveAttribute('href', '/screener')
    expect(screen.getByRole('link', { name: /heat map/i })).toHaveAttribute(
      'href',
      '/heatmap',
    )
  })
})
