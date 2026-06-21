import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import Home from '@/pages/Home'

describe('Home', () => {
  it('renders the hero headline', () => {
    render(<Home />)

    expect(
      screen.getByRole('heading', {
        name: /make smarter stock decisions/i,
      }),
    ).toBeInTheDocument()
  })

  it('lists the core features', () => {
    render(<Home />)

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
