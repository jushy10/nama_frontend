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
  it('shows the header and per-quarter EPS', () => {
    renderWithProviders(<EarningsCard earnings={base} />)

    expect(
      screen.getByRole('heading', { name: 'Earnings' }),
    ).toBeInTheDocument()

    // Quarter labels and reported EPS render inside the SVG. The newest
    // quarter's label (Q1 '27) and actual ($0.96) also appear in the detail
    // line, hence getAll.
    expect(screen.getAllByText("Q1 '27").length).toBeGreaterThan(0)
    expect(screen.getAllByText('$0.96').length).toBeGreaterThan(0)
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
    expect(screen.getAllByText('-$0.15').length).toBeGreaterThan(0)
  })

  it('renders the trailing metric tiles when metrics are present', () => {
    renderWithProviders(
      <EarningsCard
        earnings={{
          ...base,
          metrics: {
            eps: 8.27,
            eps_growth_yoy: 29.0,
            revenue_growth_yoy: 12.8,
            gross_margin: null, // vendor-uncovered -> em dash
            operating_margin: 32.6,
            net_margin: 27.2,
            roe: 146.7,
            roic: null,
            payout_ratio: 12.7,
          },
        }}
      />,
    )
    expect(screen.getByText('Trailing metrics')).toBeInTheDocument()
    expect(screen.getByText('EPS (TTM)')).toBeInTheDocument()
    expect(screen.getByText('$8.27')).toBeInTheDocument()
    expect(screen.getByText('+29.0%')).toBeInTheDocument() // growth: signed
    expect(screen.getByText('27.2%')).toBeInTheDocument() // margin: plain
    // A null metric renders an em dash rather than vanishing.
    expect(screen.getByText('Gross Margin')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
    // ROE / ROIC / Payout were removed from the card.
    expect(screen.queryByText('ROE')).not.toBeInTheDocument()
    expect(screen.queryByText('ROIC')).not.toBeInTheDocument()
    expect(screen.queryByText('Payout')).not.toBeInTheDocument()
  })

  it('omits the trailing metrics block when metrics are absent', () => {
    renderWithProviders(<EarningsCard earnings={base} />)
    expect(screen.queryByText('Trailing metrics')).not.toBeInTheDocument()
  })

  it('plots a forward expected bar when an upcoming consensus is present', () => {
    renderWithProviders(
      <EarningsCard
        earnings={{
          ...base,
          next_report: {
            report_date: '2026-07-30',
            fiscal_year: 2027,
            fiscal_quarter: 2,
            eps_estimate: 1.05,
            revenue_estimate: 89_000_000_000,
            session: 'amc',
          },
        }}
      />,
    )
    expect(screen.getByText('$1.05')).toBeInTheDocument() // EPS consensus
    expect(screen.getAllByText('$89B').length).toBeGreaterThan(0) // revenue
    // The forecast label and date appear on both the EPS and revenue charts.
    expect(screen.getAllByText("Q2 '27").length).toBeGreaterThan(0)
    expect(screen.getAllByText('Est. Jul 30').length).toBeGreaterThan(0)
    expect(screen.getByText('Upcoming (est.)')).toBeInTheDocument() // legend entry
  })

  it('plots multiple upcoming quarters from the analyst estimates list', () => {
    renderWithProviders(
      <EarningsCard
        earnings={{
          ...base,
          upcoming: [
            {
              report_date: '2026-09-30',
              fiscal_year: null,
              fiscal_quarter: null,
              eps_estimate: 2.1,
              revenue_estimate: 120_000_000_000,
              session: null,
            },
            {
              report_date: '2026-12-31',
              fiscal_year: null,
              fiscal_quarter: null,
              eps_estimate: 2.45,
              revenue_estimate: 130_000_000_000,
              session: null,
            },
          ],
        }}
      />,
    )
    // Two forecast columns on each chart, with their consensus EPS/revenue and
    // expected date. The dates appear on both the EPS and revenue charts.
    expect(screen.getByText('$2.10')).toBeInTheDocument() // EPS consensus
    expect(screen.getByText('$2.45')).toBeInTheDocument()
    expect(screen.getAllByText('$120B').length).toBeGreaterThan(0) // revenue
    expect(screen.getByText('$130B')).toBeInTheDocument()
    expect(screen.getAllByText('Est. Sep 30').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Est. Dec 31').length).toBeGreaterThan(0)
    expect(screen.getByText('Upcoming (est.)')).toBeInTheDocument()
  })

  it('omits the forward bar when there is no upcoming consensus', () => {
    renderWithProviders(
      <EarningsCard
        earnings={{
          ...base,
          next_report: {
            report_date: '2026-07-30',
            fiscal_year: 2027,
            fiscal_quarter: 2,
            eps_estimate: null, // scheduled, but no consensus yet
            revenue_estimate: null,
            session: null,
          },
        }}
      />,
    )
    expect(screen.queryByText('Upcoming (est.)')).not.toBeInTheDocument()
    expect(screen.queryByText('Est. Jul 30')).not.toBeInTheDocument()
  })

  it('shows a detail line with the latest quarter estimate vs. actual', () => {
    renderWithProviders(<EarningsCard earnings={base} />)
    // Default detail = newest reported quarter (Q1 '27): est 0.92 → act 0.96.
    // Estimates aren't labelled on the bars, so $0.92 is unique to the line.
    expect(screen.getByText('Est')).toBeInTheDocument()
    expect(screen.getByText('Act')).toBeInTheDocument()
    expect(screen.getByText('$0.92')).toBeInTheDocument()
  })

  it('renders a revenue chart with expected vs. released figures', () => {
    renderWithProviders(
      <EarningsCard
        earnings={{
          ...base,
          quarters: [
            {
              ...base.quarters[0],
              revenue_estimate: 95_400_000_000,
              revenue_actual: 97_100_000_000,
            },
            ...base.quarters.slice(1),
          ],
        }}
      />,
    )
    // Revenue gets its own chart; the newest quarter is the default detail line.
    expect(screen.getByText('Revenue')).toBeInTheDocument()
    expect(screen.getByText('$95.4B')).toBeInTheDocument() // estimate (detail only)
    // Actual shows both in the detail line and beneath the bar.
    expect(screen.getAllByText('$97.1B').length).toBeGreaterThan(0)
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
    // No "next report" chip when none is scheduled.
    expect(screen.queryByText('Next report')).not.toBeInTheDocument()
  })

  it('shows a "next report" chip from the scheduled report', () => {
    renderWithProviders(
      <EarningsCard
        earnings={{
          ...base,
          next_report: {
            report_date: '2026-07-30',
            fiscal_year: 2027,
            fiscal_quarter: 2,
            eps_estimate: 1.93,
            revenue_estimate: null,
            session: 'amc',
          },
        }}
      />,
    )
    expect(screen.getByText('Next report')).toBeInTheDocument()
    expect(screen.getByText('Jul 30')).toBeInTheDocument()
    expect(screen.getByText('Est $1.93')).toBeInTheDocument()
  })

  it('chip prefers the upcoming list, so it matches the forecast bar', () => {
    renderWithProviders(
      <EarningsCard
        earnings={{
          ...base,
          // Different vendor for the scheduled date/estimate...
          next_report: {
            report_date: '2026-07-29',
            fiscal_year: 2027,
            fiscal_quarter: 2,
            eps_estimate: 1.93,
            revenue_estimate: null,
            session: 'amc',
          },
          // ...but `upcoming` (the chart's source) wins, so they agree.
          upcoming: [
            {
              report_date: '2026-07-30',
              fiscal_year: null,
              fiscal_quarter: null,
              eps_estimate: 1.88,
              revenue_estimate: 110_000_000_000,
              session: null,
            },
          ],
        }}
      />,
    )
    expect(screen.getByText('Jul 30')).toBeInTheDocument() // upcoming date
    expect(screen.getByText('Est $1.88')).toBeInTheDocument() // upcoming estimate
    expect(screen.queryByText('Est $1.93')).not.toBeInTheDocument() // not next_report
  })
})
