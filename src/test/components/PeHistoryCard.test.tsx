import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen } from '@/test/test-utils'
import PeHistoryCard from '@/components/PeHistoryCard'
import type { PeHistory, PeHistoryPoint } from '@/lib/api'

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
})
