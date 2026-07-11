import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen } from '@/test/test-utils'
import AnalysisCard from '@/components/AnalysisCard'
import type { AnalysisBase } from '@/lib/api'

function analysis(overrides: Partial<AnalysisBase> = {}): AnalysisBase {
  return {
    recommendation: 'buy',
    confidence: 'high',
    thesis:
      'Apple keeps turning a huge profit and the price looks fair for it.',
    strengths: [
      'Makes money on nearly every sale',
      'Loyal customers keep coming back',
    ],
    risks: ['iPhone sales could slow', 'The stock is not cheap'],
    disclaimer:
      'AI-generated for informational purposes only — not financial advice.',
    model: 'claude-haiku-4-5',
    generated_at: '2026-07-08T00:00:00Z',
    ...overrides,
  }
}

describe('AnalysisCard', () => {
  it('shows the verdict, confidence, and thesis', () => {
    renderWithProviders(<AnalysisCard analysis={analysis()} />)
    expect(screen.getByText('AI Analysis')).toBeInTheDocument()
    expect(screen.getByText('Buy')).toBeInTheDocument()
    expect(screen.getByText('High confidence')).toBeInTheDocument()
    expect(screen.getByText(/turning a huge profit/i)).toBeInTheDocument()
  })

  it('lists the strengths and the risks', () => {
    renderWithProviders(<AnalysisCard analysis={analysis()} />)
    expect(screen.getByText('Strengths')).toBeInTheDocument()
    expect(screen.getByText('Risks')).toBeInTheDocument()
    expect(screen.getByText(/loyal customers/i)).toBeInTheDocument()
    expect(screen.getByText(/iPhone sales could slow/i)).toBeInTheDocument()
  })

  it('renders the not-advice disclaimer as a footnote', () => {
    renderWithProviders(<AnalysisCard analysis={analysis()} />)
    expect(screen.getByText(/not financial advice/i)).toBeInTheDocument()
  })

  it('renders a hold verdict', () => {
    renderWithProviders(
      <AnalysisCard
        analysis={analysis({ recommendation: 'hold', confidence: 'medium' })}
      />,
    )
    expect(screen.getByText('Hold')).toBeInTheDocument()
    expect(screen.getByText('Medium confidence')).toBeInTheDocument()
  })

  it('renders a sell verdict', () => {
    renderWithProviders(
      <AnalysisCard
        analysis={analysis({ recommendation: 'sell', confidence: 'low' })}
      />,
    )
    expect(screen.getByText('Sell')).toBeInTheDocument()
    expect(screen.getByText('Low confidence')).toBeInTheDocument()
  })

  it('omits an empty list rather than leaving a bare heading', () => {
    renderWithProviders(<AnalysisCard analysis={analysis({ risks: [] })} />)
    expect(screen.getByText('Strengths')).toBeInTheDocument()
    expect(screen.queryByText('Risks')).not.toBeInTheDocument()
  })
})
