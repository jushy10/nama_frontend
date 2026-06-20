import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '@/App'

function renderApp() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>,
  )
}

describe('App routing', () => {
  it('renders the home page by default', () => {
    renderApp()
    expect(
      screen.getByRole('heading', { name: /vite \+ react \+ typescript/i }),
    ).toBeInTheDocument()
  })

  it('navigates to the about page', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('link', { name: /about/i }))

    expect(
      screen.getByRole('heading', { name: /^about$/i }),
    ).toBeInTheDocument()
  })
})
