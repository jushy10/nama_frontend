import { describe, expect, it } from 'vitest'
import { dedupeShareClasses } from '@/lib/heatmap'
import { heatMapReturn, type HeatMap, type HeatMapStock } from '@/lib/api'

describe('dedupeShareClasses', () => {
  it("collapses a company's share classes to its largest-cap tile", () => {
    const data: HeatMap = {
      scope: 'sp500',
      count: 3,
      sectors: [
        {
          sector: 'communication_services',
          market_cap: 0, // recomputed by dedupe — deliberately stale here
          industries: [
            {
              industry: 'internet_content_information',
              market_cap: 0,
              stocks: [
                // GOOGL and GOOG are Alphabet's two share classes, each carrying
                // the full company cap — only the larger (GOOGL) should survive.
                {
                  ticker: 'GOOGL',
                  name: 'Alphabet Inc',
                  market_cap: 5e12,
                  change_percent: -0.8,
                },
                {
                  ticker: 'GOOG',
                  name: 'Alphabet Inc.',
                  market_cap: 4e12,
                  change_percent: -0.7,
                },
                {
                  ticker: 'META',
                  name: 'Meta Platforms',
                  market_cap: 1.5e12,
                  change_percent: 2,
                },
              ],
            },
          ],
        },
      ],
    }

    const out = dedupeShareClasses(data)
    const stocks = out.sectors[0].industries[0].stocks
    expect(stocks.map((s) => s.ticker)).toEqual(['GOOGL', 'META'])
    expect(stocks[0].market_cap).toBe(5e12) // kept the larger Alphabet class
    expect(out.count).toBe(2)
    // Aggregates recomputed from the survivors — GOOG's 4e12 no longer counted.
    expect(out.sectors[0].industries[0].market_cap).toBe(6.5e12)
    expect(out.sectors[0].market_cap).toBe(6.5e12)
  })

  it('keeps distinct companies and never merges unnamed tiles', () => {
    const data: HeatMap = {
      scope: 'sp500',
      count: 2,
      sectors: [
        {
          sector: 'misc',
          market_cap: 3e12,
          industries: [
            {
              industry: null,
              market_cap: 3e12,
              stocks: [
                {
                  ticker: 'AAA',
                  name: null,
                  market_cap: 1e12,
                  change_percent: 1,
                },
                {
                  ticker: 'BBB',
                  name: null,
                  market_cap: 2e12,
                  change_percent: -1,
                },
              ],
            },
          ],
        },
      ],
    }

    const out = dedupeShareClasses(data)
    expect(out.count).toBe(2)
    expect(out.sectors[0].industries[0].stocks.map((s) => s.ticker)).toEqual([
      'AAA',
      'BBB',
    ])
  })
})

describe('heatMapReturn', () => {
  const stock: HeatMapStock = {
    ticker: 'NVDA',
    name: 'NVIDIA',
    market_cap: 3e12,
    change_percent: -0.99,
    performance: {
      '1w': 2.1,
      '1m': 8.4,
      '3m': null,
      '6m': 40,
      ytd: 33.3,
      '1y': 155.5,
    },
  }

  it('reads the live day move for the 1D window', () => {
    expect(heatMapReturn(stock, '1d')).toBe(-0.99)
  })

  it('reads the trailing performance block for the other windows', () => {
    expect(heatMapReturn(stock, '1m')).toBe(8.4)
    expect(heatMapReturn(stock, 'ytd')).toBe(33.3)
    expect(heatMapReturn(stock, '1y')).toBe(155.5)
  })

  it('is null when the window has no value or the block is absent', () => {
    // A window the backend couldn't compute (not enough history).
    expect(heatMapReturn(stock, '3m')).toBeNull()
    // A board that predates the performance field (or a tile with no history) —
    // every non-day window falls back to null rather than throwing.
    const bare: HeatMapStock = {
      ticker: 'XYZ',
      name: null,
      market_cap: 1e9,
      change_percent: 1.2,
    }
    expect(heatMapReturn(bare, '1d')).toBe(1.2)
    expect(heatMapReturn(bare, '1y')).toBeNull()
  })
})
