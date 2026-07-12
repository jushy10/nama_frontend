import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Button,
  Divider,
  Drawer,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import {
  heatMapReturn,
  SECTOR_WINDOWS,
  type HeatMap as HeatMapData,
  type HeatMapStock,
  type SectorWindow,
} from '@/lib/api'
import { squarify, type Rect } from '@/lib/treemap'

// The treemap is laid out in a fixed viewBox and scaled to the container via the
// SVG's `width: 100%`, so no ResizeObserver is needed — tiles just scale with it.
// The desktop board is a wide 1000×640 landscape; below `sm` it switches to a tall
// portrait board (a phone's vertical space is otherwise wasted on a squashed strip)
// and sectors stack as full-width bands rather than the cramped 2-D packing.
const W = 1000
const DESKTOP_H = 640
const MOBILE_H = 1760
const MOBILE_MIN_BAND = 64 // floor height for a mobile sector band (header + rows)
const SECTOR_GAP = 2 // blank gutter between sector blocks (viewBox units)
const TILE_GAP = 0.5 // hairline between stock tiles
const HEADER = 18 // sector-label strip height

// The move colour scale: 0% is a neutral gray, deepening to green above and red below,
// clamped at ±`clamp`% (see WINDOW_CLAMP). A tile with no value for the window reads as
// neutral (sized, uncoloured).
const NEUTRAL = '#3d434e'
const POS = '#2ba15a'
const NEG = '#d8443c'

// The colour scale saturates at a different band per timeframe, Finviz-style. A day's
// move rarely clears a few percent, but a quarter's or a year's routinely runs into the
// tens — so a fixed ±3% clamp would paint every longer-window tile a saturated green or
// red and wash out the contrast. Each window widens the band to keep tiles readable.
const WINDOW_CLAMP: Record<SectorWindow, number> = {
  '1d': 3,
  '1w': 6,
  '1m': 12,
  '3m': 20,
  '6m': 30,
  ytd: 30,
  '1y': 50,
}

interface SectorHeader {
  name: string
  x: number
  y: number
  w: number
}

interface StockTile extends Rect {
  stock: HeatMapStock
  sector: string
  industry: string | null
}

/** One tile's stock plus its grouping — the payload for the mobile detail sheet. */
interface TileDetail {
  stock: HeatMapStock
  sector: string
  industry: string | null
}

/** `communication_services` → `Communication Services`, for the detail sheet. */
const prettify = (s: string | null): string =>
  s ? s.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : ''

/** Linear-interpolate two `#rrggbb` colours; `t` in [0,1]. */
function mixHex(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16))
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16))
  const ch = pa.map((v, i) => Math.round(v + (pb[i] - v) * t))
  return `#${ch.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

/** Tile colour for a move percent over a window whose scale saturates at ±`clamp`%
 *  (null → neutral). */
function tileColor(value: number | null, clamp: number): string {
  if (value == null) return NEUTRAL
  const t = Math.max(-1, Math.min(1, value / clamp))
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

// Text fitting, in viewBox units. Reading a move off every tile is the whole point of
// the board, so the percent is stacked under the ticker by default — wherever a legible
// ticker fits with its percent beneath (and the percent fits the tile's width), both are
// drawn. Only a tile too short to stack falls back to a ticker alone; one too small for
// even the smallest legible ticker is left blank (a tap surfaces its detail on mobile).
const PCT_RATIO = 0.62 // percent font size relative to the ticker's
const LABEL_PAD = 1.5 // inset kept clear of the tile edge, per side

// Label size bounds (viewBox units) differ by board. The desktop board renders ~3×
// wider per unit than a phone, so on mobile tickers must be sized larger in units to
// stay legible, mega-caps are let grow bigger to fill their extra room, and the
// smallest tiles are left blank instead of printing sub-pixel noise — a tap surfaces
// their detail instead (see the tile sheet below).
//
// `minStack` is a deliberately lower floor than `minTicker`: showing the move on every
// tile that carries a stock is the point of the board, so a tile that can hold a legible
// *solo* ticker should stack its percent too even if the pair ends up a touch smaller
// than a lone ticker would be. Only tiles too small even for the stacked pair fall back to
// a solo ticker (still identifying the stock), and only tiles below `minTicker` go blank.
interface FitConfig {
  minTicker: number // below this a ticker is unreadable — draw nothing (or a solo ticker)
  minStack: number // stacked ticker+percent floor — lower, so the move shows on more tiles
  maxTicker: number // cap so the biggest tiles don't get billboard text
}
const DESKTOP_FIT: FitConfig = { minTicker: 3.5, minStack: 2.4, maxTicker: 22 }
const MOBILE_FIT: FitConfig = { minTicker: 9, minStack: 6.5, maxTicker: 46 }

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
 * The largest ticker + percent font that fits a `w`×`h` tile.
 *
 * The stacked ticker + percent is the preferred layout — wherever the pair fits at the
 * (low) `minStack` size and the percent also fits the tile's width, both are drawn, so the
 * move reads off the tile. A tile too small for even that stacked pair falls back to a
 * ticker alone if a *legible* (`minTicker`) one fits — a wide-but-very-short sliver still
 * names its stock; anything smaller returns `showTicker: false` and is left blank.
 */
function fitLabel(
  w: number,
  h: number,
  ticker: string,
  pct: string,
  cfg: FitConfig,
): TileLabel {
  const innerW = w - LABEL_PAD * 2
  const innerH = h - LABEL_PAD * 2
  const tickerWidthCap = innerW / textEm(ticker)

  // Preferred: stacked ticker + percent. The percent line is drawn smaller (PCT_RATIO) but
  // its string is usually *wider* than the ticker's (e.g. "+12.34%" vs "TXN"), so the pair
  // must be sized to whichever line needs more width — bounding by the ticker alone and
  // then rejecting when the percent overflows is what used to strand the move off wide,
  // short-tickered tiles. So cap the font by the ticker's width, the percent's width, and
  // ~two lines of the tile's height (1.72 ≈ the pair's combined line height); if the result
  // clears the low `minStack` floor, both fit by construction. Preferring this slightly
  // smaller pair over a bigger solo ticker is the whole "show the move on every tile" point.
  const pctWidthCap = innerW / (textEm(pct) * PCT_RATIO)
  const stackFs = Math.min(
    tickerWidthCap,
    pctWidthCap,
    innerH / 1.72,
    cfg.maxTicker,
  )
  if (stackFs >= cfg.minStack) {
    return {
      showTicker: true,
      showPct: true,
      tickerFs: stackFs,
      pctFs: stackFs * PCT_RATIO,
    }
  }

  // Fallback: too small for the stacked pair — draw the ticker alone, using nearly the full
  // height, if even that is legible; otherwise leave the tile blank.
  const soloFs = Math.min(tickerWidthCap, innerH * 0.92, cfg.maxTicker)
  return {
    showTicker: soloFs >= cfg.minTicker,
    showPct: false,
    tickerFs: soloFs,
    pctFs: 0,
  }
}

/**
 * The heat-map treemap: sectors are the outer blocks (sized by their combined
 * market cap), each holding its stocks as inner tiles (sized by market cap,
 * coloured by their move over the selected `window`). A two-level squarified layout —
 * stocks are flattened from their industry groups in order, so same-industry names stay
 * adjacent. `window` defaults to the day move (`1d`).
 */
export default function HeatMap({
  data,
  window = '1d',
}: {
  data: HeatMapData
  window?: SectorWindow
}) {
  const theme = useTheme()
  const navigate = useNavigate()
  // Below `sm`, swap the wide board for a tall portrait one and open a tap-to-inspect
  // sheet instead of navigating straight off a (necessarily tiny) tile. useMediaQuery
  // has no matchMedia under jsdom, so this stays false in tests and the desktop board
  // — which the tests assert against — renders unchanged.
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [detail, setDetail] = useState<TileDetail | null>(null)

  const H = isMobile ? MOBILE_H : DESKTOP_H
  const fit = isMobile ? MOBILE_FIT : DESKTOP_FIT
  // The colour clamp and the label for the selected timeframe — both used per tile below.
  const clamp = WINDOW_CLAMP[window]
  const windowLabel =
    SECTOR_WINDOWS.find((w) => w.key === window)?.label ?? '1D'

  const { tiles, headers, borders } = useMemo(() => {
    // Outer sector blocks: desktop packs them 2-D (squarified); mobile stacks them as
    // full-width horizontal bands whose height is proportional to market cap — so each
    // sector's board area stays proportional, but reads far better than a thin
    // sub-column on a narrow screen, and scrolls naturally top-to-bottom.
    const blocks: { sector: HeatMapData['sectors'][number]; rect: Rect }[] = []
    if (isMobile) {
      const ordered = [...data.sectors].sort(
        (a, b) => b.market_cap - a.market_cap,
      )
      const total = ordered.reduce((s, x) => s + Math.max(0, x.market_cap), 0)
      // Give every band a floor height (a header strip + a couple of tile rows)
      // so the smallest sectors stay labelled and tappable rather than collapsing
      // to an orphaned sliver; the remaining height is split by market cap. This
      // slightly inflates the tiniest sectors, a deliberate mobile-only trade of
      // strict area-proportionality for legibility (tiles within a band stay exact).
      const minBand = Math.min(MOBILE_MIN_BAND, H / (ordered.length || 1))
      const remainder = Math.max(0, H - minBand * ordered.length)
      let y = 0
      for (const sec of ordered) {
        const share = total > 0 ? Math.max(0, sec.market_cap) / total : 0
        const bandH = minBand + remainder * share
        blocks.push({ sector: sec, rect: { x: 0, y, w: W, h: bandH } })
        y += bandH
      }
    } else {
      for (const t of squarify(data.sectors, (s) => s.market_cap, {
        x: 0,
        y: 0,
        w: W,
        h: H,
      })) {
        blocks.push({
          sector: t.item,
          rect: { x: t.x, y: t.y, w: t.w, h: t.h },
        })
      }
    }

    const tiles: StockTile[] = []
    const headers: SectorHeader[] = []
    const borders: Rect[] = []
    for (const { sector: sec, rect } of blocks) {
      const block = inset(rect, SECTOR_GAP)
      if (block.w <= 0 || block.h <= 0) continue
      borders.push(block)
      const showHeader = block.w > 70 && block.h > (isMobile ? 30 : 44)
      if (showHeader) {
        headers.push({ name: sec.sector, x: block.x, y: block.y, w: block.w })
      }
      const body = showHeader
        ? { x: block.x, y: block.y + HEADER, w: block.w, h: block.h - HEADER }
        : block
      // Keep each stock's industry alongside it so the flattened tiles can carry
      // their full grouping into the detail sheet.
      const stocks = sec.industries.flatMap((i) =>
        i.stocks.map((stock) => ({ stock, industry: i.industry })),
      )
      for (const t of squarify(stocks, (s) => s.stock.market_cap, body)) {
        tiles.push({
          ...inset(t, TILE_GAP),
          stock: t.item.stock,
          sector: sec.sector,
          industry: t.item.industry,
        })
      }
    }
    return { tiles, headers, borders }
  }, [data, isMobile, H])

  const paper = theme.palette.background.paper
  const border = theme.palette.divider

  const openTile = (t: StockTile) => {
    if (isMobile) {
      setDetail({ stock: t.stock, sector: t.sector, industry: t.industry })
    } else {
      navigate(`/search?symbol=${encodeURIComponent(t.stock.ticker)}`)
    }
  }

  return (
    <>
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
          const value = heatMapReturn(t.stock, window)
          const pct = fmtPct(value)
          const { showTicker, showPct, tickerFs, pctFs } = fitLabel(
            t.w,
            t.h,
            t.stock.ticker,
            pct,
            fit,
          )
          const cx = t.x + t.w / 2
          const cy = t.y + t.h / 2
          return (
            <g
              key={t.stock.ticker}
              className="tile"
              onClick={() => openTile(t)}
            >
              <title>
                {t.stock.ticker}
                {t.stock.name ? ` · ${t.stock.name}` : ''} ·{' '}
                {fmtCap(t.stock.market_cap)} · {windowLabel} {pct}
              </title>
              <rect
                x={t.x}
                y={t.y}
                width={t.w}
                height={t.h}
                fill={tileColor(value, clamp)}
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

      {isMobile && (
        <TileSheet
          detail={detail}
          window={window}
          onClose={() => setDetail(null)}
          onOpen={() => {
            if (detail) {
              navigate(
                `/search?symbol=${encodeURIComponent(detail.stock.ticker)}`,
              )
            }
            setDetail(null)
          }}
        />
      )}
    </>
  )
}

/** A labelled value shown in the mobile detail sheet. */
function SheetMetric({
  label,
  value,
  valueColor = 'text.primary',
}: {
  label: string
  value: string
  valueColor?: string
}) {
  return (
    <Box sx={{ minWidth: 0, flex: 1 }}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{
          display: 'block',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          fontSize: 10,
          fontWeight: 700,
        }}
      >
        {label}
      </Typography>
      <Typography
        sx={{ color: valueColor, fontWeight: 600, fontSize: 14 }}
        noWrap
      >
        {value}
      </Typography>
    </Box>
  )
}

/**
 * The bottom sheet a tap opens on mobile. Hover tooltips are dead on touch and a
 * tile is far too small to be a reliable tap-through, so the first tap surfaces the
 * stock's details here — with a clear button to actually open it.
 */
function TileSheet({
  detail,
  window,
  onClose,
  onOpen,
}: {
  detail: TileDetail | null
  window: SectorWindow
  onClose: () => void
  onOpen: () => void
}) {
  // The move over the selected timeframe (the sheet's hero figure + colour).
  const cp = detail ? heatMapReturn(detail.stock, window) : null
  const clamp = WINDOW_CLAMP[window]
  const windowLabel =
    SECTOR_WINDOWS.find((w) => w.key === window)?.label ?? '1D'
  return (
    <Drawer
      anchor="bottom"
      open={!!detail}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: {
            bgcolor: 'background.paper',
            backgroundImage: 'none',
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            overflow: 'hidden',
          },
        },
      }}
    >
      {detail && (
        <Box sx={{ pb: 3 }}>
          {/* The AppBar's blue→gold accent, echoed along the sheet's top edge. */}
          <Box
            sx={{
              height: 3,
              background: 'linear-gradient(90deg, #4f83e6 0%, #d7a739 100%)',
            }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1 }}>
            <Box
              sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: 'divider' }}
            />
          </Box>

          <Box sx={{ px: 2.5, pt: 1.5 }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              <Box
                sx={{
                  flexShrink: 0,
                  minWidth: 68,
                  height: 48,
                  px: 1,
                  borderRadius: 1.5,
                  bgcolor: tileColor(cp, clamp),
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: 15,
                }}
              >
                {fmtPct(cp)}
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 700, lineHeight: 1.2 }}
                >
                  {detail.stock.ticker}
                </Typography>
                {detail.stock.name && (
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {detail.stock.name}
                  </Typography>
                )}
              </Box>
            </Stack>

            <Divider sx={{ my: 2 }} />

            <Stack direction="row" spacing={2}>
              <SheetMetric
                label="Market cap"
                value={fmtCap(detail.stock.market_cap)}
              />
              <SheetMetric
                label={`${windowLabel} change`}
                value={fmtPct(cp)}
                valueColor={
                  cp == null
                    ? 'text.primary'
                    : cp >= 0
                      ? 'success.main'
                      : 'error.main'
                }
              />
            </Stack>

            <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
              <SheetMetric label="Sector" value={prettify(detail.sector)} />
              {detail.industry && (
                <SheetMetric
                  label="Industry"
                  value={prettify(detail.industry)}
                />
              )}
            </Stack>

            <Button
              fullWidth
              variant="contained"
              onClick={onOpen}
              sx={{ mt: 2.5, py: 1.25, fontWeight: 700, textTransform: 'none' }}
            >
              Open {detail.stock.ticker}
            </Button>
          </Box>
        </Box>
      )}
    </Drawer>
  )
}

/** The red→gray→green scale, as a small swatch legend for the page. The stops and the
 *  caption track the selected timeframe, since each window saturates at a wider band
 *  (see WINDOW_CLAMP) — so a 1Y legend reads ±50% where the day reads ±3%. */
export function HeatMapLegend({ window = '1d' }: { window?: SectorWindow }) {
  const clamp = WINDOW_CLAMP[window]
  const windowLabel =
    SECTOR_WINDOWS.find((w) => w.key === window)?.label ?? '1D'
  // Seven swatches spanning −clamp…+clamp; the colour uses the exact stop, the label a
  // rounded percent (uneven for clamps that don't divide by 3, but always legible).
  const stops = [-3, -2, -1, 0, 1, 2, 3].map((i) => (i * clamp) / 3)
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
      {stops.map((s, i) => (
        <Box
          key={i}
          sx={{
            width: 34,
            height: 18,
            borderRadius: 0.5,
            bgcolor: tileColor(s, clamp),
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            fontWeight: 600,
          }}
        >
          {s > 0 ? `+${Math.round(s)}` : Math.round(s)}
        </Box>
      ))}
      <Box component="span" sx={{ ml: 0.5 }}>
        % {windowLabel} change
      </Box>
    </Box>
  )
}
