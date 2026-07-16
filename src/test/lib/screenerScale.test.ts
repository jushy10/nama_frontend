import { describe, expect, it } from 'vitest'
import {
  divergingFraction,
  linearFraction,
  magnitudeFraction,
  pageMax,
} from '@/lib/screenerScale'

describe('magnitudeFraction', () => {
  it('fills the bar for the page maximum', () => {
    expect(magnitudeFraction(5e12, 5e12)).toBe(1)
  })

  it('keeps a mid-cap visible against a mega-cap — the reason it is log-scaled', () => {
    // $10B against a $5T max is 0.2% linearly, an invisible sliver. The log scale
    // has to leave it a bar a reader can actually see.
    const fraction = magnitudeFraction(10e9, 5e12)
    expect(fraction).toBeGreaterThan(0.05)
    expect(fraction).toBeLessThan(1)
  })

  it('orders bars by value', () => {
    const big = magnitudeFraction(1e12, 5e12)
    const small = magnitudeFraction(1e10, 5e12)
    expect(big).toBeGreaterThan(small)
  })

  it('leaves a hairline rather than nothing below the three-decade floor', () => {
    expect(magnitudeFraction(1e6, 5e12)).toBe(0.02)
  })

  it('never overflows the track when a value exceeds the max', () => {
    expect(magnitudeFraction(9e12, 5e12)).toBe(1)
  })

  it('draws nothing for a missing, zero, negative or unusable figure', () => {
    expect(magnitudeFraction(null, 5e12)).toBe(0)
    expect(magnitudeFraction(0, 5e12)).toBe(0)
    expect(magnitudeFraction(-1e9, 5e12)).toBe(0)
    expect(magnitudeFraction(Number.NaN, 5e12)).toBe(0)
  })

  it('draws nothing when the page carries no usable max', () => {
    expect(magnitudeFraction(1e9, 0)).toBe(0)
    expect(magnitudeFraction(1e9, Number.NaN)).toBe(0)
  })
})

describe('linearFraction', () => {
  it('fills the bar for the page maximum', () => {
    expect(linearFraction(0.75, 0.75)).toBe(1)
  })

  it('keeps the spread between two cheap funds legible', () => {
    // The whole point of the linear scale: 0.03% vs 0.75% must not collapse.
    expect(linearFraction(0.03, 0.75)).toBeCloseTo(0.04)
    expect(linearFraction(0.375, 0.75)).toBeCloseTo(0.5)
  })

  it('draws nothing for a genuine zero-fee fund', () => {
    expect(linearFraction(0, 0.75)).toBe(0)
  })

  it('never overflows the track', () => {
    expect(linearFraction(2, 0.75)).toBe(1)
  })

  it('draws nothing for a missing figure or an unusable max', () => {
    expect(linearFraction(null, 0.75)).toBe(0)
    expect(linearFraction(0.5, 0)).toBe(0)
  })
})

describe('divergingFraction', () => {
  it('pins anything past the reference at full width, in its own direction', () => {
    expect(divergingFraction(552)).toBe(1)
    expect(divergingFraction(-552)).toBe(-1)
    expect(divergingFraction(100)).toBe(1)
  })

  it('keeps an ordinary move at a readable length despite a blowout elsewhere', () => {
    // The reason the reference is fixed rather than page-relative: a page carrying
    // a +552% outlier must not shrink a +25% move to a few pixels.
    expect(divergingFraction(25)).toBeCloseTo(0.25)
    expect(divergingFraction(65)).toBeCloseTo(0.65)
  })

  it('gives one figure the same length on every page', () => {
    // The stability property the fixed reference buys: no page context, no rescale.
    expect(divergingFraction(20)).toBe(divergingFraction(20))
    expect(divergingFraction(20)).toBeCloseTo(0.2)
  })

  it('signs a loss negative and a gain positive', () => {
    expect(divergingFraction(-30)).toBeLessThan(0)
    expect(divergingFraction(30)).toBeGreaterThan(0)
  })

  it('draws symmetrically around zero', () => {
    expect(divergingFraction(-40)).toBeCloseTo(-divergingFraction(40))
  })

  it('honours an explicit reference', () => {
    expect(divergingFraction(25, 50)).toBeCloseTo(0.5)
  })

  it('draws nothing at zero, or for a missing figure or unusable reference', () => {
    expect(divergingFraction(0)).toBe(0)
    expect(divergingFraction(null)).toBe(0)
    expect(divergingFraction(30, 0)).toBe(0)
  })
})

describe('pageMax', () => {
  const rows = [{ v: 3 }, { v: null }, { v: 12 }, { v: -40 }]

  it('takes the largest positive value, skipping nulls', () => {
    expect(pageMax(rows, (r) => r.v)).toBe(12)
  })

  it('reports no max for an empty page, so bars simply do not draw', () => {
    expect(pageMax([], (r: { v: number | null }) => r.v)).toBe(0)
  })

  it('ignores non-finite figures', () => {
    expect(pageMax([{ v: Number.NaN }, { v: 5 }], (r) => r.v)).toBe(5)
  })
})
