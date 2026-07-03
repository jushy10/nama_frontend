import { Fragment, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  Box,
  Card,
  CardContent,
  Stack,
  Typography,
  useTheme,
} from '@mui/material'
import type {
  AnnualEarnings,
  QuarterlyEarnings,
  QuarterlyEarningsQuarter,
} from '@/lib/api'

// Chart geometry mirrors the earnings charts: the viewBox width tracks the
// measured container (1 unit ≈ 1px so labels keep their native size), the
// height is fixed, and W_FALLBACK covers jsdom / pre-measure.
const W_FALLBACK = 820
const H = 220
const PAD = { top: 30, right: 8, bottom: 26, left: 8 }

/** A P/E multiple — two decimals, no unit (matches the valuation grid). */
const fmtMultiple = (n: number) => n.toFixed(2)
const fmtEps = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(n).toFixed(2)}`
const fmtPct = (n: number) => `${n >= 0 ? '+' : '-'}${Math.abs(n).toFixed(1)}%`
const fmtPrice = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

/** "Q2 '27" from the fiscal period, falling back to a year-only label. */
function quarterLabel(q: QuarterlyEarningsQuarter): string {
  if (q.fiscal_quarter && q.fiscal_year) {
    return `Q${q.fiscal_quarter} '${String(q.fiscal_year).slice(-2)}`
  }
  if (q.fiscal_year) return `FY${String(q.fiscal_year).slice(-2)}`
  return '—'
}

/**
 * The quarterly walk's anchor: today's price over the trailing twelve months
 * of EPS through the last reported quarter — the newest four reported
 * actuals summed, labelled with that quarter ("Q1 '27"). The same rolling
 * window and (consensus) basis the forward quarter steps use, so the
 * quarterly walk compares like with like end to end. null until four actuals
 * exist or when the TTM is a loss (a P/E over negative earnings is
 * meaningless).
 */
interface QAnchor {
  label: string
  pe: number
  ttmEps: number
}

function trailingTtmPe(
  quarterly: QuarterlyEarnings | null,
  price: number,
): QAnchor | null {
  const reported = (quarterly?.quarters ?? []).filter(
    (q) => q.is_reported && q.eps_actual != null,
  )
  if (reported.length < 4) return null
  // Oldest → newest, so the newest four are at the tail.
  const window = reported.slice(-4)
  const ttmEps = window.reduce((sum, q) => sum + (q.eps_actual as number), 0)
  if (ttmEps <= 0) return null
  return { label: quarterLabel(window[3]), pe: price / ttmEps, ttmEps }
}

/**
 * The walk's anchor: today's price over the last completed fiscal year's
 * reported EPS — a full-year window like the forward consensus years, so
 * every arrow in the walk is a symmetric twelve-month step. The anchor EPS
 * prefers the year's `eps_actual_consensus` — the actual on the same
 * analyst-consensus (adjusted) basis the forward steps use, so the walk
 * compares like with like — and falls back to the reported diluted (GAAP)
 * `eps_actual` when the consensus figure isn't served; the caption beneath
 * the walk owns up to the basis gap only in that fallback. `pe` is null when
 * the year was a loss (a P/E over negative earnings is meaningless); the
 * whole anchor is null when no reported year is served.
 */
interface FyAnchor {
  label: string // "FY26", or "(last FY)" when the year is unlabelled
  pe: number | null
  eps: number
  /** True when `eps` is on the analyst-consensus basis (the forward steps'
   *  basis); false on the GAAP-diluted fallback. */
  consensusBasis: boolean
}

function lastReportedFyPe(
  annual: AnnualEarnings | null,
  price: number,
): FyAnchor | null {
  const reported = (annual?.years ?? []).filter(
    (y) => y.is_reported && (y.eps_actual_consensus ?? y.eps_actual) != null,
  )
  const last = reported[reported.length - 1] // oldest → newest
  if (!last) return null
  const consensusBasis = last.eps_actual_consensus != null
  const eps = (last.eps_actual_consensus ?? last.eps_actual) as number
  return {
    label:
      last.fiscal_year != null
        ? `FY${String(last.fiscal_year).slice(-2)}`
        : '(last FY)',
    pe: eps > 0 ? price / eps : null,
    eps,
    consensusBasis,
  }
}

/** One step of the FY0 → FY1 → FY2 walk: a fiscal year's forward P/E. */
interface FyStep {
  label: string // "FY27", or "(next FY)" for the snapshot fallback
  pe: number | null // null when the consensus EPS is a loss
  epsEstimate: number | null
}

/**
 * The forward fiscal-year steps: today's price over each upcoming year's
 * consensus EPS, for the (up to) two forecast years the annual series carries.
 * With no annual data, the stock snapshot's own forward P/E (price ÷ FY1
 * consensus) stands in as a single unlabelled step so the walk still renders.
 */
function fiscalYearSteps(
  annual: AnnualEarnings | null,
  price: number,
  forwardPe: number | null,
): FyStep[] {
  const upcoming = (annual?.years ?? [])
    .filter((y) => !y.is_reported && y.eps_estimate != null)
    .slice(0, 2)
  if (upcoming.length > 0) {
    return upcoming.map((y) => ({
      label:
        y.fiscal_year != null
          ? `FY${String(y.fiscal_year).slice(-2)}`
          : '(est.)',
      pe: y.eps_estimate! > 0 ? price / y.eps_estimate! : null,
      epsEstimate: y.eps_estimate,
    }))
  }
  if (forwardPe != null) {
    return [{ label: '(next FY)', pe: forwardPe, epsEstimate: null }]
  }
  return []
}

/** One column of the by-quarter chart. `estimated` styles it as a forecast. */
interface PeBar {
  key: string
  label: string
  pe: number
  estimated: boolean
}

/** One step of the quarterly walk: the rolling forward P/E for an upcoming
 *  quarter, with the twelve months of EPS that drive it. */
interface QStep {
  key: string
  label: string
  pe: number
  ttmEps: number
}

/**
 * The rolling forward P/E for each upcoming quarter: today's price over the
 * twelve months of EPS ending at that quarter — reported actuals plus
 * consensus estimates as the window rolls forward. A quarter is skipped when
 * its four-quarter window is incomplete (missing EPS, or not enough history)
 * or sums to a loss.
 */
function rollingQuarterSteps(
  quarterly: QuarterlyEarnings | null,
  price: number,
): QStep[] {
  const qs = quarterly?.quarters ?? [] // oldest → newest
  const eps = qs.map((q) => (q.is_reported ? q.eps_actual : q.eps_estimate))
  const steps: QStep[] = []
  qs.forEach((q, i) => {
    if (q.is_reported || i < 3) return
    const window = eps.slice(i - 3, i + 1)
    if (window.some((v) => v == null)) return
    const ttm = window.reduce((sum: number, v) => sum + (v as number), 0)
    if (ttm <= 0) return
    steps.push({
      key: q.period_end ?? String(i),
      label: quarterLabel(q),
      pe: price / ttm,
      ttmEps: ttm,
    })
  })
  return steps
}

/**
 * A simple bar chart of P/E multiples, one column per period: the anchor bar
 * solid, the estimate-driven ones in the same faint-accent-plus-dashed-outline
 * dress the earnings charts use for forecasts, with the multiple above each
 * bar and the period beneath. All bars share a zero baseline so the falling
 * heights read as the multiple compressing.
 */
function PeBarChart({ bars, ariaLabel }: { bars: PeBar[]; ariaLabel: string }) {
  const theme = useTheme()
  const axis = theme.palette.text.secondary
  const nowColor = theme.palette.secondary.main
  const estColor = theme.palette.primary.main

  // Track the rendered width so the viewBox matches it 1:1 (see the earnings
  // charts) — keeps labels legible instead of shrinking on narrow screens.
  const wrapRef = useRef<HTMLDivElement>(null)
  const [cw, setCw] = useState(W_FALLBACK)
  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = () => {
      const w = el.getBoundingClientRect().width
      if (w > 0) setCw(Math.round(w))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const W = cw

  const { cx, y, barW, slot } = useMemo(() => {
    const plotW = W - PAD.left - PAD.right
    const plotH = H - PAD.top - PAD.bottom
    // P/E bars are all positive (loss windows are filtered out), so the scale
    // runs 0 → max with headroom for the value labels.
    const max = Math.max(...bars.map((b) => b.pe)) * 1.15 || 1
    const slot = plotW / Math.max(bars.length, 1)
    return {
      cx: (i: number) => PAD.left + slot * (i + 0.5),
      y: (v: number) => PAD.top + (1 - v / max) * plotH,
      barW: Math.min(slot * 0.55, 64),
      slot,
    }
  }, [bars, W])

  const baseY = H - PAD.bottom
  // Dashed divider between the trailing "Now" bar and the estimate columns,
  // echoing the reported-vs-forecast split on the earnings charts.
  const splitAt = bars.findIndex((b) => b.estimated)

  return (
    <Box ref={wrapRef}>
      <Box
        component="svg"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={ariaLabel}
        sx={{ width: '100%', height: 'auto', display: 'block' }}
      >
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={baseY}
          y2={baseY}
          stroke={axis}
          strokeWidth={1}
          opacity={0.5}
        />
        {splitAt > 0 && (
          <line
            x1={PAD.left + slot * splitAt}
            x2={PAD.left + slot * splitAt}
            y1={PAD.top}
            y2={baseY}
            stroke={axis}
            strokeWidth={1}
            strokeDasharray="2 3"
            opacity={0.4}
          />
        )}
        {bars.map((b, i) => {
          const center = cx(i)
          const top = y(b.pe)
          const h = Math.max(1, baseY - top)
          const color = b.estimated ? estColor : nowColor
          return (
            <g key={b.key}>
              {b.estimated ? (
                <rect
                  x={center - barW / 2}
                  y={top}
                  width={barW}
                  height={h}
                  rx={2}
                  fill={estColor}
                  fillOpacity={0.18}
                  stroke={estColor}
                  strokeWidth={1.25}
                  strokeDasharray="3 2"
                />
              ) : (
                <rect
                  x={center - barW / 2}
                  y={top}
                  width={barW}
                  height={h}
                  rx={2}
                  fill={nowColor}
                />
              )}
              <text
                x={center}
                y={top - 8}
                fontSize={11}
                fontWeight={600}
                fill={color}
                textAnchor="middle"
              >
                {fmtMultiple(b.pe)}
              </text>
              <text
                x={center}
                y={H - 8}
                fontSize={11}
                fill={b.estimated ? estColor : axis}
                textAnchor="middle"
              >
                {b.label}
              </text>
            </g>
          )
        })}
      </Box>
    </Box>
  )
}

/** One tile of the FY0 → Fwd walk: label, big multiple, and the EPS that
 *  drives it, plus (on forward steps) the change versus the anchor multiple. */
function PeStep({
  label,
  value,
  hint,
  delta,
}: {
  label: string
  value: string
  hint?: string | null
  delta?: { text: string; color: string } | null
}) {
  return (
    <Box
      sx={{
        // A flexible column on desktop; full-width rows when the walk stacks
        // vertically on phones (flex-basis would set *height* there).
        flex: { xs: '0 0 auto', sm: '1 1 120px' },
        maxWidth: { xs: 'none', sm: 220 },
        px: 1.75,
        py: 1.25,
        borderRadius: 1.5,
        bgcolor: 'action.hover',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{
          display: 'block',
          textTransform: 'uppercase',
          letterSpacing: '0.03em',
          fontSize: '0.65rem',
        }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          mt: 0.25,
          fontWeight: 700,
          fontSize: '1.35rem',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.25,
        }}
      >
        {value}
      </Typography>
      {hint && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', mt: 0.25, fontSize: '0.68rem' }}
        >
          {hint}
        </Typography>
      )}
      {delta && (
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            mt: 0.25,
            fontWeight: 600,
            fontSize: '0.7rem',
            color: delta.color,
          }}
        >
          {delta.text}
        </Typography>
      )}
    </Box>
  )
}

/** The rendered content of one walk tile. */
interface WalkTile {
  label: string
  value: string
  hint?: string | null
  delta?: { text: string; color: string } | null
}

/**
 * An anchor → forward-steps walk of PeStep tiles. Reads left → right on
 * desktop; on phones the tiles can't share a row, so it stacks top → bottom
 * with the arrows turned to match (a wrapped row would orphan an arrow and
 * stretch the tiles unevenly).
 */
function PeWalk({
  anchor,
  steps,
}: {
  anchor: WalkTile
  steps: (WalkTile & { key: string })[]
}) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      useFlexGap
      spacing={1}
      sx={{
        mt: 1.5,
        alignItems: { xs: 'stretch', sm: 'center' },
        flexWrap: { xs: 'nowrap', sm: 'wrap' },
      }}
    >
      <PeStep label={anchor.label} value={anchor.value} hint={anchor.hint} />
      {steps.map((s) => (
        <Fragment key={s.key}>
          <Typography
            aria-hidden
            sx={{
              color: 'text.secondary',
              fontSize: '1.2rem',
              lineHeight: 1,
              alignSelf: 'center',
              transform: { xs: 'rotate(90deg)', sm: 'none' },
            }}
          >
            →
          </Typography>
          <PeStep
            label={s.label}
            value={s.value}
            hint={s.hint}
            delta={s.delta}
          />
        </Fragment>
      ))}
    </Stack>
  )
}

/**
 * The forward P/E as two anchored walks, each with its tiles, chart, and
 * footnote:
 *
 * - **By fiscal year** — anchored on the last completed fiscal year (today's
 *   price over its reported EPS), stepping across each forecast year's
 *   consensus EPS. Symmetric full-fiscal-year windows.
 * - **By quarter** — anchored on the trailing twelve months through the last
 *   reported quarter, rolling the same window across the upcoming quarters as
 *   reported actuals blend into consensus estimates.
 *
 * Every multiple divides the SAME price, so a falling multiple is the
 * expected earnings growth. The fiscal-year anchor prefers the consensus-basis
 * actual the API serves, so the walk stays on one basis end to end; only its
 * GAAP fallback can carry a reported-vs-consensus basis gap (which the caption
 * then flags). The card drops entirely when there's no forward consensus to
 * show.
 */
export default function ForwardPeCard({
  price,
  quarterly = null,
  annual = null,
  forwardPe = null,
}: {
  /** Today's price, from the stock snapshot — every multiple uses it. */
  price: number
  /** Feeds the by-quarter walk: its trailing-TTM anchor and the rolling
   *  forward steps. */
  quarterly?: QuarterlyEarnings | null
  /** Feeds the fiscal-year walk: its last-reported-year anchor and the
   *  forward FY steps. */
  annual?: AnnualEarnings | null
  /** The snapshot's own forward P/E (price ÷ FY1 consensus): the fallback
   *  first step when the annual series isn't available. */
  forwardPe?: number | null
}) {
  const fyAnchor = lastReportedFyPe(annual, price)
  const fySteps = fiscalYearSteps(annual, price, forwardPe)
  const qAnchor = trailingTtmPe(quarterly, price)
  const qSteps = rollingQuarterSteps(quarterly, price)
  // No forward consensus anywhere → nothing to say; drop the card.
  if (fySteps.length === 0 && qSteps.length === 0) return null

  // Each walk as chart columns, opening on its anchor — only periods whose
  // EPS yields a meaningful (positive) multiple.
  const fyBars: PeBar[] = [
    ...(fyAnchor?.pe != null
      ? [
          {
            key: 'fy-anchor',
            label: fyAnchor.label,
            pe: fyAnchor.pe,
            estimated: false,
          },
        ]
      : []),
    ...fySteps
      .filter((s) => s.pe != null)
      .map((s, i) => ({
        key: `${s.label}-${i}`,
        label: s.label,
        pe: s.pe as number,
        estimated: true,
      })),
  ]
  const quarterBars: PeBar[] = [
    ...(qAnchor
      ? [
          {
            key: 'q-anchor',
            label: qAnchor.label,
            pe: qAnchor.pe,
            estimated: false,
          },
        ]
      : []),
    ...qSteps.map((s) => ({
      key: s.key,
      label: s.label,
      pe: s.pe,
      estimated: true,
    })),
  ]

  // The move from a walk's anchor multiple, green when the multiple
  // compresses (earnings expected to grow into the price), red when it
  // expands.
  const deltaVs =
    (anchorPe: number | null | undefined, anchorLabel: string | undefined) =>
    (pe: number | null) => {
      if (pe == null || anchorPe == null || !anchorLabel) return null
      const pct = (pe / anchorPe - 1) * 100
      return {
        text: `${fmtPct(pct)} vs ${anchorLabel}`,
        color:
          pct < 0 ? 'success.main' : pct > 0 ? 'error.main' : 'text.secondary',
      }
    }
  const fyDelta = deltaVs(fyAnchor?.pe, fyAnchor?.label)
  const qDelta = deltaVs(qAnchor?.pe, qAnchor?.label)

  return (
    <Card variant="outlined" sx={{ borderColor: 'divider' }}>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
          Forward P/E
        </Typography>
        <Typography variant="caption" color="text.secondary">
          What today&apos;s price ({fmtPrice(price)}) pays per $1 of earnings as
          estimates roll forward
        </Typography>

        {fySteps.length > 0 && (
          <Box sx={{ mt: 2.5 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}
            >
              By fiscal year
            </Typography>
            <PeWalk
              anchor={{
                label: `P/E ${fyAnchor?.label ?? '(last FY)'}`,
                value: fyAnchor?.pe != null ? fmtMultiple(fyAnchor.pe) : '—',
                hint: fyAnchor
                  ? `Reported EPS ${fmtEps(fyAnchor.eps)}${
                      fyAnchor.consensusBasis ? '' : ' (GAAP)'
                    }`
                  : null,
              }}
              steps={fySteps.map((s, i) => ({
                key: `${s.label}-${i}`,
                label: `Fwd P/E ${s.label}`,
                value: s.pe == null ? '—' : fmtMultiple(s.pe),
                hint:
                  s.epsEstimate == null
                    ? null
                    : `Est. EPS ${fmtEps(s.epsEstimate)}`,
                delta: fyDelta(s.pe),
              }))}
            />
            {/* The walk again as columns — worth drawing only when there are
                at least two bars to compare (a lone step already reads on its
                tile). */}
            {fyBars.length >= 2 && (
              <Box sx={{ mt: 2 }}>
                <PeBarChart
                  bars={fyBars}
                  ariaLabel="Forward price-to-earnings by fiscal year"
                />
              </Box>
            )}
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mt: 1.5 }}
            >
              {fyAnchor == null || fyAnchor.consensusBasis ? (
                <>
                  The anchor is today&apos;s price over the last completed
                  fiscal year&apos;s reported EPS on the analyst-consensus basis
                  — the same basis each forward step&apos;s estimate uses — so
                  every step in the walk covers a full fiscal year and compares
                  like with like.
                </>
              ) : (
                <>
                  The anchor is today&apos;s price over the last completed
                  fiscal year&apos;s reported diluted EPS, so every step in the
                  walk covers a full fiscal year. Each forward step divides the
                  same price by that year&apos;s analyst-consensus EPS — a basis
                  that can sit above reported (GAAP) EPS for companies with
                  large non-GAAP adjustments.
                </>
              )}
            </Typography>
          </Box>
        )}

        {qSteps.length > 0 && (
          <Box
            sx={
              fySteps.length > 0
                ? {
                    mt: 2.5,
                    pt: 2.5,
                    borderTop: '1px solid',
                    borderColor: 'divider',
                  }
                : { mt: 2.5 }
            }
          >
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}
            >
              By quarter
            </Typography>
            <PeWalk
              anchor={{
                label: `P/E ${qAnchor?.label ?? '(TTM)'}`,
                value: qAnchor ? fmtMultiple(qAnchor.pe) : '—',
                hint: qAnchor ? `TTM EPS ${fmtEps(qAnchor.ttmEps)}` : null,
              }}
              steps={qSteps.map((s) => ({
                key: s.key,
                label: `Fwd P/E ${s.label}`,
                value: fmtMultiple(s.pe),
                hint: `Est. TTM EPS ${fmtEps(s.ttmEps)}`,
                delta: qDelta(s.pe),
              }))}
            />
            <Box sx={{ mt: 2 }}>
              <PeBarChart
                bars={quarterBars}
                ariaLabel="Forward price-to-earnings by quarter"
              />
            </Box>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mt: 1 }}
            >
              Each step divides today&apos;s price by the twelve months of EPS
              ending that quarter — the anchor through the last reported
              quarter, then reported actuals blending into analyst estimates as
              the window rolls forward. A falling multiple means earnings are
              expected to grow into the price.
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  )
}
