import { describe, expect, it } from 'vitest'
import {
  median,
  MIN_PE_HISTORY_POINTS,
  peHistoryStance,
  priceBand,
  qualityBand,
} from '@/lib/fundamentals'
import type { PeHistoryPoint } from '@/lib/api'

/** A P/E-history series from a list of multiples (dates are unused by the math). */
const series = (pes: number[]): PeHistoryPoint[] =>
  pes.map((pe, i) => ({ date: `20${20 + i}-01-01`, pe }))

describe('median', () => {
  it('takes the middle of an odd-length list, order-independent', () => {
    expect(median([3, 1, 2])).toBe(2)
  })

  it('averages the two middles of an even-length list', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5)
  })
})

describe('peHistoryStance', () => {
  it('needs at least MIN_PE_HISTORY_POINTS to grade', () => {
    expect(MIN_PE_HISTORY_POINTS).toBe(3)
    expect(peHistoryStance(series([20, 22]))).toBeNull()
  })

  it('grades the latest reading above its window median past the +10% band', () => {
    // median 20, latest 30 → +50% → above.
    expect(peHistoryStance(series([18, 20, 22, 30]))).toBe('above')
  })

  it('grades a latest reading below its median past the -10% band', () => {
    // median 20, latest 15 → -25% → below.
    expect(peHistoryStance(series([22, 20, 18, 15]))).toBe('below')
  })

  it('reads a small gap as in line, not a signal', () => {
    // median 20, latest 21 → +5%, inside the ±10% dead-band.
    expect(peHistoryStance(series([19, 20, 21, 21]))).toBe('in_line')
  })

  it('will not grade a non-positive latest multiple', () => {
    expect(peHistoryStance(series([20, 22, 24, -5]))).toBeNull()
  })
})

describe('qualityBand', () => {
  it('reads strong when every covered measure is good', () => {
    expect(qualityBand('Highly Profitable', 'Cash Rich')).toBe('strong')
    expect(qualityBand('Profitable', 'Cash Generative')).toBe('strong')
  })

  it('reads solid when a good measure sits beside a middling one', () => {
    // A very profitable business that keeps little free cash — Apple's shape.
    expect(qualityBand('Highly Profitable', 'Thin Free Cash')).toBe('solid')
  })

  it('reads mixed when a good measure sits beside a poor one', () => {
    expect(qualityBand('Highly Profitable', 'Cash Burning')).toBe('mixed')
  })

  it('reads weak when every covered measure is poor', () => {
    expect(qualityBand('Unprofitable', 'Cash Burning')).toBe('weak')
  })

  it('reads nothing-but-middling as mixed', () => {
    expect(qualityBand('Marginally Profitable', 'Thin Free Cash')).toBe('mixed')
  })

  it('grades off a single covered verdict', () => {
    expect(qualityBand('Highly Profitable', null)).toBe('strong')
    expect(qualityBand(null, 'Cash Burning')).toBe('weak')
  })

  it('is null when neither verdict is available', () => {
    expect(qualityBand(null, null)).toBeNull()
  })
})

describe('priceBand', () => {
  it('reads premium when the covered stances lean pricey', () => {
    expect(priceBand('above', 'above')).toBe('premium')
    expect(priceBand('above', 'in_line')).toBe('premium')
  })

  it('reads discount when the covered stances lean cheap', () => {
    expect(priceBand('below', 'in_line')).toBe('discount')
  })

  it('reads fair when the covered stances sit in line', () => {
    expect(priceBand('in_line', 'in_line')).toBe('fair')
  })

  it('reads mixed when one read is cheap and the other rich', () => {
    expect(priceBand('below', 'above')).toBe('mixed')
  })

  it('grades off a single available stance', () => {
    // Apple's shape: no usable peer read, above its own history.
    expect(priceBand(null, 'above')).toBe('premium')
    expect(priceBand('below', null)).toBe('discount')
  })

  it('is null when neither stance is available', () => {
    expect(priceBand(null, null)).toBeNull()
  })
})
