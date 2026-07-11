import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen } from '@/test/test-utils'
import ScorecardCard from '@/components/ScorecardCard'
import type { AnalysisSection, StockAnalysis } from '@/lib/api'

function section(overrides: Partial<AnalysisSection> = {}): AnalysisSection {
  return {
    key: 'business_quality',
    title: 'Business quality',
    stance: 'positive',
    label: 'Exceptional',
    summary: 'Keeps about half of every sale as profit and turns it into cash.',
    metrics: [{ label: 'Net margin', value: '25.00%' }],
    ...overrides,
  }
}

function analysis(overrides: Partial<StockAnalysis> = {}): StockAnalysis {
  return {
    symbol: 'AAPL',
    recommendation: 'buy',
    confidence: 'high',
    thesis: 'A world-class business, but the price already assumes a lot.',
    sections: [
      section(),
      section({
        key: 'valuation',
        title: 'Valuation',
        stance: 'negative',
        label: 'Expensive',
        summary: 'Priced well above its industry peers.',
        metrics: [{ label: 'P/E (trailing)', value: '28.50' }],
      }),
      section({
        key: 'earnings',
        title: 'Earnings',
        stance: 'positive',
        label: 'Beating estimates',
        summary: 'Has topped expectations every recent quarter.',
        metrics: [{ label: 'Beat rate', value: '4/4 quarters' }],
      }),
      section({
        key: 'analyst_view',
        title: 'Analyst view',
        stance: 'neutral',
        label: 'Mixed',
        summary: 'Analysts are split on where it goes next.',
        metrics: [],
      }),
    ],
    disclaimer:
      'AI-generated for informational purposes only — not financial advice.',
    model: 'claude-haiku-4-5',
    generated_at: '2026-07-11T00:00:00Z',
    ...overrides,
  }
}

describe('ScorecardCard', () => {
  it('shows the overall verdict, confidence, and thesis', () => {
    renderWithProviders(<ScorecardCard analysis={analysis()} />)
    expect(screen.getByText('AI Analysis')).toBeInTheDocument()
    expect(screen.getByText('Buy')).toBeInTheDocument()
    expect(screen.getByText('High confidence')).toBeInTheDocument()
    expect(screen.getByText(/price already assumes a lot/i)).toBeInTheDocument()
  })

  it('renders each section title, label, and summary', () => {
    renderWithProviders(<ScorecardCard analysis={analysis()} />)
    for (const title of [
      'Business quality',
      'Valuation',
      'Earnings',
      'Analyst view',
    ]) {
      expect(screen.getByText(title)).toBeInTheDocument()
    }
    expect(screen.getByText('Exceptional')).toBeInTheDocument()
    expect(screen.getByText('Expensive')).toBeInTheDocument()
    expect(
      screen.getByText(/priced well above its industry peers/i),
    ).toBeInTheDocument()
  })

  it('renders the supporting metric chips as label: value', () => {
    renderWithProviders(<ScorecardCard analysis={analysis()} />)
    expect(screen.getByText('Net margin: 25.00%')).toBeInTheDocument()
    expect(screen.getByText('P/E (trailing): 28.50')).toBeInTheDocument()
  })

  it('renders the not-advice disclaimer as a footnote', () => {
    renderWithProviders(<ScorecardCard analysis={analysis()} />)
    expect(screen.getByText(/not financial advice/i)).toBeInTheDocument()
  })

  it('renders a hold and a sell verdict', () => {
    const { rerender } = renderWithProviders(
      <ScorecardCard
        analysis={analysis({ recommendation: 'hold', confidence: 'medium' })}
      />,
    )
    expect(screen.getByText('Hold')).toBeInTheDocument()
    expect(screen.getByText('Medium confidence')).toBeInTheDocument()

    rerender(
      <ScorecardCard
        analysis={analysis({ recommendation: 'sell', confidence: 'low' })}
      />,
    )
    expect(screen.getByText('Sell')).toBeInTheDocument()
    expect(screen.getByText('Low confidence')).toBeInTheDocument()
  })

  it('omits the chip row for a section with no metrics', () => {
    renderWithProviders(
      <ScorecardCard
        analysis={analysis({
          sections: [section({ label: 'Solid', metrics: [] })],
        })}
      />,
    )
    // The section still renders (its title/label), just no chips.
    expect(screen.getByText('Business quality')).toBeInTheDocument()
    expect(screen.getByText('Solid')).toBeInTheDocument()
    expect(screen.queryByText(/Net margin/)).not.toBeInTheDocument()
  })
})
