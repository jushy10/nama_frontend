import { describe, expect, it } from 'vitest'
import { squarify, type Rect } from './treemap'

const CANVAS: Rect = { x: 0, y: 0, w: 100, h: 100 }
const area = (t: { w: number; h: number }) => t.w * t.h

describe('squarify', () => {
  it('fills the whole rectangle (areas sum to the canvas area)', () => {
    const items = [{ v: 6 }, { v: 3 }, { v: 1 }]
    const tiles = squarify(items, (i) => i.v, CANVAS)
    const covered = tiles.reduce((s, t) => s + area(t), 0)
    expect(covered).toBeCloseTo(100 * 100, 6)
  })

  it('sizes each tile proportional to its value', () => {
    const items = [
      { id: 'a', v: 5 },
      { id: 'b', v: 5 },
    ]
    const tiles = squarify(items, (i) => i.v, CANVAS)
    // Equal values -> equal areas.
    expect(area(tiles[0])).toBeCloseTo(area(tiles[1]), 6)
    // A 2x value gets ~2x the area.
    const two = squarify([{ v: 2 }, { v: 1 }], (i) => i.v, CANVAS)
    expect(area(two[0]) / area(two[1])).toBeCloseTo(2, 6)
  })

  it('keeps every tile inside the canvas bounds', () => {
    const items = Array.from({ length: 25 }, (_, i) => ({ v: i + 1 }))
    const tiles = squarify(items, (i) => i.v, CANVAS)
    for (const t of tiles) {
      expect(t.x).toBeGreaterThanOrEqual(-1e-6)
      expect(t.y).toBeGreaterThanOrEqual(-1e-6)
      expect(t.x + t.w).toBeLessThanOrEqual(100 + 1e-6)
      expect(t.y + t.h).toBeLessThanOrEqual(100 + 1e-6)
    }
  })

  it('drops non-positive values without emitting zero-area tiles', () => {
    const items = [
      { id: 'a', v: 4 },
      { id: 'b', v: 0 },
      { id: 'c', v: -2 },
    ]
    const tiles = squarify(items, (i) => i.v, CANVAS)
    expect(tiles).toHaveLength(1)
    expect(tiles[0].item.id).toBe('a')
  })

  it('returns nothing for an empty or degenerate input', () => {
    expect(squarify([], (i: { v: number }) => i.v, CANVAS)).toEqual([])
    expect(
      squarify([{ v: 5 }], (i) => i.v, { x: 0, y: 0, w: 0, h: 100 }),
    ).toEqual([])
  })

  it('produces squarer tiles than a naive slice would', () => {
    // 10 equal tiles in a square: squarified aspect ratios should all be modest
    // (well under a 10:1 sliver a single-row slice would give).
    const items = Array.from({ length: 10 }, () => ({ v: 1 }))
    const tiles = squarify(items, (i) => i.v, CANVAS)
    for (const t of tiles) {
      const ratio = Math.max(t.w / t.h, t.h / t.w)
      expect(ratio).toBeLessThan(3)
    }
  })
})
