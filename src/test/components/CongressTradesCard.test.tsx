import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen } from '@/test/test-utils'
import CongressTradesCard from '@/components/CongressTradesCard'
import type { CongressTrade, CongressTrades } from '@/lib/api'

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
  source_url: 'https://example/1',
  is_buy: true,
  is_sell: false,
  ...overrides,
})

const data = (overrides: Partial<CongressTrades> = {}): CongressTrades => ({
  symbol: 'NVDA',
  total: 1,
  limit: 50,
  offset: 0,
  count: 1,
  summary: {
    buy_count: 1,
    sell_count: 0,
    buy_value: 3_000_000,
    sell_value: 0,
    net_value: 3_000_000,
  },
  items: [trade()],
  ...overrides,
})

describe('CongressTradesCard', () => {
  it('renders a buys-only feed as "Congress buying" with the member and estimate', () => {
    renderWithProviders(<CongressTradesCard data={data()} />)
    expect(screen.getByText('Congress trades')).toBeInTheDocument()
    expect(screen.getByText('Congress buying')).toBeInTheDocument()
    expect(screen.getByText('Nancy Pelosi')).toBeInTheDocument()
    // The estimated midpoint appears (~$3M), and the disclosed range is shown.
    expect(screen.getAllByText(/~\$3M/).length).toBeGreaterThan(0)
    expect(screen.getByText(/\$1,000,001 - \$5,000,000/)).toBeInTheDocument()
  })

  it('reads a sells-only feed as "Congress selling"', () => {
    renderWithProviders(
      <CongressTradesCard
        data={data({
          summary: {
            buy_count: 0,
            sell_count: 1,
            buy_value: 0,
            sell_value: 32_500,
            net_value: -32_500,
          },
          items: [
            trade({
              member: 'Tommy Tuberville',
              chamber: 'Senate',
              tx_type: 'Sale',
              amount_range: '$15,001 - $50,000',
              amount_midpoint: 32_500,
              is_buy: false,
              is_sell: true,
            }),
          ],
        })}
      />,
    )
    expect(screen.getByText('Congress selling')).toBeInTheDocument()
    expect(screen.getByText('Tommy Tuberville')).toBeInTheDocument()
  })

  it('reads a two-sided feed as "Mixed activity"', () => {
    renderWithProviders(
      <CongressTradesCard
        data={data({
          total: 2,
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
              member: 'Ro Khanna',
              tx_type: 'Sale',
              amount_midpoint: 32_500,
              is_buy: false,
              is_sell: true,
            }),
          ],
        })}
      />,
    )
    expect(screen.getByText('Mixed activity')).toBeInTheDocument()
  })

  it('self-hides (renders nothing) when there are no trades', () => {
    const { container } = renderWithProviders(
      <CongressTradesCard data={data({ total: 0, count: 0, items: [] })} />,
    )
    // Best-effort: an empty feed produces no card at all.
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByText('Congress trades')).not.toBeInTheDocument()
  })

  it('links to the full Congress board', () => {
    renderWithProviders(<CongressTradesCard data={data()} />)
    const link = screen.getByRole('link', { name: /all congress trades/i })
    expect(link).toHaveAttribute('href', '/congress')
  })
})
