import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Stocks from '@/pages/Stocks'

const sample = {
  symbol: 'NVDA',
  name: 'NVIDIA Corporation Common Stock',
  exchange: 'NASDAQ',
  price: 209.97,
  change: 5.27,
  change_percent: 2.57,
  open: 207.4,
  high: 211.385,
  low: 206.5,
  previous_close: 204.7,
  volume: 4026083,
  bid: 210.0,
  ask: 231.8,
  spread: 21.8,
  as_of: '2026-06-18T20:45:23.729548Z',
}

afterEach(() => vi.unstubAllGlobals())

describe('Stocks search', () => {
  it('shows a stock snapshot after a successful search', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(sample),
      }),
    )
    const user = userEvent.setup()
    render(<Stocks />)

    await user.type(screen.getByLabelText(/ticker symbol/i), 'nvda')
    await user.click(screen.getByRole('button', { name: /search/i }))

    expect(
      await screen.findByRole('heading', { name: 'NVDA' }),
    ).toBeInTheDocument()
    expect(screen.getByText('$209.97')).toBeInTheDocument()
    // The symbol is normalized to upper-case before the request.
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/stocks/NVDA'))
  })

  it('shows an error message when the symbol is not found', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: () =>
          Promise.resolve({ detail: "No stock data found for symbol 'ZZZZ'." }),
      }),
    )
    const user = userEvent.setup()
    render(<Stocks />)

    await user.type(screen.getByLabelText(/ticker symbol/i), 'ZZZZ')
    await user.click(screen.getByRole('button', { name: /search/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /no stock data found/i,
    )
  })
})
