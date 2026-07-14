import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders, screen } from '@/test/test-utils'
import YieldCurve from '@/pages/YieldCurve'

const curveSample = {
  as_of: '2026-07-13',
  two_year: 4.26,
  ten_year: 4.62,
  spread_2s10s: 0.36,
  is_inverted: false,
  count: 4,
  tenors: [
    { label: '3M', months: 3, rate: 3.89 },
    { label: '2Y', months: 24, rate: 4.26 },
    { label: '10Y', months: 120, rate: 4.62 },
    { label: '30Y', months: 360, rate: 5.1 },
  ],
}

const invertedCurveSample = {
  ...curveSample,
  two_year: 4.8,
  ten_year: 4.55,
  spread_2s10s: -0.25,
  is_inverted: true,
  tenors: [
    { label: '3M', months: 3, rate: 4.9 },
    { label: '2Y', months: 24, rate: 4.8 },
    { label: '10Y', months: 120, rate: 4.55 },
    { label: '30Y', months: 360, rate: 4.6 },
  ],
}

const historySample = {
  latest_spread: 0.36,
  is_inverted: false,
  series: [
    {
      label: '2Y',
      observations: [
        { date: '2026-07-01', rate: 4.2 },
        { date: '2026-07-02', rate: 4.26 },
      ],
    },
    {
      label: '10Y',
      observations: [
        { date: '2026-07-01', rate: 4.55 },
        { date: '2026-07-02', rate: 4.62 },
      ],
    },
  ],
  spread: [
    { date: '2026-07-01', rate: 0.35 },
    { date: '2026-07-02', rate: 0.36 },
  ],
}

/** Routes `/market/yield-curve` and `/market/yield-history` to their samples. */
function stubYieldFetch(curve: unknown, history: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      const u = String(url)
      const payload = u.includes('yield-history') ? history : curve
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(payload),
      })
    }),
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('YieldCurve page', () => {
  it('shows the shape chip, headline yields and both charts', async () => {
    stubYieldFetch(curveSample, historySample)
    renderWithProviders(<YieldCurve />)

    // The live shape read (spread +0.36 -> normal).
    expect(
      (await screen.findAllByText('Normal (upward) curve')).length,
    ).toBeGreaterThanOrEqual(1)

    // Headline numbers (2Y / 10Y / spread).
    expect(screen.getAllByText('4.26%').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('4.62%').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('+0.36').length).toBeGreaterThanOrEqual(1)

    // Both charts render as labelled SVGs.
    const charts = screen.getAllByRole('img')
    expect(charts.length).toBeGreaterThanOrEqual(2)

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/market/yield-curve'),
      expect.anything(),
    )
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/market/yield-history'),
      expect.anything(),
    )
  })

  it('reads an inverted curve as a recession signal', async () => {
    stubYieldFetch(invertedCurveSample, historySample)
    renderWithProviders(<YieldCurve />)

    expect(
      (await screen.findAllByText('Inverted curve')).length,
    ).toBeGreaterThanOrEqual(1)
    // The explainer spells out the inversion meaning.
    expect(screen.getAllByText(/recession/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('-0.25').length).toBeGreaterThanOrEqual(1)
  })

  it('shows an error message when the curve request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: () =>
          Promise.resolve({ detail: 'Treasury yield curve unavailable.' }),
      }),
    )
    renderWithProviders(<YieldCurve />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /treasury yield curve unavailable/i,
    )
  })
})
