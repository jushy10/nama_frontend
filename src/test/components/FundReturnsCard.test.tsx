import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen } from '@/test/test-utils'
import FundReturnsCard from '@/components/FundReturnsCard'
import type { EtfDetail, EtfPerformance } from '@/lib/api'

// The card reads YTD / 3Y / 5Y off the `performance` block (the 1w–6m/1y windows
// go unused here). Extracted so the "missing window" test can null one field.
const perf: EtfPerformance = {
  '1w': null,
  '1m': null,
  '3m': null,
  '6m': null,
  ytd: 11.25,
  '1y': null,
  '3y': 20.41,
  '5y': -3.4,
}

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
  description: null,
  top_holdings: [],
  sector_weightings: [],
  metrics: null, // not read by the returns card
  dividends: null,
  performance: perf,
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
      <FundReturnsCard
        etf={{ ...base, performance: { ...perf, '3y': null } }}
      />,
    )
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
