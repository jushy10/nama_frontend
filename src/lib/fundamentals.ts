import type {
  CashFlowVerdict,
  IndustryPeStance,
  PeHistoryPoint,
  ProfitabilityVerdict,
} from '@/lib/api'

/**
 * Fundamentals synthesis — the small amount of shared logic behind the
 * "Good business, fair price?" summary that heads the Fundamentals tab. It
 * boils the tab's four cards down to the two questions fundamental analysis
 * actually answers: is this a good *business* (its profits and cash), and is the
 * *price* fair (its multiple versus peers and its own past)? Each answer is a
 * synthesis of the same verdicts the cards below already compute, so the summary
 * and the evidence never disagree.
 */

// A trailing-P/E history needs a few points to read as a range rather than a dot
// or two; below this the P/E-history card self-hides and the price synthesis
// ignores it. Shared so the card and the summary draw the same line.
export const MIN_PE_HISTORY_POINTS = 3

/** The median of a numeric list (mean of the two middles on an even count). */
export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/**
 * Grade the latest trailing P/E against the window median with the same ±10%
 * dead-band the industry read uses, so a small gap doesn't read as a signal.
 * Null when either figure is non-positive (no gradeable comparison without two
 * positive multiples). Shares `IndustryPeStance`'s three values so the two
 * valuation reads speak the same language.
 */
export function peHistoryStance(
  points: PeHistoryPoint[],
): IndustryPeStance | null {
  if (points.length < MIN_PE_HISTORY_POINTS) return null
  const med = median(points.map((p) => p.pe))
  const latest = points[points.length - 1].pe
  if (latest <= 0 || med <= 0) return null
  const ratio = latest / med
  if (ratio <= 0.9) return 'below'
  if (ratio >= 1.1) return 'above'
  return 'in_line'
}

/**
 * How a business's quality reads once its profit and cash verdicts are taken
 * together: `strong` (good on every measure covered), `solid` (good on at least
 * one, middling on the rest), `mixed` (a good measure sitting beside a weak one,
 * or nothing but middling reads), and `weak` (poor across the board). Null when
 * neither verdict is available to judge.
 */
export type QualityBand = 'strong' | 'solid' | 'mixed' | 'weak'

/**
 * Where the price sits once the peer and own-history reads are taken together:
 * `discount` (cheaper on the reads covered), `fair` (roughly in line), `premium`
 * (pricier), and `mixed` (cheap on one read, rich on the other). Null when
 * neither valuation read is available.
 */
export type PriceBand = 'discount' | 'fair' | 'premium' | 'mixed'

// Richest-first scores for the two quality verdicts — good (≥ 2), middling (1),
// poor (0) — so a divergence (a fat margin beside a cash burn) is detectable.
const PROFIT_SCORE: Record<ProfitabilityVerdict, number> = {
  'Highly Profitable': 3,
  Profitable: 2,
  'Marginally Profitable': 1,
  Unprofitable: 0,
}
const CASH_SCORE: Record<CashFlowVerdict, number> = {
  'Cash Rich': 3,
  'Cash Generative': 2,
  'Thin Free Cash': 1,
  'Cash Burning': 0,
}

/**
 * Fold the profitability and cash-generation verdicts into one quality read.
 * A good-and-bad split reads `mixed`; all-good `strong`; all-poor `weak`; a good
 * measure beside a middling one `solid`; nothing but middling reads `mixed`.
 * Uses whichever verdicts are present, so one covered measure still grades.
 */
export function qualityBand(
  profit: ProfitabilityVerdict | null,
  cash: CashFlowVerdict | null,
): QualityBand | null {
  const scores: number[] = []
  if (profit) scores.push(PROFIT_SCORE[profit])
  if (cash) scores.push(CASH_SCORE[cash])
  if (scores.length === 0) return null

  const goods = scores.filter((s) => s >= 2).length
  const bads = scores.filter((s) => s === 0).length
  if (goods > 0 && bads > 0) return 'mixed'
  if (goods === scores.length) return 'strong'
  if (bads === scores.length) return 'weak'
  if (goods > 0) return 'solid'
  return 'mixed'
}

// A stance's price direction: below the anchor is cheaper, above is pricier.
const STANCE_SCORE: Record<IndustryPeStance, number> = {
  below: -1,
  in_line: 0,
  above: 1,
}

/**
 * Fold the peer and own-history P/E stances into one price read. A cheap-and-rich
 * split reads `mixed`; otherwise the net direction gives `discount`, `premium`,
 * or `fair`. Uses whichever stances are present, so a stock with only one
 * valuation read (its industry has too few peers, say) still grades.
 */
export function priceBand(
  industry: IndustryPeStance | null,
  history: IndustryPeStance | null,
): PriceBand | null {
  const stances = [industry, history].filter(
    (s): s is IndustryPeStance => s != null,
  )
  if (stances.length === 0) return null

  const belows = stances.filter((s) => s === 'below').length
  const aboves = stances.filter((s) => s === 'above').length
  if (belows > 0 && aboves > 0) return 'mixed'

  const net = stances.reduce((sum, s) => sum + STANCE_SCORE[s], 0)
  if (net > 0) return 'premium'
  if (net < 0) return 'discount'
  return 'fair'
}
