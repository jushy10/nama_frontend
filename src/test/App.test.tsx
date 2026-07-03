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

  it('renders the screener page at /screener', async () => {
    const { user } = renderWithProviders(<App />)

    await user.click(screen.getByRole('link', { name: /^screener$/i }))

    expect(
      await screen.findByRole('heading', { name: /^screener$/i }),
    ).toBeInTheDocument()
  })
})
