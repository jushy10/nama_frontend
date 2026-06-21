import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen } from '@/test/test-utils'
import Home from '@/pages/Home'

describe('Home', () => {
  it('renders the hero headline', () => {
    renderWithProviders(<Home />)

    expect(
      screen.getByRole('heading', {
        name: /make smarter stock decisions/i,
      }),
    ).toBeInTheDocument()
  })

  it('lists the core features', () => {
    renderWithProviders(<Home />)

    expect(
      screen.getByRole('heading', { name: /real-time market data/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /ai-powered analysis/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /portfolio tracking/i }),
    ).toBeInTheDocument()
  })
})
