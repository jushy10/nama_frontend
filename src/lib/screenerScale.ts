/**
 * Pure scale math for the screener tables' inline micro-bars.
 *
 * A screener page is a wall of numbers; a bar behind each figure turns it into a
 * shape you can scan. Both scales are page-relative — the rows are
 * server-paginated, so "the biggest thing here" means the biggest on this page,
 * not in the universe. That's the honest reading of a bar next to a paged row.
 */

/** Decades of range a magnitude bar spans below the page maximum. */
const MAGNITUDE_DECADES = 3

/**
 * Log-scaled fraction (0–1) of `value` against the page's `max`, for a size
 * metric like market cap or fund AUM.
 *
 * Log, not linear: caps on one page run from ~$1B to ~$5T. On a linear scale a
 * $10B name is 0.2% of a $5T one — an invisible sliver — so every row but the
 * top few reads as empty. A log scale over the three decades below the max keeps
 * a mid-cap legible next to a mega-cap. Anything at or under max/1000 keeps a
 * hairline (0.02) rather than vanishing, so "small" still reads as present.
 */
export function magnitudeFraction(value: number | null, max: number): number {
  if (value == null || !Number.isFinite(value) || value <= 0) return 0
  if (!Number.isFinite(max) || max <= 0) return 0
  const floor = max / 10 ** MAGNITUDE_DECADES
  if (value <= floor) return 0.02
  const capped = Math.min(value, max)
  return Math.min(1, Math.log10(capped / floor) / MAGNITUDE_DECADES)
}

/**
 * Linear fraction (0–1) of `value` against the page's `max`, for a metric that
 * lives inside one order of magnitude — an expense ratio (0–1%) or a distribution
 * yield (0–10%).
 *
 * Linear, unlike `magnitudeFraction`: these figures don't span decades, so the log
 * compression that rescues a market-cap column would here flatten the real spread
 * between a 0.03% fund and a 0.75% one — exactly the comparison the column exists
 * to make. A genuine zero (a zero-fee fund) draws nothing, which is the honest read.
 */
export function linearFraction(value: number | null, max: number): number {
  if (value == null || !Number.isFinite(value) || value <= 0) return 0
  if (!Number.isFinite(max) || max <= 0) return 0
  return Math.min(1, value / max)
}

/**
 * The growth figure (percent) a full half-track represents. Anything at or beyond
 * it — a +552% EPS swing off a near-zero base — draws full width.
 */
export const GROWTH_REFERENCE_PERCENT = 100

/**
 * Signed fraction (-1–1) of a growth percentage against a fixed reference, for a
 * diverging metric like YoY growth.
 *
 * Fixed, not page-relative, unlike the size scales above — and this is the whole
 * point. Growth pages routinely carry one blowout (an EPS swing off a near-zero
 * base runs to +500%). Scaled to that, every ordinary ±10–40% move collapses into
 * a few pixels, and worse, bar length silently re-means itself page to page: the
 * same +20% draws long on a calm page and invisible on one with an outlier. A
 * fixed reference makes a given length mean one fixed thing everywhere, at the
 * cost that everything past the reference pins at full — acceptable, because the
 * cell prints the exact figure and the bar is only the gist.
 */
export function divergingFraction(
  value: number | null,
  reference: number = GROWTH_REFERENCE_PERCENT,
): number {
  if (value == null || !Number.isFinite(value) || value === 0) return 0
  if (!Number.isFinite(reference) || reference <= 0) return 0
  const magnitude = Math.min(Math.abs(value), reference) / reference
  return Math.sign(value) * magnitude
}

/**
 * The largest finite positive value a page carries for one metric, or 0 when the
 * page has none — the denominator `magnitudeFraction` scales against.
 */
export function pageMax<T>(
  rows: readonly T[],
  pick: (row: T) => number | null,
) {
  return rows.reduce((max, row) => {
    const value = pick(row)
    return value != null && Number.isFinite(value) && value > max ? value : max
  }, 0)
}
