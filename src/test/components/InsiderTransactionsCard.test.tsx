import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen } from '@/test/test-utils'
import InsiderTransactionsCard from '@/components/InsiderTransactionsCard'
import type { InsiderTransaction, InsiderTransactions } from '@/lib/api'

const txn = (
  overrides: Partial<InsiderTransaction> = {},
): InsiderTransaction => ({
  filing_date: '2026-06-17',
  transaction_date: '2026-06-15',
  insider_name: 'COOK TIMOTHY D',
  role: 'Chief Executive Officer',
  security_title: 'Common Stock',
  transaction_code: 'S',
  code_label: 'Open-market sale',
  acquired_disposed: 'D',
  is_open_market: true,
  is_open_market_buy: false,
  is_open_market_sale: true,
  shares: 1000,
  price_per_share: 200,
  value: 200_000,
  shares_owned_following: 5000,
  ...overrides,
})

const data = (
  overrides: Partial<InsiderTransactions> = {},
): InsiderTransactions => ({
  symbol: 'AAPL',
  count: 1,
  summary: {
    open_market_buy_count: 0,
    open_market_sell_count: 1,
    open_market_buy_value: 0,
    open_market_sell_value: 200_000,
    net_value: -200_000,
  },
  transactions: [txn()],
  ...overrides,
})

describe('InsiderTransactionsCard', () => {
  it('reads a sells-only window as "Insiders selling" with the sold figure', () => {
    renderWithProviders(<InsiderTransactionsCard data={data()} />)
    expect(screen.getByText('Insiders selling')).toBeInTheDocument()
    // The "$200K" sold figure appears (summary figure + the row value).
    expect(screen.getAllByText(/\$200K/).length).toBeGreaterThan(0)
  })

  it('reads a buys-only window as "Insiders buying"', () => {
    renderWithProviders(
      <InsiderTransactionsCard
        data={data({
          summary: {
            open_market_buy_count: 1,
            open_market_sell_count: 0,
            open_market_buy_value: 4_000_000,
            open_market_sell_value: 0,
            net_value: 4_000_000,
          },
          transactions: [
            txn({
              transaction_code: 'P',
              code_label: 'Open-market purchase',
              acquired_disposed: 'A',
              is_open_market_buy: true,
              is_open_market_sale: false,
              value: 4_000_000,
            }),
          ],
        })}
      />,
    )
    expect(screen.getByText('Insiders buying')).toBeInTheDocument()
  })

  it('title-cases the raw SEC insider name', () => {
    renderWithProviders(<InsiderTransactionsCard data={data()} />)
    expect(screen.getByText('Cook Timothy D')).toBeInTheDocument()
    expect(screen.queryByText('COOK TIMOTHY D')).not.toBeInTheDocument()
  })

  it('shows only open-market trades by default and reveals the rest on "All activity"', async () => {
    const { user } = renderWithProviders(
      <InsiderTransactionsCard
        data={data({
          count: 2,
          transactions: [
            txn(),
            txn({
              transaction_code: 'M',
              code_label: 'Option exercise',
              is_open_market: false,
              is_open_market_buy: false,
              is_open_market_sale: false,
              value: null,
              price_per_share: null,
            }),
          ],
        })}
      />,
    )
    // The compensation row is hidden under the default "Buys & sells" filter.
    expect(screen.queryByText('Option exercise')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /all activity/i }))
    expect(screen.getByText('Option exercise')).toBeInTheDocument()
  })

  it('renders an empty state when there is no activity', () => {
    renderWithProviders(
      <InsiderTransactionsCard data={data({ count: 0, transactions: [] })} />,
    )
    expect(screen.getByText('No insider transactions')).toBeInTheDocument()
    expect(
      screen.getByText(/No recent Form 4 buys or sells/),
    ).toBeInTheDocument()
  })
})
