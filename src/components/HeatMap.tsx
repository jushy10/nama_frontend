import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, useTheme } from '@mui/material'
import type { HeatMap as HeatMapData, HeatMapStock } from '@/lib/api'
import { squarify, type Rect } from '@/lib/treemap'

// The treemap is laid out in a fixed viewBox and scaled to the container via the
// SVG's `width: 100%`, so no ResizeObserver is needed — one layout serves every
// screen width, tiles just scale with it.
const W = 1000
const H = 640
const SECTOR_GAP = 2 // blank gutter between sector blocks (viewBox units)
const TILE_GAP = 0.5 // hairline between stock tiles
const HEADER = 18 // sector-label strip height

// The day-move colour scale, clamped at ±3% like Finviz: 0% is a neutral gray,
// deepening to green above and red below. A tile with no live quote today reads
// as neutral (sized, uncoloured).
const NEUTRAL = '#3d434e'
const POS = '#2ba15a'
const NEG = '#d8443c'

interface SectorHeader {
  name: string
  x: number
  y: number
  w: number
}

interface StockTile extends Rect {
  stock: HeatMapStock
}

/** Linear-interpolate two `#rrggbb` colours; `t` in [0,1]. */
function mixHex(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16))
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16))
  const ch = pa.map((v, i) => Math.round(v + (pb[i] - v) * t))
  return `#${ch.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

/** Tile colour for a day-move percent (null → neutral). */
function tileColor(changePercent: number | null): string {
  if (changePercent == null) return NEUTRAL
  const t = Math.max(-1, Math.min(1, changePercent / 3))
  return t >= 0 ? mixHex(NEUTRAL, POS, t) : mixHex(NEUTRAL, NEG, -t)
}

/** Shrink a rectangle by `pad` on every side (never past zero). */
function inset(r: Rect, pad: number): Rect {
  return {
    x: r.x + pad,
    y: r.y + pad,
    w: Math.max(0, r.w - pad * 2),
    h: Math.max(0, r.h - pad * 2),
  }
}

const fmtPct = (n: number | null) =>
  n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`

/** Compact market cap, e.g. $3.01T / $12.5B / $940M. */
function fmtCap(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`
  return `$${n.toFixed(0)}`
}

/**
 * The heat-map treemap: sectors are the outer blocks (sized by their combined
 * market cap), each holding its stocks as inner tiles (sized by market cap,
 * coloured by the day's move). A two-level squarified layout — stocks are flattened
 * from their industry groups in order, so same-industry names stay adjacent.
 */
export default function HeatMap({ data }: { data: HeatMapData }) {
  const theme = useTheme()
  const navigate = useNavigate()

  const { tiles, headers, borders } = useMemo(() => {
    const sectors = squarify(data.sectors, (s) => s.market_cap, {
      x: 0,
      y: 0,
      w: W,
      h: H,
    })
    const tiles: StockTile[] = []
    const headers: SectorHeader[] = []
    const borders: Rect[] = []
    for (const sec of sectors) {
      const block = inset(sec, SECTOR_GAP)
      if (block.w <= 0 || block.h <= 0) continue
      borders.push(block)
      const showHeader = block.h > 44 && block.w > 70
      if (showHeader) {
        headers.push({
          name: sec.item.sector,
          x: block.x,
          y: block.y,
          w: block.w,
        })
      }
      const body = showHeader
        ? { x: block.x, y: block.y + HEADER, w: block.w, h: block.h - HEADER }
        : block
      const stocks = sec.item.industries.flatMap((i) => i.stocks)
      for (const t of squarify(stocks, (s) => s.market_cap, body)) {
        tiles.push({ ...inset(t, TILE_GAP), stock: t.item })
      }
    }
    return { tiles, headers, borders }
  }, [data])

  const paper = theme.palette.background.paper
  const border = theme.palette.divider

  return (
    <Box
      component="svg"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Market heat map, ${data.count} stocks`}
      sx={{
        width: '100%',
        height: 'auto',
        display: 'block',
        userSelect: 'none',
        '& .tile': { cursor: 'pointer', transition: 'opacity 120ms' },
        '& .tile:hover': { opacity: 0.82 },
      }}
    >
      <rect x={0} y={0} width={W} height={H} fill={paper} />

      {tiles.map((t) => {
        const label = Math.min(t.w, t.h)
        const showText = t.w > 26 && t.h > 16
        const ticker = Math.max(7, Math.min(22, label / 3.1))
        const showPct = t.h > ticker * 2.1 && t.w > ticker * 2.4
        return (
          <g
            key={t.stock.ticker}
            className="tile"
            onClick={() =>
              navigate(`/search?symbol=${encodeURIComponent(t.stock.ticker)}`)
            }
          >
            <title>
              {t.stock.ticker}
              {t.stock.name ? ` · ${t.stock.name}` : ''} ·{' '}
              {fmtCap(t.stock.market_cap)} · {fmtPct(t.stock.change_percent)}
            </title>
            <rect
              x={t.x}
              y={t.y}
              width={t.w}
              height={t.h}
              fill={tileColor(t.stock.change_percent)}
            />
            {showText && (
              <text
                x={t.x + t.w / 2}
                y={t.y + t.h / 2 + (showPct ? -ticker * 0.15 : ticker * 0.34)}
                textAnchor="middle"
                fill="#ffffff"
                fontSize={ticker}
                fontWeight={700}
                style={{ pointerEvents: 'none' }}
              >
                {t.stock.ticker}
              </text>
            )}
            {showText && showPct && (
              <text
                x={t.x + t.w / 2}
                y={t.y + t.h / 2 + ticker * 0.8}
                textAnchor="middle"
                fill="rgba(255,255,255,0.9)"
                fontSize={ticker * 0.62}
                style={{ pointerEvents: 'none' }}
              >
                {fmtPct(t.stock.change_percent)}
              </text>
            )}
          </g>
        )
      })}

      {/* Sector outlines drawn over the tile edges to delineate the blocks. */}
      {borders.map((b, i) => (
        <rect
          key={`b${i}`}
          x={b.x}
          y={b.y}
          width={b.w}
          height={b.h}
          fill="none"
          stroke={border}
          strokeWidth={1}
        />
      ))}

      {/* Sector labels on top, on a faint band so they read over any tile. */}
      {headers.map((hd, i) => (
        <g key={`h${i}`} style={{ pointerEvents: 'none' }}>
          <rect
            x={hd.x}
            y={hd.y}
            width={hd.w}
            height={HEADER}
            fill="rgba(0,0,0,0.30)"
          />
          <text
            x={hd.x + 6}
            y={hd.y + HEADER * 0.72}
            fill="rgba(255,255,255,0.92)"
            fontSize={11}
            fontWeight={700}
            style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}
          >
            {hd.name.replace(/-/g, ' ')}
          </text>
        </g>
      ))}
    </Box>
  )
}

/** The red→gray→green scale, as a small swatch legend for the page. */
export function HeatMapLegend() {
  const stops = [-3, -2, -1, 0, 1, 2, 3]
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        color: 'text.secondary',
        fontSize: 12,
      }}
    >
      {stops.map((s) => (
        <Box
          key={s}
          sx={{
            width: 34,
            height: 18,
            borderRadius: 0.5,
            bgcolor: tileColor(s),
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            fontWeight: 600,
          }}
        >
          {s > 0 ? `+${s}` : s}
        </Box>
      ))}
      <Box component="span" sx={{ ml: 0.5 }}>
        % day change
      </Box>
    </Box>
  )
}
