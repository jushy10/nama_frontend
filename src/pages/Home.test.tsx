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

  it('no longer embeds the screener', () => {
    renderWithProviders(<Home />)

    expect(
      screen.queryByRole('heading', { name: /^screener$/i }),
    ).not.toBeInTheDocument()
  })
})
