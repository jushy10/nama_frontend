import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders, screen, waitFor } from '@/test/test-utils'
import Congress from '@/pages/Congress'
import type { CongressActivity, CongressTrade } from '@/lib/api'

const trade = (overrides: Partial<CongressTrade> = {}): CongressTrade => ({
  member: 'Nancy Pelosi',
  chamber: 'House',
  party: null,
  ticker: 'NVDA',
  name: 'NVIDIA Corporation',
  tx_type: 'Purchase',
  amount_range: '$1,000,001 - $5,000,000',
  amount_midpoint: 3_000_000,
  transaction_date: '2026-06-20',
  disclosure_date: '2026-07-02',
  owner: 'Spouse',
  source_url: null,
  is_buy: true,
  is_sell: false,
  ...overrides,
})

const board = (
  overrides: Partial<CongressActivity> = {},
): CongressActivity => ({
  window: '30d',
  total: 2,
  limit: 50,
  offset: 0,
  count: 2,
  summary: {
    buy_count: 1,
    sell_count: 1,
    buy_value: 3_000_000,
    sell_value: 32_500,
    net_value: 2_967_500,
  },
  items: [
    trade(),
    trade({
      member: 'Tommy Tuberville',
      chamber: 'Senate',
      ticker: 'LMT',
      tx_type: 'Sale',
      amount_range: '$15,001 - $50,000',
      amount_midpoint: 32_500,
      is_buy: false,
      is_sell: true,
    }),
  ],
  ...overrides,
})

const calls: string[] = []

function stubBoard(payload: CongressActivity) {
  calls.length = 0
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string | URL) => {
      calls.push(String(url))
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(payload),
      })
    }),
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('Congress board', () => {
  it('lists disclosed trades with the member, ticker and direction', async () => {
    stubBoard(board())
    renderWithProviders(<Congress />)

    expect(await screen.findByText('Nancy Pelosi')).toBeInTheDocument()
    expect(screen.getByText('Tommy Tuberville')).toBeInTheDocument()
    expect(screen.getByText('NVDA')).toBeInTheDocument()
    expect(screen.getByText('Buy')).toBeInTheDocument()
    expect(screen.getByText('Sell')).toBeInTheDocument()
    // Defaults to the 30-day disclosure window.
    expect(calls.some((u) => u.includes('/market/congress-activity'))).toBe(
      true,
    )
    expect(calls.some((u) => u.includes('window=30d'))).toBe(true)
    // The window total line is shown.
    expect(
      screen.getByText(/trades disclosed in this window/i),
    ).toBeInTheDocument()
  })

  it('re-queries when the disclosure window changes', async () => {
    stubBoard(board())
    const { user } = renderWithProviders(<Congress />)

    await screen.findByText('Nancy Pelosi')
    await user.click(screen.getByRole('button', { name: '7D' }))

    await waitFor(() =>
      expect(calls.some((u) => u.includes('window=7d'))).toBe(true),
    )
  })

  it('shows an empty state when the window has no trades', async () => {
    stubBoard(board({ total: 0, count: 0, items: [] }))
    renderWithProviders(<Congress />)

    expect(
      await screen.findByText(/no congressional trades in this window/i),
    ).toBeInTheDocument()
  })

  it('surfaces an error when the request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ detail: 'Congress feed unavailable.' }),
      }),
    )
    renderWithProviders(<Congress />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /congress feed unavailable/i,
    )
  })

  it('links each ticker to its stock detail page', async () => {
    stubBoard(board())
    renderWithProviders(<Congress />)

    const link = await screen.findByRole('link', { name: /view NVDA details/i })
    expect(link).toHaveAttribute('href', '/search?symbol=NVDA')
  })
})
