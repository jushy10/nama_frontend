import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen } from '@/test/test-utils'
import Home from '@/pages/Home'

describe('Home', () => {
  it('renders the market indices and screener sections', () => {
    renderWithProviders(<Home />)

    expect(
      screen.getByRole('heading', { name: /markets today/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /^screener$/i }),
    ).toBeInTheDocument()
  })

  it('exposes the screener filters', () => {
    renderWithProviders(<Home />)

    expect(screen.getByRole('button', { name: /gainers/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /losers/i })).toBeInTheDocument()
  })
})
