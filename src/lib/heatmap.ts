/**
 * Heat-map data helpers — pure transforms over the `/market/heatmap` payload,
 * kept out of the SVG component so they unit-test on their own.
 */
import type { HeatMap, HeatMapStock } from '@/lib/api'

/** Normalised company identity, for collapsing multi-class shares (GOOGL/GOOG,
 *  FOXA/FOX, …). Falls back to the ticker when a name is missing so unnamed tiles
 *  never merge into one. */
function companyKey(stock: HeatMapStock): string {
  if (!stock.name) return `#${stock.ticker}`
  return stock.name
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/**
 * Collapse a company's multiple share classes down to a single tile.
 *
 * Alphabet lists as both GOOGL and GOOG (Fox as FOXA/FOX, News Corp as NWS/NWSA),
 * and the feed reports each class at the *full* company market cap — so drawing both
 * double-counts the company and doubles its footprint on the map. Keep the largest-cap
 * class per company (GOOGL over GOOG) and drop the rest, then recompute every industry
 * and sector total from the survivors so the treemap stays internally consistent.
 */
export function dedupeShareClasses(data: HeatMap): HeatMap {
  let count = 0
  const sectors = data.sectors.map((sector) => {
    const industries = sector.industries.map((industry) => {
      const kept = new Map<string, HeatMapStock>()
      for (const stock of industry.stocks) {
        const key = companyKey(stock)
        const seen = kept.get(key)
        if (!seen || stock.market_cap > seen.market_cap) kept.set(key, stock)
      }
      const stocks = [...kept.values()]
      count += stocks.length
      const market_cap = stocks.reduce((sum, s) => sum + s.market_cap, 0)
      return { ...industry, stocks, market_cap }
    })
    const market_cap = industries.reduce((sum, i) => sum + i.market_cap, 0)
    return { ...sector, industries, market_cap }
  })
  return { ...data, count, sectors }
}
