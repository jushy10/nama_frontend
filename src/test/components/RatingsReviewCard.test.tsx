import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen } from '@/test/test-utils'
import RatingsReviewCard from '@/components/RatingsReviewCard'
import type { RatingsAnalysis } from '@/lib/api'

function analysis(overrides: Partial<RatingsAnalysis> = {}): RatingsAnalysis {
  return {
    symbol: 'NVDA',
    verdict: 'bullish',
    confidence: 'high',
    summary: 'Analysts are overwhelmingly positive on the stock.',
    findings: [
      '95% rate it Buy or better',
      'A wide target range signals disagreement',
    ],
    disclaimer: 'AI-generated — not financial advice.',
    model: 'claude-haiku-4-5',
    generated_at: '2026-07-09T00:00:00Z',
    ...overrides,
  }
}

describe('RatingsReviewCard', () => {
  it('shows the header, verdict, confidence, summary and findings', () => {
    renderWithProviders(<RatingsReviewCard analysis={analysis()} />)
    expect(screen.getByText('Ratings Analysis')).toBeInTheDocument()
    expect(screen.getByText('Bullish')).toBeInTheDocument()
    expect(screen.getByText('High confidence')).toBeInTheDocument()
    expect(screen.getByText(/overwhelmingly positive/)).toBeInTheDocument()
    expect(screen.getByText('95% rate it Buy or better')).toBeInTheDocument()
    expect(screen.getByText(/wide target range/)).toBeInTheDocument()
    expect(screen.getByText(/not financial advice/)).toBeInTheDocument()
  })

  it('renders the cautious verdict with its confidence', () => {
    renderWithProviders(
      <RatingsReviewCard
        analysis={analysis({ verdict: 'cautious', confidence: 'low' })}
      />,
    )
    expect(screen.getByText('Cautious')).toBeInTheDocument()
    expect(screen.getByText('Low confidence')).toBeInTheDocument()
  })

  it('renders the mixed verdict with its confidence', () => {
    renderWithProviders(
      <RatingsReviewCard
        analysis={analysis({ verdict: 'mixed', confidence: 'medium' })}
      />,
    )
    expect(screen.getByText('Mixed')).toBeInTheDocument()
    expect(screen.getByText('Medium confidence')).toBeInTheDocument()
  })
})
