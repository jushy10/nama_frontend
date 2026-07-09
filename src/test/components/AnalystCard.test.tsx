import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen } from '@/test/test-utils'
import AnalystCard from '@/components/AnalystCard'
import type {
  AnalystRecommendations,
  Recommendation,
  RecommendationTrend,
} from '@/lib/api'

function trend(
  counts: Partial<
    Pick<
      RecommendationTrend,
      'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell'
    >
  >,
  consensus: Recommendation,
  score: number,
): RecommendationTrend {
  const strong_buy = counts.strong_buy ?? 0
  const buy = counts.buy ?? 0
  const hold = counts.hold ?? 0
  const sell = counts.sell ?? 0
  const strong_sell = counts.strong_sell ?? 0
  return {
    period: '2026-06-01',
    strong_buy,
    buy,
    hold,
    sell,
    strong_sell,
    total: strong_buy + buy + hold + sell + strong_sell,
    score,
    consensus,
  }
}

const base: AnalystRecommendations = {
  symbol: 'AAPL',
  count: 2,
  direction: 'upgraded',
  latest: trend({ strong_buy: 13, buy: 24, hold: 7 }, 'Buy', 1.86),
  price_targets: null,
  trends: [],
}

const withTargets: AnalystRecommendations = {
  ...base,
  price_targets: { mean: 315, high: 400, low: 215, median: 315 },
}

describe('AnalystCard', () => {
  it('shows the consensus chip and the analyst count', () => {
    renderWithProviders(<AnalystCard recommendations={base} />)
    expect(screen.getByText('Analyst Ratings')).toBeInTheDocument()
    expect(screen.getByText('Consensus')).toBeInTheDocument()
    expect(screen.getByText(/44 analysts/)).toBeInTheDocument()
  })

  it('renders the distribution with each stance and its count', () => {
    renderWithProviders(<AnalystCard recommendations={base} />)
    expect(screen.getByText('Strong Buy')).toBeInTheDocument()
    expect(screen.getByText('Hold')).toBeInTheDocument()
    expect(screen.getByText('Strong Sell')).toBeInTheDocument()
    expect(screen.getByText('13')).toBeInTheDocument()
    expect(screen.getByText('24')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getAllByText('0')).toHaveLength(2) // sell + strong_sell
  })

  it('flags an upgrade in the consensus trend', () => {
    renderWithProviders(<AnalystCard recommendations={base} />)
    expect(screen.getByText(/upgraded from last month/i)).toBeInTheDocument()
  })

  it('flags a downgrade in the consensus trend', () => {
    renderWithProviders(
      <AnalystCard recommendations={{ ...base, direction: 'downgraded' }} />,
    )
    expect(screen.getByText(/downgraded from last month/i)).toBeInTheDocument()
  })

  it('omits the trend line when there is no prior month to compare', () => {
    renderWithProviders(
      <AnalystCard recommendations={{ ...base, direction: null }} />,
    )
    expect(screen.queryByText(/from last month/i)).not.toBeInTheDocument()
  })

  it('renders a Strong Buy consensus as a filled chip', () => {
    const recs: AnalystRecommendations = {
      ...base,
      latest: trend({ strong_buy: 30, buy: 2 }, 'Strong Buy', 1.1),
    }
    renderWithProviders(<AnalystCard recommendations={recs} />)
    // one in the chip, one in the legend
    expect(screen.getAllByText('Strong Buy')).toHaveLength(2)
  })

  it('shows an empty state when there is no analyst coverage', () => {
    const recs: AnalystRecommendations = {
      symbol: 'ZZZZ',
      count: 0,
      direction: null,
      latest: null,
      price_targets: null,
      trends: [],
    }
    renderWithProviders(<AnalystCard recommendations={recs} />)
    expect(screen.getByText(/no analyst coverage/i)).toBeInTheDocument()
    expect(screen.queryByText('Consensus')).not.toBeInTheDocument()
  })

  it('shows the price target with upside against the live price', () => {
    renderWithProviders(
      <AnalystCard recommendations={withTargets} price={300} />,
    )
    expect(screen.getByText('12-Month Price Target')).toBeInTheDocument()
    expect(screen.getByText('$315.00')).toBeInTheDocument() // the mean target
    // (315 - 300) / 300 = +5.0%
    expect(screen.getByText(/\+5\.0% upside/)).toBeInTheDocument()
    expect(screen.getByText(/Low \$215\.00/)).toBeInTheDocument()
    expect(screen.getByText(/High \$400\.00/)).toBeInTheDocument()
  })

  it('shows a negative upside when the price is above the mean target', () => {
    renderWithProviders(
      <AnalystCard recommendations={withTargets} price={350} />,
    )
    // (315 - 350) / 350 = -10.0%
    expect(screen.getByText(/-10\.0% upside/)).toBeInTheDocument()
  })

  it('shows the target without an upside when no price is supplied', () => {
    renderWithProviders(<AnalystCard recommendations={withTargets} />)
    expect(screen.getByText('$315.00')).toBeInTheDocument()
    expect(screen.queryByText(/upside/)).not.toBeInTheDocument()
  })

  it('omits the price target section when there are no targets', () => {
    renderWithProviders(<AnalystCard recommendations={base} price={300} />)
    expect(screen.queryByText('12-Month Price Target')).not.toBeInTheDocument()
  })
})
