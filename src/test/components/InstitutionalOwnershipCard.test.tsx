import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen } from '@/test/test-utils'
import InstitutionalOwnershipCard from '@/components/InstitutionalOwnershipCard'
import type { InstitutionalHolder, InstitutionalOwnership } from '@/lib/api'

const holder = (
  overrides: Partial<InstitutionalHolder> = {},
): InstitutionalHolder => ({
  holder: 'Vanguard Group Inc',
  holder_type: 'institution',
  date_reported: '2026-06-30',
  shares: 1_000_000,
  value: 200_000_000_000,
  pct_held: 8.9,
  pct_change: 12.3,
  is_buyer: true,
  is_seller: false,
  share_change: 100_000,
  value_change: 20_000_000_000,
  ...overrides,
})

const data = (
  overrides: Partial<InstitutionalOwnership> = {},
): InstitutionalOwnership => ({
  symbol: 'AAPL',
  count: 1,
  latest_report_date: '2026-06-30',
  breakdown: {
    institutions_pct_held: 62.3,
    insiders_pct_held: 0.07,
    institutions_float_pct_held: 65,
    institutions_count: 5321,
  },
  flow: {
    buyers_count: 1,
    sellers_count: 0,
    shares_bought: 100_000,
    shares_sold: 0,
    value_bought: 20_000_000_000,
    value_sold: 0,
    net_share_change: 100_000,
    net_value_change: 20_000_000_000,
  },
  holders: [holder()],
  ...overrides,
})

const trimmed = (overrides: Partial<InstitutionalHolder> = {}) =>
  holder({ is_buyer: false, is_seller: true, pct_change: -8.1, ...overrides })

describe('InstitutionalOwnershipCard', () => {
  it('reads a builders-only quarter as "Institutions accumulating"', () => {
    renderWithProviders(<InstitutionalOwnershipCard data={data()} />)
    expect(screen.getByText('Institutions accumulating')).toBeInTheDocument()
  })

  it('reads a trimmers-only quarter as "Institutions distributing"', () => {
    renderWithProviders(
      <InstitutionalOwnershipCard
        data={data({
          flow: {
            buyers_count: 0,
            sellers_count: 1,
            shares_bought: 0,
            shares_sold: 50_000,
            value_bought: 0,
            value_sold: 10_000_000_000,
            net_share_change: -50_000,
            net_value_change: -10_000_000_000,
          },
          holders: [trimmed()],
        })}
      />,
    )
    expect(screen.getByText('Institutions distributing')).toBeInTheDocument()
  })

  it('shows the ownership breakdown — institution % and count', () => {
    renderWithProviders(<InstitutionalOwnershipCard data={data()} />)
    // The composition meter's legend surfaces the institutions percentage…
    expect(screen.getByText('62.3%')).toBeInTheDocument()
    // …and the count line reports how many institutions hold it.
    expect(screen.getByText(/5,321/)).toBeInTheDocument()
    expect(screen.getByText(/of float/)).toBeInTheDocument()
  })

  it('filters the holders to those building their position', async () => {
    const { user } = renderWithProviders(
      <InstitutionalOwnershipCard
        data={data({
          count: 2,
          flow: {
            buyers_count: 1,
            sellers_count: 1,
            shares_bought: 100_000,
            shares_sold: 50_000,
            value_bought: 20_000_000_000,
            value_sold: 10_000_000_000,
            net_share_change: 50_000,
            net_value_change: 10_000_000_000,
          },
          holders: [
            holder({ holder: 'BuyerFund', pct_change: 5 }),
            trimmed({ holder: 'SellerFund' }),
          ],
        })}
      />,
    )
    // Both holders show under the default "All" filter.
    expect(screen.getByText('BuyerFund')).toBeInTheDocument()
    expect(screen.getByText('SellerFund')).toBeInTheDocument()
    // Building narrows to the accumulators only.
    await user.click(screen.getByRole('button', { name: /building/i }))
    expect(screen.getByText('BuyerFund')).toBeInTheDocument()
    expect(screen.queryByText('SellerFund')).not.toBeInTheDocument()
  })

  it('scopes the holders list to the latest reported quarter', () => {
    renderWithProviders(
      <InstitutionalOwnershipCard
        data={data({
          count: 2,
          holders: [
            holder({ holder: 'CurrentFund', date_reported: '2026-06-30' }),
            holder({ holder: 'OldFund', date_reported: '2026-03-31' }),
          ],
        })}
      />,
    )
    expect(screen.getByText('CurrentFund')).toBeInTheDocument()
    expect(screen.queryByText('OldFund')).not.toBeInTheDocument()
  })

  it('renders an empty state when there are no holders', () => {
    renderWithProviders(
      <InstitutionalOwnershipCard
        data={data({
          count: 0,
          latest_report_date: null,
          breakdown: null,
          flow: {
            buyers_count: 0,
            sellers_count: 0,
            shares_bought: 0,
            shares_sold: 0,
            value_bought: 0,
            value_sold: 0,
            net_share_change: 0,
            net_value_change: 0,
          },
          holders: [],
        })}
      />,
    )
    expect(screen.getByText('No institutional ownership')).toBeInTheDocument()
    expect(
      screen.getByText(/No 13F institutional holdings/),
    ).toBeInTheDocument()
  })
})
