import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders, screen, waitFor } from '@/test/test-utils'
import MarketSentiment from '@/components/MarketSentiment'

const sample = {
  vix: {
    as_of: '2026-07-13',
    value: 17.16,
    previous_close: 15.03,
    change: 2.13,
    change_percent: 14.17,
    regime: 'normal',
  },
  fear_greed: {
    score: 43.14,
    as_of: '2026-07-14T22:39:44Z',
    rating: 'fear',
    band: 'fear',
    label: 'Fear',
    previous_close: 43.71,
    previous_1_week: 40.0,
    previous_1_month: 35.51,
    previous_1_year: 76.11,
  },
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

describe('MarketSentiment', () => {
  it('renders both the Fear & Greed dial and the VIX', async () => {
    stubFetch(sample)
    renderWithProviders(<MarketSentiment />)

    // The dial: the rounded score and its band label.
    expect(await screen.findByText('43')).toBeInTheDocument()
    expect(screen.getByText('Fear')).toBeInTheDocument()

    // The VIX leg: the level and its regime chip.
    expect(screen.getByText('17.16')).toBeInTheDocument()
    expect(screen.getByText('Normal')).toBeInTheDocument()

    // Hits the sentiment endpoint.
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/market/sentiment'),
      expect.anything(),
    )
  })

  it('renders the VIX alone when Fear & Greed is unavailable', async () => {
    stubFetch({ vix: sample.vix, fear_greed: null })
    renderWithProviders(<MarketSentiment />)

    expect(await screen.findByText('17.16')).toBeInTheDocument()
    // No dial score when the Fear & Greed leg is missing.
    expect(screen.queryByText('43')).not.toBeInTheDocument()
  })

  it('quietly hides itself when both sources are unavailable', async () => {
    // Best-effort widget: a 502 (both sources briefly down) must leave the whole
    // section absent rather than showing a broken card.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: () => Promise.resolve({ detail: 'no market-sentiment sources' }),
      }),
    )
    renderWithProviders(<MarketSentiment />)

    await waitFor(() =>
      expect(screen.queryByText('Market sentiment')).not.toBeInTheDocument(),
    )
  })
})
