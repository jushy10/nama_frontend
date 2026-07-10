import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen } from '@/test/test-utils'
import PeHistoryCard from '@/components/PeHistoryCard'
import type { PeHistory, PeHistoryPoint, PeHistoryStats } from '@/lib/api'

// A run of quarterly points from a list of P/Es (evenly-dated, oldest first).
const history = (pes: number[]): PeHistory => {
  const points: PeHistoryPoint[] = pes.map((pe, i) => ({
    date: `2023-${String(i + 1).padStart(2, '0')}-01`,
    price: pe * 5,
    ttm_eps: 5,
    pe,
  }))
  return { ticker: 'AAPL', count: points.length, points }
}

// The same run, plus a backend `stats` block (the ranked read) overlaid.
const withStats = (pes: number[], stats: PeHistoryStats): PeHistory => ({
  ...history(pes),
  stats,
})

describe('PeHistoryCard', () => {
  it('grades a multiple well above its own median Above Its Avg', () => {
    // median 10, latest 20 → ~100% above.
    renderWithProviders(
      <PeHistoryCard history={history([10, 10, 10, 10, 20])} />,
    )
    expect(screen.getByText('P/E History')).toBeInTheDocument()
    expect(
      screen.getByText(/Trailing multiple over 5 quarters/i),
    ).toBeInTheDocument()
    expect(screen.getByText('Above Its Avg')).toBeInTheDocument()
    expect(
      screen.getByText(/about 100% above its 5-quarter median/i),
    ).toBeInTheDocument()
    // The chart renders as a labelled SVG.
    expect(
      screen.getByRole('img', {
        name: /Trailing P\/E over the last 5 quarters/i,
      }),
    ).toBeInTheDocument()
  })

  it('grades a multiple well below its own median Below Its Avg', () => {
    // median 20, latest 10 → ~50% below.
    renderWithProviders(
      <PeHistoryCard history={history([20, 20, 20, 20, 10])} />,
    )
    expect(screen.getByText('Below Its Avg')).toBeInTheDocument()
    expect(
      screen.getByText(/about 50% below its 5-quarter median/i),
    ).toBeInTheDocument()
  })

  it('calls a multiple within ±10% In Its Range, with no percentage', () => {
    // median 20, latest 21 → ratio 1.05, inside the dead-band.
    renderWithProviders(
      <PeHistoryCard history={history([20, 20, 21, 20, 21])} />,
    )
    expect(screen.getByText('In Its Range')).toBeInTheDocument()
    expect(screen.getByText(/about where it usually sits/i)).toBeInTheDocument()
  })

  it('renders nothing when the series is too short to be a history', () => {
    const { container } = renderWithProviders(
      <PeHistoryCard history={history([18, 20])} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  // --- The backend-ranked path (a `stats` block present) -------------------------

  it('takes the verdict and percentile from the backend stats when present', () => {
    // A cheap signal at the 6th percentile — the ranked read, not the ±10% median
    // heuristic (which on these numbers would also read below, but the wording and
    // the shaded band are what the stats path adds).
    renderWithProviders(
      <PeHistoryCard
        history={withStats([20, 22, 24, 26, 28, 30, 25, 15], {
          current_pe: 15,
          median_pe: 24,
          p25_pe: 21,
          p75_pe: 26,
          min_pe: 15,
          max_pe: 30,
          current_percentile: 6.2,
          discount_to_median_percent: -37.5,
          signal: 'cheap',
          sample_size: 8,
        })}
      />,
    )
    expect(screen.getByText('Below Its Avg')).toBeInTheDocument()
    expect(screen.getByText('6th percentile')).toBeInTheDocument()
    // The stats summary uses the percentile complement ("cheaper than 94% ...").
    expect(
      screen.getByText(/cheaper than 94% of the last 8 quarters/i),
    ).toBeInTheDocument()
    // The chart notes the shaded interquartile band in its label.
    expect(
      screen.getByRole('img', {
        name: /Trailing P\/E over the last 8 quarters, with its usual 25th–75th percentile range shaded/i,
      }),
    ).toBeInTheDocument()
  })

  it('grades an expensive backend signal Above Its Avg', () => {
    renderWithProviders(
      <PeHistoryCard
        history={withStats([15, 16, 17, 18, 19, 20, 21, 30], {
          current_pe: 30,
          median_pe: 18.5,
          p25_pe: 16.75,
          p75_pe: 20.25,
          min_pe: 15,
          max_pe: 30,
          current_percentile: 93.8,
          discount_to_median_percent: 62.2,
          signal: 'expensive',
          sample_size: 8,
        })}
      />,
    )
    expect(screen.getByText('Above Its Avg')).toBeInTheDocument()
    expect(screen.getByText('94th percentile')).toBeInTheDocument()
    expect(
      screen.getByText(/higher than 94% of the last 8 quarters/i),
    ).toBeInTheDocument()
  })
})
