import { describe, expect, it } from 'vitest'
import { dedupeShareClasses } from '@/lib/heatmap'
import type { HeatMap } from '@/lib/api'

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
