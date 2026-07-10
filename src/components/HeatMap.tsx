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

// Text fitting, in viewBox units. Tickers are drawn as large as will fit a tile,
// with the day-move percent stacked beneath when there's still room for both. A
// tile too small for even the smallest legible ticker is left blank.
const PCT_RATIO = 0.62 // percent font size relative to the ticker's
const LABEL_PAD = 1.5 // inset kept clear of the tile edge, per side
const MAX_TICKER_FS = 22 // cap so the biggest tiles don't get billboard text
const MIN_TICKER_FS = 3.5 // below this a ticker is unreadable — draw nothing
const MIN_PCT_FS = 2.7 // and below this the percent line is dropped

// Advance widths (as a fraction of font size) for the bold glyphs a ticker or
// percent can contain — measured from the app's `system-ui` bold face (Segoe UI on
// Windows, the widest of the common system fonts, so text sized by these never
// spills on narrower faces like macOS's San Francisco). A single average factor
// can't fit both "WDC" (all wide letters) and "IT" (all narrow), so labels are
// sized by their real summed glyph widths; unknown glyphs fall back to wide.
const GLYPH_EM: Record<string, number> = {
  A: 0.73,
  B: 0.68,
  C: 0.63,
  D: 0.74,
  E: 0.6,
  F: 0.57,
  G: 0.77,
  H: 0.79,
  I: 0.33,
  J: 0.45,
  K: 0.68,
  L: 0.56,
  M: 0.96,
  N: 0.79,
  O: 0.76,
  P: 0.62,
  Q: 0.76,
  R: 0.69,
  S: 0.63,
  T: 0.59,
  U: 0.78,
  V: 0.71,
  W: 1.03,
  X: 0.69,
  Y: 0.67,
  Z: 0.63,
  '0': 0.58,
  '1': 0.58,
  '2': 0.58,
  '3': 0.58,
  '4': 0.58,
  '5': 0.58,
  '6': 0.58,
  '7': 0.58,
  '8': 0.58,
  '9': 0.58,
  '.': 0.28,
  ',': 0.28,
  '+': 0.71,
  '-': 0.41,
  '%': 0.87,
  ' ': 0.28,
}
const DEFAULT_EM = 0.8

/** Text width in font-size units — the summed advance widths of its glyphs. */
function textEm(s: string): number {
  let sum = 0
  for (const c of s) sum += GLYPH_EM[c] ?? DEFAULT_EM
  return sum
}

interface TileLabel {
  showTicker: boolean
  showPct: boolean
  tickerFs: number
  pctFs: number
}

/**
 * The largest ticker (and optional percent) font that fits a `w`×`h` tile.
 *
 * Sizing is bounded by the tile width (the ticker must fit on one line, measured by
 * its real glyph widths) and its height (one line for the ticker alone, or ~two when
 * the percent stacks below). Returns `showTicker: false` when the tile can't hold a
 * legible ticker at all.
 */
function fitLabel(
  w: number,
  h: number,
  ticker: string,
  pct: string,
): TileLabel {
  const innerW = w - LABEL_PAD * 2
  const innerH = h - LABEL_PAD * 2
  const widthCapped = innerW / textEm(ticker)

  // Stacked ticker + percent: split the height ~two lines, and only if the
  // percent string also fits the width at its smaller font.
  const stackFs = Math.min(widthCapped, innerH / 1.95, MAX_TICKER_FS)
  const stackPctFs = stackFs * PCT_RATIO
  const pctFitsWidth = textEm(pct) * stackPctFs <= innerW
  const showPct =
    stackFs >= MIN_TICKER_FS && stackPctFs >= MIN_PCT_FS && pctFitsWidth

  // Ticker alone: it may use nearly the full height.
  const soloFs = Math.min(widthCapped, innerH * 0.92, MAX_TICKER_FS)
  const showTicker = showPct || soloFs >= MIN_TICKER_FS

  return {
    showTicker,
    showPct,
    tickerFs: showPct ? stackFs : soloFs,
    pctFs: stackPctFs,
  }
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
        const pct = fmtPct(t.stock.change_percent)
        const { showTicker, showPct, tickerFs, pctFs } = fitLabel(
          t.w,
          t.h,
          t.stock.ticker,
          pct,
        )
        const cx = t.x + t.w / 2
        const cy = t.y + t.h / 2
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
              {fmtCap(t.stock.market_cap)} · {pct}
            </title>
            <rect
              x={t.x}
              y={t.y}
              width={t.w}
              height={t.h}
              fill={tileColor(t.stock.change_percent)}
            />
            {showTicker && (
              <text
                x={cx}
                y={cy + (showPct ? -tickerFs * 0.12 : tickerFs * 0.34)}
                textAnchor="middle"
                fill="#ffffff"
                fontSize={tickerFs}
                fontWeight={700}
                style={{ pointerEvents: 'none' }}
              >
                {t.stock.ticker}
              </text>
            )}
            {showPct && (
              <text
                x={cx}
                y={cy + tickerFs * 0.82}
                textAnchor="middle"
                fill="rgba(255,255,255,0.9)"
                fontSize={pctFs}
                style={{ pointerEvents: 'none' }}
              >
                {pct}
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
