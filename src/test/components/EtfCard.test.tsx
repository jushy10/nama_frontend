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
  description: 'Tracks the S&P 500.',
  top_holdings: [],
  sector_weightings: [],
  // The size/cost + yield stats ride the opt-in blocks the card reads.
  metrics: { expense_ratio: 0.03, nav: 684.9, net_assets: 1_701_513_003_008 },
  dividends: { yield_percentage: 1.03 },
  performance: null, // not read by the snapshot card (FundReturnsCard shows it)
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
    // Blocks absent entirely (a card fetched without them, or a blocked vendor):
    // every stat falls back to a dash.
    renderWithProviders(
      <EtfCard etf={{ ...voo, metrics: null, dividends: null }} />,
    )
    expect(screen.getAllByText('—')).toHaveLength(4)
  })
})
