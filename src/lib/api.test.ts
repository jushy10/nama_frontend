import { describe, expect, it } from 'vitest'
import {
  gradeValuation,
  optionsSentiment,
  profitabilityVerdict,
} from '@/lib/api'

describe('gradeValuation', () => {
  it('grades P/E: cheap-to-reasonable good, elevated fair, rich or loss-making a caution', () => {
    expect(gradeValuation('pe', 12)).toBe('good')
    expect(gradeValuation('pe', 24.9)).toBe('good')
    expect(gradeValuation('pe', 25)).toBe('fair')
    expect(gradeValuation('pe', 40)).toBe('fair')
    expect(gradeValuation('pe', 41)).toBe('caution')
    expect(gradeValuation('pe', 0)).toBe('caution') // breakeven
    expect(gradeValuation('pe', -5)).toBe('caution') // losses
  })

  it('grades PEG on the under-1 / over-2 rule', () => {
    expect(gradeValuation('peg', 0.8)).toBe('good')
    expect(gradeValuation('peg', 1)).toBe('fair')
    expect(gradeValuation('peg', 2)).toBe('fair')
    expect(gradeValuation('peg', 2.1)).toBe('caution')
    expect(gradeValuation('peg', 0)).toBe('caution')
  })

  it('grades P/S: under 2× sales good, up to 6× fair, above a caution', () => {
    expect(gradeValuation('ps', 1.5)).toBe('good')
    expect(gradeValuation('ps', 2)).toBe('fair')
    expect(gradeValuation('ps', 6)).toBe('fair')
    expect(gradeValuation('ps', 6.1)).toBe('caution')
  })

  it('grades current ratio: below 1 a caution, 1–1.5 fair, 1.5+ good', () => {
    expect(gradeValuation('current_ratio', 0.9)).toBe('caution')
    expect(gradeValuation('current_ratio', 1)).toBe('fair')
    expect(gradeValuation('current_ratio', 1.49)).toBe('fair')
    expect(gradeValuation('current_ratio', 1.5)).toBe('good')
  })

  it('grades debt/equity: light good, moderate fair, heavy or negative a caution', () => {
    expect(gradeValuation('debt_to_equity', 0.5)).toBe('good')
    expect(gradeValuation('debt_to_equity', 1)).toBe('good')
    expect(gradeValuation('debt_to_equity', 1.5)).toBe('fair')
    expect(gradeValuation('debt_to_equity', 2)).toBe('fair')
    expect(gradeValuation('debt_to_equity', 2.1)).toBe('caution')
    expect(gradeValuation('debt_to_equity', -0.3)).toBe('caution') // negative equity
  })

  it('grades beta as a volatility read: calm good, lively fair, wild a caution', () => {
    expect(gradeValuation('beta', 0.8)).toBe('good')
    expect(gradeValuation('beta', 1.1)).toBe('good')
    expect(gradeValuation('beta', 1.3)).toBe('fair')
    expect(gradeValuation('beta', 1.5)).toBe('fair')
    expect(gradeValuation('beta', 1.6)).toBe('caution')
  })
})

describe('profitabilityVerdict', () => {
  it('grades net margin: 20%+ exceptional, double-digit healthy, thin, or a loss', () => {
    expect(profitabilityVerdict(31.2)).toBe('Highly Profitable')
    expect(profitabilityVerdict(20)).toBe('Highly Profitable')
    expect(profitabilityVerdict(19.9)).toBe('Profitable')
    expect(profitabilityVerdict(10)).toBe('Profitable')
    expect(profitabilityVerdict(9.9)).toBe('Marginally Profitable')
    expect(profitabilityVerdict(0.1)).toBe('Marginally Profitable')
  })

  it('treats break-even and losses as Unprofitable', () => {
    expect(profitabilityVerdict(0)).toBe('Unprofitable')
    expect(profitabilityVerdict(-4.2)).toBe('Unprofitable')
  })

  it('returns null when there is no margin to judge', () => {
    expect(profitabilityVerdict(null)).toBeNull()
  })
})

describe('optionsSentiment', () => {
  it('reads a call-heavy ratio as optimistic and a put-heavy one as protective', () => {
    expect(optionsSentiment(0.24)).toBe('optimistic')
    expect(optionsSentiment(0.94)).toBe('optimistic')
    expect(optionsSentiment(1.06)).toBe('protective')
    expect(optionsSentiment(1.8)).toBe('protective')
  })

  it('treats the narrow band around parity as balanced, edges inclusive', () => {
    expect(optionsSentiment(0.95)).toBe('balanced')
    expect(optionsSentiment(1)).toBe('balanced')
    expect(optionsSentiment(1.05)).toBe('balanced')
  })

  it('returns null when there is no ratio to judge', () => {
    expect(optionsSentiment(null)).toBeNull()
  })
})
