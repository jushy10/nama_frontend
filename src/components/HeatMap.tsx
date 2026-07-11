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
import type { HeatMap as HeatMapData, HeatMapStock } from '@/lib/api'
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

// Label size bounds (viewBox units) differ by board. The desktop board renders ~3×
// wider per unit than a phone, so on mobile tickers must be sized larger in units to
// stay legible, mega-caps are let grow bigger to fill their extra room, and the
// smallest tiles are left blank instead of printing sub-pixel noise — a tap surfaces
// their detail instead (see the tile sheet below).
interface FitConfig {
  minTicker: number // below this a ticker is unreadable — draw nothing
  minPct: number // below this the percent line is dropped
  maxTicker: number // cap so the biggest tiles don't get billboard text
}
const DESKTOP_FIT: FitConfig = { minTicker: 3.5, minPct: 2.7, maxTicker: 22 }
const MOBILE_FIT: FitConfig = { minTicker: 9, minPct: 6.5, maxTicker: 46 }

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
  cfg: FitConfig,
): TileLabel {
  const innerW = w - LABEL_PAD * 2
  const innerH = h - LABEL_PAD * 2
  const widthCapped = innerW / textEm(ticker)

  // Stacked ticker + percent: split the height ~two lines, and only if the
  // percent string also fits the width at its smaller font.
  const stackFs = Math.min(widthCapped, innerH / 1.95, cfg.maxTicker)
  const stackPctFs = stackFs * PCT_RATIO
  const pctFitsWidth = textEm(pct) * stackPctFs <= innerW
  const showPct =
    stackFs >= cfg.minTicker && stackPctFs >= cfg.minPct && pctFitsWidth

  // Ticker alone: it may use nearly the full height.
  const soloFs = Math.min(widthCapped, innerH * 0.92, cfg.maxTicker)
  const showTicker = showPct || soloFs >= cfg.minTicker

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
  // Below `sm`, swap the wide board for a tall portrait one and open a tap-to-inspect
  // sheet instead of navigating straight off a (necessarily tiny) tile. useMediaQuery
  // has no matchMedia under jsdom, so this stays false in tests and the desktop board
  // — which the tests assert against — renders unchanged.
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [detail, setDetail] = useState<TileDetail | null>(null)

  const H = isMobile ? MOBILE_H : DESKTOP_H
  const fit = isMobile ? MOBILE_FIT : DESKTOP_FIT

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
          const pct = fmtPct(t.stock.change_percent)
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

      {isMobile && (
        <TileSheet
          detail={detail}
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
  onClose,
  onOpen,
}: {
  detail: TileDetail | null
  onClose: () => void
  onOpen: () => void
}) {
  const cp = detail?.stock.change_percent ?? null
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
                  bgcolor: tileColor(cp),
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
                label="Day change"
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
