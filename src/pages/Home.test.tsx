import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Home from '@/pages/Home'

describe('Home', () => {
  it('increments the counter when clicked', async () => {
    const user = userEvent.setup()
    render(<Home />)

    await user.click(screen.getByRole('button', { name: /count is 0/i }))

    expect(
      screen.getByRole('button', { name: /count is 1/i }),
    ).toBeInTheDocument()
  })
})
