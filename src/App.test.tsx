import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen } from '@/test/test-utils'
import App from '@/App'

describe('App routing', () => {
  it('renders the home page by default', () => {
    renderWithProviders(<App />)

    expect(
      screen.getByRole('heading', { name: /^screener$/i }),
    ).toBeInTheDocument()
  })

  it('navigates to the about page', async () => {
    const { user } = renderWithProviders(<App />)

    await user.click(screen.getByRole('link', { name: /about/i }))

    expect(
      screen.getByRole('heading', { name: /^about$/i }),
    ).toBeInTheDocument()
  })

  it('renders the about page directly from its route', () => {
    renderWithProviders(<App />, { initialEntries: ['/about'] })

    expect(
      screen.getByRole('heading', { name: /^about$/i }),
    ).toBeInTheDocument()
  })
})
