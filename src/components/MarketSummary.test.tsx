import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders, screen, waitFor } from '@/test/test-utils'
import MarketSummary from '@/components/MarketSummary'

const summarySample = {
  summary:
    'The US market has climbed over the past year and eased slightly this week.',
  tone: 'risk_on',
  periods: [
    {
      period: 'year',
      indexes: [
        { name: 'S&P 500', symbol: 'SPY', change_percent: 18.4 },
        { name: 'Nasdaq', symbol: 'QQQ', change_percent: 24.1 },
      ],
      note: 'A strong year for both indexes.',
    },
    {
      period: 'month',
      indexes: [
        { name: 'S&P 500', symbol: 'SPY', change_percent: 2.1 },
        { name: 'Nasdaq', symbol: 'QQQ', change_percent: 3.0 },
      ],
      note: 'Modest monthly gains.',
    },
    {
      period: 'week',
      indexes: [
        { name: 'S&P 500', symbol: 'SPY', change_percent: -0.6 },
        { name: 'Nasdaq', symbol: 'QQQ', change_percent: -0.9 },
      ],
      note: 'A slight pullback this week.',
    },
  ],
  disclaimer:
    'AI-generated for informational and educational purposes only — not financial advice.',
  model: 'us.anthropic.claude-haiku-4-5',
  generated_at: '2026-07-08T14:00:00Z',
}

function stubFetch(payload: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(payload),
      }),
    ),
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('MarketSummary', () => {
  it('renders the AI overview: summary, tone, and the year/month/week rows with real returns', async () => {
    stubFetch(summarySample)
    renderWithProviders(<MarketSummary />)

    expect(
      await screen.findByText(/climbed over the past year/i),
    ).toBeInTheDocument()
    // Hits the market-summary endpoint.
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/market/summary'),
      expect.anything(),
    )

    // The risk posture chip and every timeframe row.
    expect(screen.getByText('Risk-On')).toBeInTheDocument()
    expect(screen.getByText('Past year')).toBeInTheDocument()
    expect(screen.getByText('Past month')).toBeInTheDocument()
    expect(screen.getByText('Past week')).toBeInTheDocument()

    // Both indexes appear once per period; their real returns are shown per row.
    expect(screen.getAllByText('S&P 500')).toHaveLength(3)
    expect(screen.getAllByText('Nasdaq')).toHaveLength(3)
    expect(screen.getByText('+18.40%')).toBeInTheDocument()
    expect(screen.getByText('+24.10%')).toBeInTheDocument()
    expect(screen.getByText('-0.60%')).toBeInTheDocument()

    // Each timeframe's plain-language note rides along.
    expect(
      screen.getByText('A strong year for both indexes.'),
    ).toBeInTheDocument()
    expect(screen.getByText('A slight pullback this week.')).toBeInTheDocument()

    // The service-authored disclaimer rides along.
    expect(screen.getByText(/not financial advice/i)).toBeInTheDocument()
  })

  it('quietly hides itself when the summary is unavailable', async () => {
    // Best-effort widget: a 502/503 (model briefly down or not configured) must
    // leave the whole section absent rather than showing a broken card.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: () => Promise.resolve({ detail: 'summary model call failed' }),
      }),
    )
    renderWithProviders(<MarketSummary />)

    await waitFor(() =>
      expect(screen.queryByText('Market summary')).not.toBeInTheDocument(),
    )
  })
})
