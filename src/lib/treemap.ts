/**
 * Squarified treemap layout (Bruls, Huizing & van Wijk, 2000).
 *
 * Pure geometry — no React, no DOM — so it's unit-tested on its own and reused by
 * the heat map's SVG renderer. Given a rectangle and a list of weighted items, it
 * tiles the rectangle so each tile's *area* is proportional to its item's value,
 * greedily choosing rows that keep tiles as square as possible (readable labels,
 * the Finviz look) rather than the thin slivers a naive slice-and-dice produces.
 */

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** One laid-out tile: the source item plus its pixel rectangle. */
export interface TreemapTile<T> extends Rect {
  item: T
}

/**
 * The worst (largest) aspect ratio in a row of tile areas laid along an edge of
 * length `side` — the squarify cost function. Lower is squarer; we grow a row
 * while this doesn't get worse.
 */
function worstRatio(areas: number[], side: number): number {
  if (areas.length === 0 || side <= 0) return Infinity
  let sum = 0
  let max = -Infinity
  let min = Infinity
  for (const a of areas) {
    sum += a
    if (a > max) max = a
    if (a < min) min = a
  }
  const s2 = sum * sum
  const side2 = side * side
  return Math.max((side2 * max) / s2, s2 / (side2 * min))
}

/**
 * Lay `items` into `rect`, each tile's area proportional to `value(item)`.
 *
 * Items with a non-positive value are skipped (no zero-area tiles). Best results
 * come from items pre-sorted largest-first, which is how the API already returns
 * them. Returns one tile per kept item, in input order.
 */
export function squarify<T>(
  items: T[],
  value: (item: T) => number,
  rect: Rect,
): TreemapTile<T>[] {
  const out: TreemapTile<T>[] = []
  const data = items
    .map((item) => ({ item, v: value(item) }))
    .filter((d) => d.v > 0)
  const total = data.reduce((s, d) => s + d.v, 0)
  if (total <= 0 || rect.w <= 0 || rect.h <= 0) return out

  // Scale item values into pixel areas that exactly fill the rectangle.
  const scale = (rect.w * rect.h) / total
  const areas = data.map((d) => ({ item: d.item, area: d.v * scale }))

  let free: Rect = { ...rect }
  let i = 0
  while (i < areas.length) {
    const side = Math.min(free.w, free.h)
    // Grow a row while adding the next tile keeps aspect ratios no worse.
    const row: { item: T; area: number }[] = []
    while (i < areas.length) {
      const candidate = row.map((r) => r.area)
      const withNext = [...candidate, areas[i].area]
      if (
        row.length > 0 &&
        worstRatio(withNext, side) > worstRatio(candidate, side)
      ) {
        break
      }
      row.push(areas[i])
      i += 1
    }

    // Lay the finished row as a strip along the shortest side.
    const rowArea = row.reduce((s, r) => s + r.area, 0)
    const thickness = rowArea / side
    if (free.w >= free.h) {
      // Vertical strip down the left edge; tiles stacked top → bottom.
      let oy = free.y
      for (const r of row) {
        const th = r.area / thickness
        out.push({ item: r.item, x: free.x, y: oy, w: thickness, h: th })
        oy += th
      }
      free = {
        x: free.x + thickness,
        y: free.y,
        w: free.w - thickness,
        h: free.h,
      }
    } else {
      // Horizontal strip across the top edge; tiles left → right.
      let ox = free.x
      for (const r of row) {
        const tw = r.area / thickness
        out.push({ item: r.item, x: ox, y: free.y, w: tw, h: thickness })
        ox += tw
      }
      free = {
        x: free.x,
        y: free.y + thickness,
        w: free.w,
        h: free.h - thickness,
      }
    }
  }
  return out
}
