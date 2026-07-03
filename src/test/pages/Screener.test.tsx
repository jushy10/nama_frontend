import { afterEach, describe, expect, it, vi } from 'vitest'
import { Route, Routes, useSearchParams } from 'react-router-dom'
import { renderWithProviders, screen } from '@/test/test-utils'
import Screener from '@/pages/Screener'

/** Minimal stand-in for the stocks page that echoes the ?symbol= it received. */
function StockStub() {
  const [params] = useSearchParams()
  return <div>stock page: {params.get('symbol')}</div>
}

const RESULT = {
  index: null,
  sector: null,
  limit: 10,
  universe_count: 503,
  quoted_count: 500,
  as_of: '2026-06-26T20:00:00Z',
  gainers: [
    {
      symbol: 'NVDA',
      name: 'NVIDIA Corp',
      sector: 'Information Technology',
      price: 128.4,
      change: 3.0,
      change_percent: 2.41,
      previous_close: 125.4,
      as_of: null,
    },
  ],
  losers: [
    {
      symbol: 'INTC',
      name: 'Intel Corp',
      sector: 'Information Technology',
      price: 20.1,
      change: -1.2,
      change_percent: -5.63,
      previous_close: 21.3,
      as_of: null,
    },
  ],
}

/** Answers any /stocks/screener request with a fixed two-name payload. */
function stubFetch(payload: unknown = RESULT) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(payload),
      }),
    ),
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('Screener', () => {
  it('shows the top gainers by default with the universe summary', async () => {
    stubFetch()
    renderWithProviders(<Screener />)

    // NVDA shows twice: once in the top-gainer card, once as a table row.
    expect(await screen.findAllByText('NVDA')).toHaveLength(2)
    expect(screen.getAllByText('+2.41%')).toHaveLength(2)
    expect(screen.getByText(/500 of 503 names quoted/i)).toBeInTheDocument()

    // Losers stay out of the table until the toggle flips — INTC only
    // appears in the top-loser spotlight card.
    expect(screen.getAllByText('INTC')).toHaveLength(1)
  })

  it('spotlights the day’s top gainer and loser', async () => {
    stubFetch()
    renderWithProviders(<Screener />)

    expect(await screen.findByText('INTC')).toBeInTheDocument()
    expect(screen.getByText(/top gainer/i)).toBeInTheDocument()
    expect(screen.getByText(/top loser/i)).toBeInTheDocument()
    expect(screen.getByText('-5.63%')).toBeInTheDocument()
  })

  it('switches to losers without refetching', async () => {
    stubFetch()
    const { user } = renderWithProviders(<Screener />)

    await screen.findAllByText('NVDA')
    await user.click(screen.getByRole('button', { name: /losers/i }))

    // INTC now shows in both the spotlight card and the table.
    expect(await screen.findAllByText('INTC')).toHaveLength(2)
    // NVDA drops back to just its top-gainer card.
    expect(screen.getAllByText('NVDA')).toHaveLength(1)
  })

  it('navigates to the stock page when a row is clicked', async () => {
    stubFetch()
    const { user } = renderWithProviders(
      <Routes>
        <Route path="/" element={<Screener />} />
        <Route path="/stocks" element={<StockStub />} />
      </Routes>,
    )

    const [row] = await screen.findAllByRole('link', {
      name: /view NVDA details/i,
    })
    await user.click(row)

    expect(await screen.findByText(/stock page: NVDA/i)).toBeInTheDocument()
  })

  it('surfaces an error when the first load fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 502,
          json: () => Promise.resolve({ detail: 'Upstream is down.' }),
        }),
      ),
    )
    renderWithProviders(<Screener />)

    expect(await screen.findByText('Upstream is down.')).toBeInTheDocument()
  })
})
