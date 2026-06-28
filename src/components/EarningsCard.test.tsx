import { describe, expect, it, vi } from 'vitest'
import { fireEvent, renderWithProviders, screen } from '@/test/test-utils'
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

  it('shows adjusted EPS (summed from the quarters) and GAAP-labelled margins', () => {
    renderWithProviders(
      <EarningsCard
        earnings={{
          ...base,
          // Four quarters so the adjusted TTM EPS (their sum) can be computed.
          quarters: [
            ...base.quarters,
            {
              period: '2025-05-29',
              fiscal_year: 2026,
              fiscal_quarter: 1,
              actual: 0.55,
              estimate: 0.5,
              surprise: 0.05,
              surprise_percent: 10,
              beat: true,
            },
          ],
          metrics: {
            eps: -0.63, // vendor's GAAP TTM EPS — deliberately NOT surfaced
            eps_growth_yoy: 29.0, // GAAP growth — shown, labelled GAAP via footnote
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
    // EPS (TTM) is the sum of the four ADJUSTED quarters (0.96+0.81+0.68+0.55),
    // not the vendor's GAAP -0.63.
    expect(screen.getByText('Adj. EPS (TTM)')).toBeInTheDocument()
    expect(screen.getByText('$3.00')).toBeInTheDocument()
    expect(screen.queryByText('-$0.63')).not.toBeInTheDocument()
    expect(screen.getByText('27.2%')).toBeInTheDocument() // GAAP margin
    // EPS growth is back as a GAAP tile (signed), alongside revenue growth.
    expect(screen.getByText('EPS Gr. (YoY)')).toBeInTheDocument()
    expect(screen.getByText('+29.0%')).toBeInTheDocument()
    // A null metric renders an em dash rather than vanishing.
    expect(screen.getByText('Gross Margin')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
    // The basis is spelled out so the card doesn't read as contradictory.
    expect(
      screen.getByText(/EPS growth, revenue growth and margins are GAAP/i),
    ).toBeInTheDocument()
    // The old GAAP-EPS *level* and ROE/ROIC/Payout tiles are still gone.
    expect(screen.queryByText('EPS (TTM)')).not.toBeInTheDocument()
    expect(screen.queryByText('ROE')).not.toBeInTheDocument()
  })

  it('omits the trailing metrics block when metrics are absent', () => {
    renderWithProviders(<EarningsCard earnings={base} />)
    expect(screen.queryByText('Trailing metrics')).not.toBeInTheDocument()
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
    expect(screen.getByText('$1.05')).toBeInTheDocument() // EPS consensus
    // Compact format: round billions render "$89B" or "$89.0B" depending on the
    // ICU/Intl data version (CI vs. local differ), so match both.
    expect(screen.getAllByText(/\$89(\.0)?B/).length).toBeGreaterThan(0)
    // The forecast label and date appear on both the EPS and revenue charts.
    expect(screen.getAllByText("Q2 '27").length).toBeGreaterThan(0)
    expect(screen.getAllByText('Est. Jul 30').length).toBeGreaterThan(0)
    expect(screen.getByText('Upcoming (est.)')).toBeInTheDocument() // legend entry
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

  it('shows a "next report" chip with the date only', () => {
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
    // The chip is date-only now; the EPS consensus rides on the chart's forecast
    // column, not in this header chip.
    expect(screen.queryByText('Est $1.93')).not.toBeInTheDocument()
  })
})
