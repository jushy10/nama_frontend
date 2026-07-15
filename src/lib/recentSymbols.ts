/**
 * Small localStorage-backed list of the visitor's recent ticker lookups, newest
 * first. Used to seed the "Recently viewed" row on the stock-search landing.
 * Every access is wrapped so private mode / disabled storage degrades to "no
 * recents" rather than throwing.
 */

const RECENT_KEY = 'nama:recent-symbols'
const RECENT_MAX = 6

/** Read the visitor's recent ticker lookups, newest first. Never throws. */
export function getRecentSymbols(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    const list = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(list)
      ? list
          .filter((s): s is string => typeof s === 'string')
          .slice(0, RECENT_MAX)
      : []
  } catch {
    return []
  }
}

/** Push a symbol to the front of the recent list, de-duped and capped. */
export function recordRecentSymbol(symbol: string): void {
  const sym = symbol.trim().toUpperCase()
  if (!sym) return
  try {
    const next = [sym, ...getRecentSymbols().filter((s) => s !== sym)].slice(
      0,
      RECENT_MAX,
    )
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    // Private mode / storage disabled — recents just won't persist.
  }
}
