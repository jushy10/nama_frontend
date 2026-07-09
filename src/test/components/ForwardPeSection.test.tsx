import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen } from '@/test/test-utils'
import { ForwardPeSection } from '@/components/ForwardPeSection'
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
  eps_actual_consensus: null,
  is_reported: false,
  ...over,
})

// One reported fiscal year plus the two forecast years the card walks across.
// The reported year carries both bases: GAAP diluted 3.10 and the
// consensus-basis 3.20 the anchor should prefer.
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
      eps_actual_consensus: 3.2,
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

describe('ForwardPeSection — annual', () => {
  it('walks the last fiscal year’s P/E → FY1 → FY2 at today’s price', () => {
    renderWithProviders(
      <ForwardPeSection price={200} annual={annualSample} period="annual" />,
    )

    expect(
      screen.getByRole('heading', { name: 'Forward P/E' }),
    ).toBeInTheDocument()
    expect(screen.getByText('By fiscal year')).toBeInTheDocument()

    // Anchor: 200 ÷ 3.20 — the last completed fiscal year's reported EPS on
    // the consensus basis (preferred over the GAAP 3.10). The multiple shows
    // on the tile and again on the fiscal-year chart's anchor bar, labelled
    // with the year.
    expect(screen.getByText('P/E FY26')).toBeInTheDocument()
    expect(screen.getAllByText('62.50').length).toBeGreaterThan(0)
    expect(screen.getByText('Reported EPS $3.20')).toBeInTheDocument()
    expect(screen.getByText('FY26')).toBeInTheDocument()

    // FY1: 200 ÷ 4.00 and FY2: 200 ÷ 5.00, labelled with their fiscal years.
    // Each multiple shows on its tile and again on the fiscal-year chart.
    expect(screen.getByText('Fwd P/E FY27')).toBeInTheDocument()
    expect(screen.getAllByText('50.00').length).toBeGreaterThan(0)
    expect(screen.getByText('Est. EPS $4.00')).toBeInTheDocument()
    expect(screen.getByText('Fwd P/E FY28')).toBeInTheDocument()
    expect(screen.getAllByText('40.00').length).toBeGreaterThan(0)
    expect(screen.getByText('Est. EPS $5.00')).toBeInTheDocument()

    // The walk is also drawn as columns: FY26 + one bar per forecast year.
    expect(
      screen.getByRole('img', { name: /by fiscal year/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('FY27')).toBeInTheDocument()
    expect(screen.getByText('FY28')).toBeInTheDocument()

    // Each forward step carries its move versus the anchor multiple
    // (50/62.50 − 1 = −20.0%; 40/62.50 − 1 = −36.0%).
    expect(screen.getByText('-20.0% vs FY26')).toBeInTheDocument()
    expect(screen.getByText('-36.0% vs FY26')).toBeInTheDocument()

    // Anchored on the consensus basis, the walk compares like with like — the
    // caption says so, and the GAAP caveat is gone.
    expect(screen.getByText(/analyst-consensus basis/i)).toBeInTheDocument()
    expect(screen.queryByText(/GAAP/)).not.toBeInTheDocument()
  })

  it('anchors on GAAP diluted EPS, with the caveat, when no consensus-basis actual is served', () => {
    renderWithProviders(
      <ForwardPeSection
        price={200}
        annual={{
          ...annualSample,
          years: annualSample.years.map((y) =>
            y.is_reported ? { ...y, eps_actual_consensus: null } : y,
          ),
        }}
        period="annual"
      />,
    )

    // Anchor falls back to 200 ÷ 3.10 (GAAP diluted), and the tile names the
    // basis so the mismatch with the consensus steps is visible.
    expect(screen.getAllByText('64.52').length).toBeGreaterThan(0)
    expect(screen.getByText('Reported EPS $3.10 (GAAP)')).toBeInTheDocument()
    // The caption owns up to the basis gap again.
    expect(
      screen.getByText(/can sit above reported \(GAAP\) EPS/i),
    ).toBeInTheDocument()
  })

  it('tints a compressing multiple green and an expanding one red', () => {
    renderWithProviders(
      <ForwardPeSection
        price={200}
        annual={{
          ...annualSample,
          years: [
            year({ fiscal_year: 2026, eps_actual: 3.1, is_reported: true }),
            // A consensus low enough that the forward multiple expands.
            year({ fiscal_year: 2027, eps_estimate: 2.0 }),
            year({ fiscal_year: 2028, eps_estimate: 5.0 }),
          ],
        }}
        period="annual"
      />,
    )
    // Dark theme (the test default) palette: success.main / error.main.
    const green = 'rgb(52, 211, 153)'
    const red = 'rgb(248, 113, 113)'
    // FY27: 100/64.52 − 1 = +55% (expands, red); FY28: −38.0% (compresses,
    // green).
    expect(screen.getByText('+55.0% vs FY26')).toHaveStyle({ color: red })
    expect(screen.getByText('-38.0% vs FY26')).toHaveStyle({ color: green })
  })

  it('shows an em dash for a fiscal year whose consensus is a loss', () => {
    renderWithProviders(
      <ForwardPeSection
        price={200}
        annual={{
          ...annualSample,
          years: [year({ fiscal_year: 2027, eps_estimate: -0.5 })],
        }}
        period="annual"
      />,
    )
    // A P/E over negative earnings is meaningless — dash, not a negative PE.
    expect(screen.getByText('Fwd P/E FY27')).toBeInTheDocument()
    expect(screen.getByText('Est. EPS -$0.50')).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
    expect(screen.queryByText('-400.00')).not.toBeInTheDocument()
  })

  it('renders nothing on the annual view when there is no forward fiscal year', () => {
    const { container } = renderWithProviders(
      <ForwardPeSection
        price={200}
        annual={{
          ...annualSample,
          years: annualSample.years.filter((y) => y.is_reported),
        }}
        period="annual"
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})

describe('ForwardPeSection — quarterly', () => {
  it('walks and charts the rolling 12-month P/E for each upcoming quarter', () => {
    renderWithProviders(
      <ForwardPeSection
        price={200}
        quarterly={quarterlySample}
        period="quarterly"
      />,
    )

    expect(
      screen.getByRole('heading', { name: 'Forward P/E' }),
    ).toBeInTheDocument()
    expect(screen.getByText('By quarter')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /by quarter/i })).toBeInTheDocument()

    // The anchor is the trailing twelve months through the last reported
    // quarter: 200 ÷ 3.34 (the last four reported actuals summed), labelled
    // Q1 '27 on both the tile and the chart's opening bar. "Now" is gone.
    expect(screen.getByText("P/E Q1 '27")).toBeInTheDocument()
    expect(screen.getAllByText('59.88').length).toBeGreaterThan(0)
    expect(screen.getByText('TTM EPS $3.34')).toBeInTheDocument()
    expect(screen.getByText("Q1 '27")).toBeInTheDocument()
    expect(screen.queryByText('Now')).not.toBeInTheDocument()

    // …then each upcoming quarter's rolling window as tile + bar: Q2'27 ends
    // on 0.81+0.89+0.96+1.05 = 3.71 → 53.91; Q3'27 on 0.89+0.96+1.05+1.18
    // = 4.08 → 49.02.
    expect(screen.getByText("Fwd P/E Q2 '27")).toBeInTheDocument()
    expect(screen.getAllByText('53.91').length).toBeGreaterThan(0)
    expect(screen.getByText('Est. TTM EPS $3.71')).toBeInTheDocument()
    expect(screen.getByText("Fwd P/E Q3 '27")).toBeInTheDocument()
    expect(screen.getAllByText('49.02').length).toBeGreaterThan(0)
    expect(screen.getByText('Est. TTM EPS $4.08')).toBeInTheDocument()

    // Each forward step carries its move versus the quarter anchor
    // (3.34/3.71 − 1 = −10.0%; 3.34/4.08 − 1 = −18.1%).
    expect(screen.getByText("-10.0% vs Q1 '27")).toBeInTheDocument()
    expect(screen.getByText("-18.1% vs Q1 '27")).toBeInTheDocument()
  })

  it('skips a quarter whose rolling window is incomplete', () => {
    renderWithProviders(
      <ForwardPeSection
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
        period="quarterly"
      />,
    )
    expect(screen.queryByText("Fwd P/E Q2 '27")).not.toBeInTheDocument()
    expect(screen.getByText("Fwd P/E Q3 '27")).toBeInTheDocument()
    // One usable multiple isn't a comparison — the by-quarter chart stays
    // hidden and the walk's lone step reads on its tile.
    expect(
      screen.queryByRole('img', { name: /by quarter/i }),
    ).not.toBeInTheDocument()
    // Only three usable actuals remain, so the quarter walk loses its
    // trailing-TTM anchor — the tile renders unlabelled with an em dash.
    expect(screen.getByText('P/E (TTM)')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('keeps a quarter whose rolling window is a loss, dashing its multiple', () => {
    renderWithProviders(
      <ForwardPeSection
        price={200}
        quarterly={{
          ...quarterlySample,
          // Every reported actual and upcoming consensus is a loss, so both
          // the TTM anchor and each rolling window sum negative.
          quarters: quarterlySample.quarters.map((qq) =>
            qq.is_reported
              ? { ...qq, eps_actual: -(qq.eps_actual as number) }
              : { ...qq, eps_estimate: -(qq.eps_estimate as number) },
          ),
        }}
        period="quarterly"
      />,
    )
    // The section and its steps stay, each showing the consensus window with
    // a dash instead of a negative multiple.
    expect(screen.getByText('By quarter')).toBeInTheDocument()
    expect(screen.getByText("P/E Q1 '27")).toBeInTheDocument()
    expect(screen.getByText('TTM EPS -$3.34')).toBeInTheDocument()
    expect(screen.getByText("Fwd P/E Q2 '27")).toBeInTheDocument()
    expect(screen.getByText('Est. TTM EPS -$3.71')).toBeInTheDocument()
    expect(screen.getByText("Fwd P/E Q3 '27")).toBeInTheDocument()
    expect(screen.getByText('Est. TTM EPS -$4.08')).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBe(3)
    // No positive multiple anywhere → no bar chart.
    expect(
      screen.queryByRole('img', { name: /by quarter/i }),
    ).not.toBeInTheDocument()
  })

  it('renders nothing on the quarterly view when there is no upcoming quarter', () => {
    const { container } = renderWithProviders(
      <ForwardPeSection
        price={200}
        quarterly={{
          ...quarterlySample,
          quarters: quarterlySample.quarters.filter((qq) => qq.is_reported),
        }}
        period="quarterly"
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})

describe('ForwardPeSection — Current P/E', () => {
  it('threads the Current P/E tile and a "Now" bar into the annual walk', () => {
    renderWithProviders(
      <ForwardPeSection
        price={200}
        annual={annualSample}
        trailingPe={55.5}
        period="annual"
      />,
    )
    // The trailing multiple sits between the reported anchor and the forward
    // steps, with the "price ÷ TTM EPS" hint under the tile…
    expect(screen.getByText('Current P/E')).toBeInTheDocument()
    expect(screen.getAllByText('55.50').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Price ÷ trailing 12-mo EPS')).toBeInTheDocument()
    // …and as a solid "Now" column on the chart.
    expect(screen.getByText('Now')).toBeInTheDocument()
    // The footnote explains the new tile.
    expect(
      screen.getByText(/the figure quotes report today/i),
    ).toBeInTheDocument()
  })

  it('threads the Current P/E tile and a "Now" bar into the quarterly walk', () => {
    renderWithProviders(
      <ForwardPeSection
        price={200}
        quarterly={quarterlySample}
        trailingPe={55.5}
        period="quarterly"
      />,
    )
    expect(screen.getByText('Current P/E')).toBeInTheDocument()
    expect(screen.getAllByText('55.50').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Price ÷ trailing 12-mo EPS')).toBeInTheDocument()
    expect(screen.getByText('Now')).toBeInTheDocument()
    expect(
      screen.getByText(/the standard quote, which can sit apart/i),
    ).toBeInTheDocument()
  })
})
