import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen } from '@/test/test-utils'
import FundReturnsCard from '@/components/FundReturnsCard'
import type { EtfDetail } from '@/lib/api'

const base: EtfDetail = {
  ticker: 'VOO',
  name: 'Vanguard S&P 500 ETF',
  exchange: 'NYSE',
  asset_type: 'etf',
  price: 685.28,
  change: 3.21,
  change_percent: 0.47,
  previous_close: 682.07,
  as_of: null,
  category: 'large_blend',
  fund_family: 'Vanguard',
  net_assets: 1e12,
  expense_ratio: 0.03,
  nav: 684.9,
  dividend_yield: 1.03,
  ytd_return: 11.25,
  three_year_return: 20.41,
  five_year_return: -3.4,
  description: null,
  top_holdings: [],
  sector_weightings: [],
}

describe('FundReturnsCard', () => {
  it('shows the fund-style YTD / 3Y / 5Y trailing returns, signed', () => {
    renderWithProviders(<FundReturnsCard etf={base} />)
    expect(screen.getByRole('heading', { name: 'Returns' })).toBeInTheDocument()
    expect(screen.getByText('YTD')).toBeInTheDocument()
    expect(screen.getByText('+11.25%')).toBeInTheDocument()
    expect(screen.getByText('3Y (ann.)')).toBeInTheDocument()
    expect(screen.getByText('+20.41%')).toBeInTheDocument()
    // A negative window keeps its sign.
    expect(screen.getByText('5Y (ann.)')).toBeInTheDocument()
    expect(screen.getByText('-3.40%')).toBeInTheDocument()
  })

  it('dashes a window the vendor does not cover', () => {
    renderWithProviders(
      <FundReturnsCard etf={{ ...base, three_year_return: null }} />,
    )
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
