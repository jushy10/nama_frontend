import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen } from '@/test/test-utils'
import EarningsCard from '@/components/EarningsCard'
import type { EarningsHistory } from '@/lib/api'

const base: EarningsHistory = {
  symbol: 'NVDA',
  count: 3,
  beats: 2,
  scored: 3,
  beat_rate: 67,
  quarters: [
    {
      period: '2026-05-28',
      fiscal_year: 2027,
      fiscal_quarter: 1,
      actual: 0.96,
      estimate: 0.92,
      surprise: 0.04,
      surprise_percent: 4.3,
      beat: true,
    },
    {
      period: '2025-11-20',
      fiscal_year: 2026,
      fiscal_quarter: 3,
      actual: 0.81,
      estimate: 0.75,
      surprise: 0.06,
      surprise_percent: 8.0,
      beat: true,
    },
    {
      period: '2025-08-28',
      fiscal_year: 2026,
      fiscal_quarter: 2,
      actual: 0.68,
      estimate: 0.7,
      surprise: -0.02,
      surprise_percent: -2.5,
      beat: false,
    },
  ],
}

describe('EarningsCard', () => {
  it('shows the beat-rate summary and per-quarter EPS', () => {
    renderWithProviders(<EarningsCard earnings={base} />)

    expect(
      screen.getByRole('heading', { name: 'Earnings' }),
    ).toBeInTheDocument()
    expect(screen.getByText('67%')).toBeInTheDocument()
    expect(screen.getByText(/2 of 3 quarters/)).toBeInTheDocument()

    // Quarter labels and reported EPS render inside the SVG.
    expect(screen.getByText("Q1 '27")).toBeInTheDocument()
    expect(screen.getByText('$0.96')).toBeInTheDocument()
    expect(screen.getByText('$0.68')).toBeInTheDocument()
  })

  it('signs the surprise percentage for beats and misses', () => {
    renderWithProviders(<EarningsCard earnings={base} />)
    expect(screen.getByText('+8.0%')).toBeInTheDocument()
    expect(screen.getByText('-2.5%')).toBeInTheDocument()
  })

  it('renders a loss quarter (negative EPS) on the same chart', () => {
    renderWithProviders(
      <EarningsCard
        earnings={{
          ...base,
          quarters: [
            {
              period: '2025-08-28',
              fiscal_year: 2026,
              fiscal_quarter: 2,
              actual: -0.15,
              estimate: -0.1,
              surprise: -0.05,
              surprise_percent: -50,
              beat: false,
            },
          ],
        }}
      />,
    )
    expect(screen.getByText('-$0.15')).toBeInTheDocument()
  })

  it('falls back when there is no earnings history', () => {
    renderWithProviders(
      <EarningsCard
        earnings={{
          symbol: 'NVDA',
          count: 0,
          beats: 0,
          scored: 0,
          beat_rate: null,
          quarters: [],
        }}
      />,
    )
    expect(
      screen.getByText(/no earnings history available/i),
    ).toBeInTheDocument()
    // No beat-rate headline when nothing could be scored.
    expect(screen.queryByText('Beat rate')).not.toBeInTheDocument()
  })
})
