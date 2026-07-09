import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen } from '@/test/test-utils'
import RatingChangesCard from '@/components/RatingChangesCard'
import type { AnalystRatingChanges, RatingChange } from '@/lib/api'

function change(partial: Partial<RatingChange>): RatingChange {
  return {
    firm: 'A Firm',
    published_at: '2026-06-09',
    action: null,
    from_grade: null,
    to_grade: null,
    target_current: null,
    target_prior: null,
    is_upgrade: false,
    is_downgrade: false,
    ...partial,
  }
}

function run(changes: RatingChange[]): AnalystRatingChanges {
  return { symbol: 'AAPL', count: changes.length, changes }
}

describe('RatingChangesCard', () => {
  it('renders an upgrade with the grade move and target move', () => {
    const rc = run([
      change({
        firm: 'TD Cowen',
        action: 'up',
        is_upgrade: true,
        from_grade: 'Hold',
        to_grade: 'Buy',
        target_prior: 335,
        target_current: 350,
      }),
    ])
    renderWithProviders(<RatingChangesCard ratingChanges={rc} />)
    expect(screen.getByText('Recent Analyst Activity')).toBeInTheDocument()
    expect(screen.getByText('TD Cowen')).toBeInTheDocument()
    expect(screen.getByText('Upgraded')).toBeInTheDocument()
    expect(screen.getByText(/Hold → Buy · \$335 → \$350/)).toBeInTheDocument()
  })

  it('renders a downgrade', () => {
    const rc = run([
      change({
        firm: 'KGI Securities',
        action: 'down',
        is_downgrade: true,
        from_grade: 'Outperform',
        to_grade: 'Hold',
      }),
    ])
    renderWithProviders(<RatingChangesCard ratingChanges={rc} />)
    expect(screen.getByText('Downgraded')).toBeInTheDocument()
    expect(screen.getByText(/Outperform → Hold/)).toBeInTheDocument()
  })

  it('shows an initiation as a single grade, no arrow', () => {
    const rc = run([
      change({ firm: 'Maxim Group', action: 'init', to_grade: 'Buy' }),
    ])
    renderWithProviders(<RatingChangesCard ratingChanges={rc} />)
    expect(screen.getByText('Initiated')).toBeInTheDocument()
    expect(screen.queryByText(/→/)).not.toBeInTheDocument() // no from→to move
  })

  it('renders nothing when there are no events', () => {
    renderWithProviders(<RatingChangesCard ratingChanges={run([])} />)
    expect(
      screen.queryByText('Recent Analyst Activity'),
    ).not.toBeInTheDocument()
  })

  it('caps the list and notes how many more there are', () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      change({ firm: `Firm ${i}`, published_at: '2026-06-01' }),
    )
    renderWithProviders(<RatingChangesCard ratingChanges={run(many)} />)
    expect(screen.getByText('Firm 0')).toBeInTheDocument() // among the first 8
    expect(screen.queryByText('Firm 9')).not.toBeInTheDocument() // dropped past the cap
    expect(
      screen.getByText('Showing the 8 most recent of 10.'),
    ).toBeInTheDocument()
  })
})
