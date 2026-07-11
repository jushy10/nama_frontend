import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen } from '@/test/test-utils'
import FundamentalsAnalysisCard from '@/components/FundamentalsAnalysisCard'
import type { FundamentalsAnalysis } from '@/lib/api'

function analysis(
  overrides: Partial<FundamentalsAnalysis> = {},
): FundamentalsAnalysis {
  return {
    symbol: 'AAPL',
    verdict: 'strong',
    confidence: 'high',
    summary: 'Profitable and growing, at a reasonable price.',
    findings: [
      'Keeps a big share of sales as profit',
      'Revenue still growing double digits',
    ],
    disclaimer: 'AI-generated — not financial advice.',
    model: 'claude-haiku-4-5',
    generated_at: '2026-07-11T00:00:00Z',
    ...overrides,
  }
}

describe('FundamentalsAnalysisCard', () => {
  it('shows the header, verdict, confidence, summary and findings', () => {
    renderWithProviders(<FundamentalsAnalysisCard analysis={analysis()} />)
    expect(screen.getByText('Fundamentals Analysis')).toBeInTheDocument()
    expect(screen.getByText('Strong')).toBeInTheDocument()
    expect(screen.getByText('High confidence')).toBeInTheDocument()
    expect(screen.getByText(/Profitable and growing/)).toBeInTheDocument()
    expect(
      screen.getByText('Keeps a big share of sales as profit'),
    ).toBeInTheDocument()
    expect(screen.getByText(/growing double digits/)).toBeInTheDocument()
    expect(screen.getByText(/not financial advice/)).toBeInTheDocument()
  })

  it('renders the weak verdict with its confidence', () => {
    renderWithProviders(
      <FundamentalsAnalysisCard
        analysis={analysis({ verdict: 'weak', confidence: 'low' })}
      />,
    )
    expect(screen.getByText('Weak')).toBeInTheDocument()
    expect(screen.getByText('Low confidence')).toBeInTheDocument()
  })

  it('renders the mixed verdict with its confidence', () => {
    renderWithProviders(
      <FundamentalsAnalysisCard
        analysis={analysis({ verdict: 'mixed', confidence: 'medium' })}
      />,
    )
    expect(screen.getByText('Mixed')).toBeInTheDocument()
    expect(screen.getByText('Medium confidence')).toBeInTheDocument()
  })
})
