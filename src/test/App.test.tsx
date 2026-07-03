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
})
