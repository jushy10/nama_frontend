import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen } from '@/test/test-utils'
import EtfCard from '@/components/EtfCard'
import type { EtfDetail } from '@/lib/api'

const voo: EtfDetail = {
  ticker: 'VOO',
  name: 'Vanguard S&P 500 ETF',
  exchange: 'NYSE',
  asset_type: 'etf',
  price: 685.28,
  change: 3.21,
  change_percent: 0.47,
  previous_close: 682.07,
  as_of: '2026-07-06T20:00:00Z',
  category: 'large_blend',
  fund_family: 'Vanguard',
  net_assets: 1_701_513_003_008,
  expense_ratio: 0.03,
  nav: 684.9,
  dividend_yield: 1.03,
  ytd_return: 11.25,
  three_year_return: 20.41,
  five_year_return: 13.01,
  description: 'Tracks the S&P 500.',
  top_holdings: [],
  sector_weightings: [],
}

describe('EtfCard', () => {
  it('leads with the fund identity and an ETF badge', () => {
    renderWithProviders(<EtfCard etf={voo} />)
    expect(screen.getByRole('heading', { name: 'VOO' })).toBeInTheDocument()
    // The badge is what tells a fund apart from a stock at a glance.
    expect(screen.getByText('ETF')).toBeInTheDocument()
    expect(screen.getByText('NYSE')).toBeInTheDocument()
    expect(screen.getByText('Vanguard S&P 500 ETF')).toBeInTheDocument()
    // Category · fund family, humanized.
    expect(screen.getByText('Large Blend · Vanguard')).toBeInTheDocument()
  })

  it('shows the live quote and the fund-defining stats', () => {
    renderWithProviders(<EtfCard etf={voo} />)
    expect(screen.getByText('$685.28')).toBeInTheDocument()
    // The 2×2 grid: AUM (compact), expense ratio, yield, and NAV.
    expect(screen.getByText('AUM')).toBeInTheDocument()
    expect(screen.getByText('$1.7T')).toBeInTheDocument()
    expect(screen.getByText('Expense Ratio')).toBeInTheDocument()
    expect(screen.getByText('0.03%')).toBeInTheDocument()
    expect(screen.getByText('Yield')).toBeInTheDocument()
    expect(screen.getByText('1.03%')).toBeInTheDocument()
    expect(screen.getByText('NAV')).toBeInTheDocument()
    expect(screen.getByText('$684.90')).toBeInTheDocument()
  })

  it('dashes stats the vendor does not cover', () => {
    renderWithProviders(
      <EtfCard
        etf={{
          ...voo,
          net_assets: null,
          expense_ratio: null,
          dividend_yield: null,
          nav: null,
        }}
      />,
    )
    expect(screen.getAllByText('—')).toHaveLength(4)
  })
})
