import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders, screen, waitFor } from '@/test/test-utils'
import SectorPulse from '@/components/SectorPulse'

const analysisSample = {
  summary:
    'Growth-sensitive corners of the market led today while defensive names lagged.',
  tone: 'risk_on',
  leaders: [
    {
      sector: 'Technology',
      symbol: 'XLK',
      change_percent: 1.84,
      note: 'Chipmakers powered the tape.',
    },
  ],
  laggards: [
    {
      sector: 'Utilities',
      symbol: 'XLU',
      change_percent: -0.92,
      note: 'Money rotated out of safe-haven names.',
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

describe('SectorPulse', () => {
  it('renders the AI read: summary, tone, and the leaders/laggards with real moves', async () => {
    stubFetch(analysisSample)
    renderWithProviders(<SectorPulse />)

    expect(
      await screen.findByText(/growth-sensitive corners/i),
    ).toBeInTheDocument()
    // Hits the analysis endpoint.
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/sectors/analysis'),
      expect.anything(),
    )

    // The risk posture chip and both columns.
    expect(screen.getByText('Risk-On')).toBeInTheDocument()
    expect(screen.getByText('Leading')).toBeInTheDocument()
    expect(screen.getByText('Lagging')).toBeInTheDocument()

    // Each highlight shows its sector, the board's real percent, and the note.
    expect(screen.getByText('Technology')).toBeInTheDocument()
    expect(screen.getByText('+1.84%')).toBeInTheDocument()
    expect(screen.getByText('Chipmakers powered the tape.')).toBeInTheDocument()
    expect(screen.getByText('Utilities')).toBeInTheDocument()
    expect(screen.getByText('-0.92%')).toBeInTheDocument()

    // The service-authored disclaimer rides along.
    expect(screen.getByText(/not financial advice/i)).toBeInTheDocument()
  })

  it('quietly hides itself when the analysis is unavailable', async () => {
    // Best-effort widget: a 502/503 (model briefly down or not configured) must
    // leave the whole section absent rather than showing a broken card.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: () => Promise.resolve({ detail: 'analysis model call failed' }),
      }),
    )
    renderWithProviders(<SectorPulse />)

    await waitFor(() =>
      expect(screen.queryByText('Sector pulse')).not.toBeInTheDocument(),
    )
  })
})
