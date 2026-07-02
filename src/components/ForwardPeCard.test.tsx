import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen } from '@/test/test-utils'
import ForwardPeCard from '@/components/ForwardPeCard'
import type {
  AnnualEarnings,
  QuarterlyEarnings,
  QuarterlyEarningsQuarter,
} from '@/lib/api'

const q = (
  over: Partial<QuarterlyEarningsQuarter>,
): QuarterlyEarningsQuarter => ({
  fiscal_year: null,
  fiscal_quarter: null,
  period_end: null,
  report_date: null,
  eps_actual: null,
  eps_estimate: null,
  eps_surprise: null,
  eps_surprise_percent: null,
  revenue_estimate: null,
  revenue_actual: null,
  beat: null,
  is_reported: false,
  ...over,
})

// Four reported quarters (TTM EPS 0.68+0.81+0.89+0.96 = 3.34) plus two
// upcoming ones with a consensus, oldest → newest as the endpoint serves them.
const quarterlySample: QuarterlyEarnings = {
  symbol: 'NVDA',
  count: 6,
  reported_count: 4,
  upcoming_count: 2,
  quarters: [
    q({
      fiscal_year: 2026,
      fiscal_quarter: 2,
      period_end: '2025-08-28',
      eps_actual: 0.68,
      is_reported: true,
    }),
    q({
      fiscal_year: 2026,
      fiscal_quarter: 3,
      period_end: '2025-11-20',
      eps_actual: 0.81,
      is_reported: true,
    }),
    q({
      fiscal_year: 2026,
      fiscal_quarter: 4,
      period_end: '2026-02-25',
      eps_actual: 0.89,
      is_reported: true,
    }),
    q({
      fiscal_year: 2027,
      fiscal_quarter: 1,
      period_end: '2026-05-28',
      eps_actual: 0.96,
      is_reported: true,
    }),
    q({
      fiscal_year: 2027,
      fiscal_quarter: 2,
      period_end: '2026-08-27',
      eps_estimate: 1.05,
    }),
    q({
      fiscal_year: 2027,
      fiscal_quarter: 3,
      period_end: '2026-11-26',
      eps_estimate: 1.18,
    }),
  ],
}

const year = (
  over: Partial<AnnualEarnings['years'][number]>,
): AnnualEarnings['years'][number] => ({
  fiscal_year: null,
  period_end: null,
  eps_actual: null,
  eps_estimate: null,
  revenue_actual: null,
  revenue_estimate: null,
  net_income: null,
  is_reported: false,
  ...over,
})

// One reported fiscal year plus the two forecast years the card walks across.
const annualSample: AnnualEarnings = {
  symbol: 'NVDA',
  count: 3,
  reported_count: 1,
  upcoming_count: 2,
  years: [
    year({
      fiscal_year: 2026,
      period_end: '2026-01-31',
      eps_actual: 3.1,
      revenue_actual: 200_000_000_000,
      net_income: 100_000_000_000,
      is_reported: true,
    }),
    year({
      fiscal_year: 2027,
      period_end: '2027-01-25',
      eps_estimate: 4.0,
      revenue_estimate: 300_000_000_000,
    }),
    year({
      fiscal_year: 2028,
      period_end: '2028-01-24',
      eps_estimate: 5.0,
      revenue_estimate: 350_000_000_000,
    }),
  ],
}

describe('ForwardPeCard', () => {
  it('walks Current P/E → FY1 → FY2 at today’s price', () => {
    renderWithProviders(
      <ForwardPeCard
        price={200}
        quarterly={quarterlySample}
        annual={annualSample}
      />,
    )

    expect(
      screen.getByRole('heading', { name: 'Forward P/E' }),
    ).toBeInTheDocument()

    // Current: 200 ÷ 3.34 (adjusted TTM, the last four reported actuals).
    // The multiple shows on the tile and again on the chart's "Now" bar.
    expect(screen.getByText('Current P/E')).toBeInTheDocument()
    expect(screen.getAllByText('59.88').length).toBeGreaterThan(0)
    expect(screen.getByText('Adj. TTM EPS $3.34')).toBeInTheDocument()

    // FY1: 200 ÷ 4.00 and FY2: 200 ÷ 5.00, labelled with their fiscal years.
    // Each multiple shows on its tile and again on the fiscal-year chart.
    expect(screen.getByText('Fwd P/E FY27')).toBeInTheDocument()
    expect(screen.getAllByText('50.00').length).toBeGreaterThan(0)
    expect(screen.getByText('Est. EPS $4.00')).toBeInTheDocument()
    expect(screen.getByText('Fwd P/E FY28')).toBeInTheDocument()
    expect(screen.getAllByText('40.00').length).toBeGreaterThan(0)
    expect(screen.getByText('Est. EPS $5.00')).toBeInTheDocument()

    // The walk is also drawn as columns: Now + one bar per forecast year.
    expect(screen.getByText('By fiscal year')).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: /by fiscal year/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('FY27')).toBeInTheDocument()
    expect(screen.getByText('FY28')).toBeInTheDocument()

    // Each forward step carries its move versus today's multiple
    // (3.34/4 − 1 = −16.5%; 3.34/5 − 1 = −33.2%).
    expect(screen.getByText('-16.5% vs now')).toBeInTheDocument()
    expect(screen.getByText('-33.2% vs now')).toBeInTheDocument()

    // The basis is spelled out so it doesn't contradict the valuation grid.
    expect(
      screen.getByText(/same non-GAAP basis as the analyst consensus/i),
    ).toBeInTheDocument()
  })

  it('tints a compressing multiple green and an expanding one red', () => {
    renderWithProviders(
      <ForwardPeCard
        price={200}
        quarterly={quarterlySample}
        annual={{
          ...annualSample,
          years: [
            // A consensus BELOW the TTM EPS → the forward multiple expands.
            year({ fiscal_year: 2027, eps_estimate: 2.0 }),
            year({ fiscal_year: 2028, eps_estimate: 5.0 }),
          ],
        }}
      />,
    )
    // Dark theme (the test default) palette: success.main / error.main.
    const green = 'rgb(52, 211, 153)'
    const red = 'rgb(248, 113, 113)'
    // FY27: 3.34/2 − 1 = +67% (expands, red); FY28: −33.2% (compresses, green).
    expect(screen.getByText('+67.0% vs now')).toHaveStyle({ color: red })
    expect(screen.getByText('-33.2% vs now')).toHaveStyle({ color: green })
  })

  it('charts the rolling 12-month P/E for each upcoming quarter', () => {
    renderWithProviders(
      <ForwardPeCard
        price={200}
        quarterly={quarterlySample}
        annual={annualSample}
      />,
    )

    expect(screen.getByText('By quarter')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /by quarter/i })).toBeInTheDocument()

    // The trailing anchor bar (it opens the fiscal-year chart too)…
    expect(screen.getAllByText('Now').length).toBeGreaterThan(0)
    // …then each upcoming quarter's rolling window: Q2'27 ends on
    // 0.81+0.89+0.96+1.05 = 3.71 → 53.91; Q3'27 on 0.89+0.96+1.05+1.18
    // = 4.08 → 49.02.
    expect(screen.getByText("Q2 '27")).toBeInTheDocument()
    expect(screen.getByText('53.91')).toBeInTheDocument()
    expect(screen.getByText("Q3 '27")).toBeInTheDocument()
    expect(screen.getByText('49.02')).toBeInTheDocument()
  })

  it('skips a quarter whose rolling window is incomplete', () => {
    renderWithProviders(
      <ForwardPeCard
        price={200}
        quarterly={{
          ...quarterlySample,
          // Knock out one actual inside Q2'27's window: that bar drops, but
          // Q3'27 (whose window no longer includes it) still charts.
          quarters: quarterlySample.quarters.map((qq) =>
            qq.fiscal_quarter === 3 && qq.fiscal_year === 2026
              ? { ...qq, eps_actual: null }
              : qq,
          ),
        }}
        annual={annualSample}
      />,
    )
    expect(screen.queryByText("Q2 '27")).not.toBeInTheDocument()
    expect(screen.getByText("Q3 '27")).toBeInTheDocument()
    // Only three usable actuals now, so there's no Current P/E either.
    expect(screen.queryByText('Now')).not.toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('falls back to the snapshot forward P/E when the annual series is missing', () => {
    renderWithProviders(<ForwardPeCard price={200} forwardPe={38.5} />)
    expect(screen.getByText('Fwd P/E (next FY)')).toBeInTheDocument()
    expect(screen.getByText('38.50')).toBeInTheDocument()
    // No quarterly series → no rolling chart; and a single step with no
    // "Now" anchor isn't worth a fiscal-year chart either.
    expect(screen.queryByText('By quarter')).not.toBeInTheDocument()
    expect(screen.queryByText('By fiscal year')).not.toBeInTheDocument()
  })

  it('shows an em dash for a fiscal year whose consensus is a loss', () => {
    renderWithProviders(
      <ForwardPeCard
        price={200}
        annual={{
          ...annualSample,
          years: [year({ fiscal_year: 2027, eps_estimate: -0.5 })],
        }}
      />,
    )
    // A P/E over negative earnings is meaningless — dash, not a negative PE.
    expect(screen.getByText('Fwd P/E FY27')).toBeInTheDocument()
    expect(screen.getByText('Est. EPS -$0.50')).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
    expect(screen.queryByText('-400.00')).not.toBeInTheDocument()
  })

  it('renders nothing when there is no forward consensus at all', () => {
    const { container } = renderWithProviders(
      <ForwardPeCard
        price={200}
        quarterly={{
          ...quarterlySample,
          quarters: quarterlySample.quarters.filter((qq) => qq.is_reported),
        }}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
