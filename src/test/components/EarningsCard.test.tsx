import { describe, expect, it, vi } from 'vitest'
import { fireEvent, renderWithProviders, screen } from '@/test/test-utils'
import EarningsCard from '@/components/EarningsCard'
import type { AnnualEarnings, EarningsHistory } from '@/lib/api'

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

// Three reported fiscal years plus one upcoming (estimated) one, oldest →
// newest as the endpoint serves them.
const annualSample: AnnualEarnings = {
  symbol: 'NVDA',
  count: 4,
  reported_count: 3,
  upcoming_count: 1,
  years: [
    {
      fiscal_year: 2024,
      period_end: '2024-01-31',
      eps_actual: 1.19,
      eps_estimate: null,
      revenue_actual: 60_922_000_000,
      revenue_estimate: null,
      net_income: 29_760_000_000,
      eps_actual_consensus: null,
      is_reported: true,
    },
    {
      fiscal_year: 2025,
      period_end: '2025-01-31',
      eps_actual: 2.94,
      eps_estimate: null,
      revenue_actual: 130_497_000_000,
      revenue_estimate: null,
      net_income: 72_880_000_000,
      eps_actual_consensus: null,
      is_reported: true,
    },
    {
      fiscal_year: 2026,
      period_end: '2026-01-31',
      eps_actual: 4.9,
      eps_estimate: null,
      revenue_actual: 215_938_000_000,
      revenue_estimate: null,
      net_income: 120_067_000_000,
      eps_actual_consensus: null,
      is_reported: true,
    },
    {
      fiscal_year: 2027,
      period_end: '2027-01-25',
      eps_actual: null,
      eps_estimate: 8.97,
      revenue_actual: null,
      revenue_estimate: 392_638_707_720,
      net_income: null,
      eps_actual_consensus: null,
      is_reported: false,
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

  it('carries no metric or ratio tile grids — the card is charts only', () => {
    renderWithProviders(<EarningsCard earnings={base} />)
    // The margin stack moved behind the Profitability card and the health
    // ratios were dropped; PEG and P/E anchor their own cards.
    expect(screen.queryByText('Trailing metrics')).not.toBeInTheDocument()
    expect(screen.queryByText('Gross Margin')).not.toBeInTheDocument()
    expect(screen.queryByText('Financial health')).not.toBeInTheDocument()
    expect(screen.queryByText('Current Ratio')).not.toBeInTheDocument()
    expect(screen.queryByText('Debt / Equity')).not.toBeInTheDocument()
  })

  it('plots a forward expected bar from the next scheduled report', () => {
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
    // The consensus target sits beneath the forecast column's quarter label:
    // EPS on the EPS chart, revenue on the revenue chart.
    expect(screen.getByText('$1.05')).toBeInTheDocument() // EPS consensus
    // Compact format: round billions render "$89B" or "$89.0B" depending on the
    // ICU/Intl data version (CI vs. local differ), so match both.
    expect(screen.getAllByText(/\$89(\.0)?B/).length).toBeGreaterThan(0)
    // The forecast quarter label appears on both the EPS and revenue charts; the
    // expected report date is no longer drawn on the bars (only in the detail
    // line on hover/tap).
    expect(screen.getAllByText("Q2 '27").length).toBeGreaterThan(0)
    expect(screen.queryByText('Est. Jul 30')).not.toBeInTheDocument()
    expect(screen.getByText('Upcoming (est.)')).toBeInTheDocument() // legend entry
    // The forecast column carries the sequential (QoQ) growth its consensus
    // implies vs. the quarter right before it: Q2'27E 1.05 over Q1'27's
    // reported 0.96 → +9.4%.
    expect(screen.getByText('+9.4%')).toBeInTheDocument()
  })

  it('labels only upcoming columns with the consensus-implied QoQ growth', () => {
    renderWithProviders(
      <EarningsCard
        earnings={{
          ...base,
        }}
        upcoming={[
          {
            report_date: '2026-07-30',
            fiscal_year: 2027,
            fiscal_quarter: 2,
            eps_estimate: 1.05,
            revenue_estimate: null,
            session: null,
          },
          {
            report_date: '2026-10-29',
            fiscal_year: 2027,
            fiscal_quarter: 3,
            eps_estimate: 1.18,
            revenue_estimate: null,
            session: null,
          },
        ]}
      />,
    )
    // Upcoming quarters read sequentially (QoQ), against the quarter right
    // before them: Q2'27E vs the reported Q1'27 (1.05/0.96 → +9.4%), and
    // Q3'27E — whose prior quarter is itself unreported — chained over
    // Q2'27's own consensus (1.18/1.05 → +12.4%).
    expect(screen.getByText('+9.4%')).toBeInTheDocument()
    expect(screen.getByText('+12.4%')).toBeInTheDocument()
    // Reported columns carry NO growth figure — Q3'26 vs Q2'26 (+19.1%) would
    // be computable, but past bars already show their growth by height.
    expect(screen.queryByText('+19.1%')).not.toBeInTheDocument()
    // The growth row is explained beneath the legend.
    expect(
      screen.getByText(/growth its consensus implies/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/quarter right before it/i)).toBeInTheDocument()
  })

  it("chains an upcoming year's growth off the prior year's estimate", async () => {
    const { user } = renderWithProviders(
      <EarningsCard
        earnings={base}
        annual={{
          ...annualSample,
          count: 5,
          upcoming_count: 2,
          years: [
            ...annualSample.years,
            {
              fiscal_year: 2028,
              period_end: '2028-01-24',
              eps_actual: null,
              eps_estimate: 12.5,
              revenue_actual: null,
              revenue_estimate: null,
              net_income: null,
              eps_actual_consensus: null,
              is_reported: false,
            },
          ],
        }}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Annual' }))
    // FY28E has no reported FY27 to compare against, so its growth reads over
    // FY27's own consensus: 12.5 / 8.97 → +39.4%.
    expect(screen.getByText('+39.4%')).toBeInTheDocument()
  })

  it('plots a forward column for every upcoming quarter passed', () => {
    renderWithProviders(
      <EarningsCard
        earnings={base}
        upcoming={[
          {
            report_date: '2026-07-30',
            fiscal_year: 2027,
            fiscal_quarter: 2,
            eps_estimate: 1.05,
            revenue_estimate: 89_000_000_000,
            session: 'amc',
          },
          {
            report_date: '2026-10-29',
            fiscal_year: 2027,
            fiscal_quarter: 3,
            eps_estimate: 1.18,
            revenue_estimate: 95_400_000_000,
            session: null,
          },
        ]}
      />,
    )
    // Both upcoming quarters render as their own forecast column (EPS + revenue),
    // not just the single immediate next report.
    expect(screen.getAllByText("Q2 '27").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Q3 '27").length).toBeGreaterThan(0)
    expect(screen.getByText('$1.05')).toBeInTheDocument()
    expect(screen.getByText('$1.18')).toBeInTheDocument()
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
    // No forward column at all, so its quarter label never renders.
    expect(screen.queryByText("Q2 '27")).not.toBeInTheDocument()
    // The header chip still shows the scheduled date, even with no consensus.
    expect(screen.getByText('Next report')).toBeInTheDocument()
    expect(screen.getByText('Jul 30')).toBeInTheDocument()
  })

  it('shows a detail line with the latest quarter estimate vs. actual', () => {
    renderWithProviders(<EarningsCard earnings={base} />)
    // Default detail = newest reported quarter (Q1 '27): est 0.92 → act 0.96.
    // Estimates aren't labelled on the bars, so $0.92 is unique to the line.
    expect(screen.getByText('Est')).toBeInTheDocument()
    expect(screen.getByText('Act')).toBeInTheDocument()
    expect(screen.getByText('$0.92')).toBeInTheDocument()
  })

  it('selects a tapped column on touch and keeps it selected', () => {
    renderWithProviders(<EarningsCard earnings={base} />)

    // Default detail = newest quarter (Q1 '27), whose estimate ($0.92) is unique
    // to the detail line. The oldest quarter's estimate ($0.70) isn't shown yet.
    expect(screen.getByText('$0.92')).toBeInTheDocument()
    expect(screen.queryByText('$0.70')).not.toBeInTheDocument()

    const svg = screen.getByRole('img', {
      name: /earnings per share/i,
    })
    // jsdom has no layout, so the chart reads its width from getBoundingClientRect.
    // Map clientX 1:1 onto the 820-unit viewBox (W_FALLBACK) so a tap lands in a
    // known column.
    const WIDTH = 820
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      right: WIDTH,
      bottom: 300,
      width: WIDTH,
      height: 300,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect)

    // Tap the leftmost (oldest) column → its estimate ($0.70) fills the detail.
    fireEvent.pointerDown(svg, {
      clientX: 60,
      clientY: 150,
      pointerType: 'touch',
    })
    expect(screen.getByText('$0.70')).toBeInTheDocument()

    // Touch has no hover: lifting the finger (pointerleave) keeps the selection.
    fireEvent.pointerLeave(svg, { pointerType: 'touch' })
    expect(screen.getByText('$0.70')).toBeInTheDocument()

    // A mouse leaving, by contrast, clears it back to the default newest quarter.
    fireEvent.pointerLeave(svg, { pointerType: 'mouse' })
    expect(screen.queryByText('$0.70')).not.toBeInTheDocument()
    expect(screen.getByText('$0.92')).toBeInTheDocument()
  })

  it('renders a revenue chart from the reported actuals', () => {
    renderWithProviders(
      <EarningsCard
        earnings={{
          ...base,
          quarters: [
            { ...base.quarters[0], revenue_actual: 97_100_000_000 },
            ...base.quarters.slice(1),
          ],
        }}
      />,
    )
    // Revenue gets its own chart (title) plus a matching legend swatch, so the
    // label appears more than once.
    expect(screen.getAllByText('Revenue').length).toBeGreaterThan(0)
    // Reported revenue shows in the detail line and beneath the bar; there's no
    // consensus revenue estimate, so the chart is actuals-only.
    expect(screen.getAllByText('$97.1B').length).toBeGreaterThan(0)
    // The two quarters with no reported revenue render as labelled "no data"
    // gaps rather than being dropped, so the missing quarters stay visible.
    expect(screen.getAllByText('no data').length).toBe(2)
  })

  it('shows a "no data" gap when only the latest quarter is missing revenue', () => {
    renderWithProviders(
      <EarningsCard
        earnings={{
          ...base,
          quarters: [
            { ...base.quarters[0], revenue_actual: null }, // EPS in, revenue not yet
            { ...base.quarters[1], revenue_actual: 68_100_000_000 },
            { ...base.quarters[2], revenue_actual: 57_300_000_000 },
          ],
        }}
      />,
    )
    // The latest quarter reported EPS but not revenue (the common EDGAR lag): it
    // stays as a single labelled gap instead of being dropped before the others.
    expect(screen.getByText('no data')).toBeInTheDocument()
    expect(screen.getAllByText('$68.1B').length).toBeGreaterThan(0)
    expect(screen.getAllByText('$57.3B').length).toBeGreaterThan(0)
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

  it('shows a "next report" chip with the date and session', () => {
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
    // The session (amc → "after close", shown title-cased via CSS) sits beneath
    // the date in the chip.
    expect(screen.getByText('after close')).toBeInTheDocument()
    // The EPS consensus rides on the chart's forecast column, not in this chip.
    expect(screen.queryByText('Est $1.93')).not.toBeInTheDocument()
  })

  it('no longer renders a forward estimates section', () => {
    // The next-year growth tiles were dropped: the charts' upcoming columns
    // and the Forward P/E card carry the forward story now.
    renderWithProviders(<EarningsCard earnings={base} />)
    expect(screen.queryByText('Forward estimates')).not.toBeInTheDocument()
    expect(screen.queryByText(/Rev Gr\. \(next yr\)/)).not.toBeInTheDocument()
    expect(screen.queryByText(/EPS Gr\. \(next yr\)/)).not.toBeInTheDocument()
  })

  it('hides the period toggle when no annual data is passed', () => {
    renderWithProviders(<EarningsCard earnings={base} />)
    expect(
      screen.queryByRole('button', { name: 'Annual' }),
    ).not.toBeInTheDocument()
  })

  it('switches the charts to fiscal years when Annual is selected', async () => {
    const { user } = renderWithProviders(
      <EarningsCard earnings={base} annual={annualSample} />,
    )

    // Starts on the quarterly view: quarter labels, no fiscal-year ones.
    expect(screen.getAllByText("Q1 '27").length).toBeGreaterThan(0)
    expect(screen.queryByText('FY26')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Annual' }))

    // Reported fiscal years render as bars with the annual EPS and revenue;
    // the newest year (FY26) also fills the detail line, hence getAll.
    expect(screen.getAllByText('FY24').length).toBeGreaterThan(0)
    expect(screen.getAllByText('FY26').length).toBeGreaterThan(0)
    expect(screen.getAllByText('$4.90').length).toBeGreaterThan(0)
    expect(screen.getAllByText('$215.9B').length).toBeGreaterThan(0)
    // The upcoming fiscal year plots as a forecast column on both charts.
    expect(screen.getAllByText('FY27').length).toBeGreaterThan(0)
    expect(screen.getByText('$8.97')).toBeInTheDocument()
    expect(screen.getAllByText('$392.6B').length).toBeGreaterThan(0)
    expect(screen.getByText('Upcoming (est.)')).toBeInTheDocument()
    // Only the upcoming year carries a growth figure — its consensus-implied
    // YoY vs. the reported FY26 (+83.1% EPS, +81.8% revenue). Reported years
    // show no percentage; their bar heights already tell the growth story.
    expect(screen.getByText('+83.1%')).toBeInTheDocument()
    expect(screen.getByText('+81.8%')).toBeInTheDocument()
    expect(screen.queryByText('+147.1%')).not.toBeInTheDocument()
    expect(screen.queryByText('+66.7%')).not.toBeInTheDocument()
    expect(screen.queryByText('+114.2%')).not.toBeInTheDocument()
    expect(screen.queryByText('+65.5%')).not.toBeInTheDocument()
    expect(screen.getByText(/prior fiscal year/i)).toBeInTheDocument()
    // Reported years carry no consensus, so the beat legend gives way to a
    // plain EPS swatch (which shares its label with the chart heading).
    expect(screen.queryByText('Beat')).not.toBeInTheDocument()
    expect(screen.queryByText('Missed')).not.toBeInTheDocument()
    expect(screen.getAllByText('EPS').length).toBeGreaterThan(0)
    // The quarterly labels are gone until toggled back.
    expect(screen.queryByText("Q1 '27")).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Quarterly' }))
    expect(screen.getAllByText("Q1 '27").length).toBeGreaterThan(0)
    expect(screen.queryByText('FY26')).not.toBeInTheDocument()
  })

  it('shortens the revenue bar labels on a narrow (phone-width) chart', async () => {
    // jsdom has no layout, so the chart measures 0 and keeps its 820-unit
    // desktop fallback. Mock the measurement narrow enough that the sample's
    // four annual columns run as tight as six do on a real phone (slot < 50),
    // tripping the compact bar labels.
    const spy = vi
      .spyOn(Element.prototype, 'getBoundingClientRect')
      .mockReturnValue({
        left: 0,
        top: 0,
        right: 220,
        bottom: 300,
        width: 220,
        height: 300,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect)
    try {
      const { user } = renderWithProviders(
        <EarningsCard earnings={base} annual={annualSample} />,
      )
      await user.click(screen.getByRole('button', { name: 'Annual' }))

      // Bar and forecast labels drop the decimal ("$216B", "$393B")…
      expect(screen.getByText('$216B')).toBeInTheDocument()
      expect(screen.getByText('$393B')).toBeInTheDocument()
      // …and so does the upcoming column's growth row ("+83%" EPS, "+82%" rev).
      expect(screen.getByText('+83%')).toBeInTheDocument()
      expect(screen.getByText('+82%')).toBeInTheDocument()
      // …while the detail line above the plot keeps the full precision.
      expect(screen.getByText('$215.9B')).toBeInTheDocument()
      expect(screen.queryByText('$392.6B')).not.toBeInTheDocument()
      // EPS passes no short format, so its labels are untouched.
      expect(screen.getAllByText('$4.90').length).toBeGreaterThan(0)
    } finally {
      spy.mockRestore()
    }
  })
})
