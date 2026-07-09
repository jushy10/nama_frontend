import {
  Fragment,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Box, Stack, Typography, useTheme } from '@mui/material'
import type {
  AnnualEarnings,
  QuarterlyEarnings,
  QuarterlyEarningsQuarter,
} from '@/lib/api'

// Chart geometry mirrors the earnings charts exactly — same width tracking (the
// viewBox tracks the measured container 1 unit ≈ 1px so labels keep their native
// size), the same fixed height, and the same gutters — so the forward-P/E trend
// reads as a sibling of the reported history above it. W_FALLBACK covers jsdom /
// pre-measure.
const W_FALLBACK = 820
const H = 300
const PAD = { top: 30, right: 56, bottom: 46, left: 12 }

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
 * exist; when the TTM is a loss the anchor keeps its label and EPS but `pe`
 * is null (a P/E over negative earnings is meaningless — the tile shows a
 * dash instead of vanishing).
 */
interface QAnchor {
  label: string
  pe: number | null
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
  return {
    label: quarterLabel(window[3]),
    pe: ttmEps > 0 ? price / ttmEps : null,
    ttmEps,
  }
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
  label: string // "FY27", or "(est.)" when the year is unlabelled
  pe: number | null // null when the consensus EPS is a loss
  epsEstimate: number | null
}

/**
 * The forward fiscal-year steps: today's price over each upcoming year's
 * consensus EPS, for the (up to) two forecast years the annual series carries.
 */
function fiscalYearSteps(
  annual: AnnualEarnings | null,
  price: number,
): FyStep[] {
  return (annual?.years ?? [])
    .filter((y) => !y.is_reported && y.eps_estimate != null)
    .slice(0, 2)
    .map((y) => ({
      label:
        y.fiscal_year != null
          ? `FY${String(y.fiscal_year).slice(-2)}`
          : '(est.)',
      pe: y.eps_estimate! > 0 ? price / y.eps_estimate! : null,
      epsEstimate: y.eps_estimate,
    }))
}

/** One point of the P/E trend chart. `estimated` styles it as a forecast. */
interface PeBar {
  key: string
  label: string
  pe: number
  estimated: boolean
  /** A forward point's move versus the walk's anchor multiple, in percent —
   *  annotated beneath the point the way the earnings charts annotate a
   *  forecast's implied growth. A negative value (the multiple compressing as
   *  earnings grow into the price) reads green; null on the reported/now points,
   *  which carry no such delta. */
  deltaPct?: number | null
}

/** One step of the quarterly walk: the rolling forward P/E for an upcoming
 *  quarter, with the twelve months of EPS that drive it. `pe` is null when
 *  that window sums to a loss. */
interface QStep {
  key: string
  label: string
  pe: number | null
  ttmEps: number
}

/**
 * The rolling forward P/E for each upcoming quarter: today's price over the
 * twelve months of EPS ending at that quarter — reported actuals plus
 * consensus estimates as the window rolls forward. A quarter is skipped only
 * when its four-quarter window is incomplete (missing EPS, or not enough
 * history); a window that sums to a loss keeps its step with a null `pe`, so
 * the tile shows the consensus with a dash rather than vanishing.
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
    steps.push({
      key: q.period_end ?? String(i),
      label: quarterLabel(q),
      pe: ttm > 0 ? price / ttm : null,
      ttmEps: ttm,
    })
  })
  return steps
}

/**
 * A trend line of the P/E multiples, one point per period: the reported anchor
 * and "Now" ride a solid line, the estimate-driven forward steps continue as a
 * dashed line into hollow points — the same reported-then-forecast dress the
 * earnings charts use. The multiple sits above each point, the period beneath,
 * on a 0-based scale so the line's descent honestly reads as the multiple
 * compressing into forward earnings.
 */
function PeTrendChart({
  bars,
  ariaLabel,
}: {
  bars: PeBar[]
  ariaLabel: string
}) {
  const theme = useTheme()
  const axis = theme.palette.text.secondary
  const grid = theme.palette.divider
  const nowColor = theme.palette.secondary.main
  const estColor = theme.palette.primary.main
  const surface = theme.palette.background.paper
  // A compressing multiple (earnings growing into the price) is the good read,
  // so a negative delta is green and a positive one red — matching the walk tiles.
  const up = theme.palette.success.main
  const down = theme.palette.error.main

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

  // Display-only responsiveness from the measured width (not a media query):
  // on a phone-width canvas, cap the points and give the rotated period labels
  // room. The data is untouched — only what the narrow chart draws changes.
  const narrow = W < 420
  const pad = useMemo(
    () => (narrow ? { ...PAD, left: 8, right: 40, bottom: 46 } : PAD),
    [narrow],
  )
  const viewBars = useMemo(
    () => (narrow ? bars.slice(0, 6) : bars),
    [narrow, bars],
  )

  // A forward point can annotate its move vs the anchor beneath its period
  // label, mirroring the earnings charts' growth row. That row rides in 14 extra
  // viewBox units, so a walk with no deltas keeps the plain height.
  const deltaRow = viewBars.some((b) => b.deltaPct != null)
  const vbH = deltaRow ? H + 14 : H

  const { cx, y, slot, ticks } = useMemo(() => {
    const plotW = W - pad.left - pad.right
    const plotH = H - pad.top - pad.bottom
    // P/E points are all positive (loss windows are filtered out), so the scale
    // runs 0 → max with headroom for the value labels.
    const max = Math.max(...viewBars.map((b) => b.pe), 1) * 1.15
    const slot = plotW / Math.max(viewBars.length, 1)
    const tickN = 3
    return {
      cx: (i: number) => pad.left + slot * (i + 0.5),
      y: (v: number) => pad.top + (1 - v / max) * plotH,
      slot,
      ticks: Array.from({ length: tickN + 1 }, (_, i) => (max * i) / tickN),
    }
  }, [viewBars, pad, W])

  const baseY = H - pad.bottom
  // The reported/now points lead; the first estimate begins the forward run. A
  // dashed divider marks the split, echoing the earnings charts.
  const splitAt = viewBars.findIndex((b) => b.estimated)
  const rotateLabels = slot < 44

  // Solid line through the reported/now points; a dashed line through the
  // forward run, bridged from the last solid point so the two read continuous.
  const solidPts = (splitAt < 0 ? viewBars : viewBars.slice(0, splitAt)).map(
    (b, i) => ({ x: cx(i), y: y(b.pe) }),
  )
  const dashStart = splitAt < 0 ? -1 : Math.max(0, splitAt - 1)
  const dashedPts =
    splitAt < 0
      ? []
      : viewBars
          .slice(dashStart)
          .map((b, k) => ({ x: cx(dashStart + k), y: y(b.pe) }))

  return (
    <Box ref={wrapRef}>
      <Box
        component="svg"
        viewBox={`0 0 ${W} ${vbH}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={ariaLabel}
        sx={{ width: '100%', height: 'auto', display: 'block' }}
      >
        {/* gridlines + value axis labels (right) */}
        {ticks.map((t, i) => (
          <g key={`t${i}`}>
            <line
              x1={pad.left}
              x2={W - pad.right}
              y1={y(t)}
              y2={y(t)}
              stroke={grid}
              strokeWidth={1}
            />
            <text x={W - pad.right + 6} y={y(t) + 4} fontSize={13} fill={axis}>
              {fmtMultiple(t)}
            </text>
          </g>
        ))}
        {/* zero baseline, a touch stronger than the gridlines — the 0-based scale
            is what lets the line's descent read as the multiple compressing */}
        <line
          x1={pad.left}
          x2={W - pad.right}
          y1={y(0)}
          y2={y(0)}
          stroke={axis}
          strokeWidth={1}
          opacity={0.5}
        />
        {splitAt > 0 && (
          <line
            x1={pad.left + slot * splitAt}
            x2={pad.left + slot * splitAt}
            y1={pad.top}
            y2={baseY}
            stroke={axis}
            strokeWidth={1}
            strokeDasharray="2 3"
            opacity={0.4}
          />
        )}
        {solidPts.length > 1 && (
          <polyline
            points={solidPts.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke={nowColor}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {dashedPts.length > 1 && (
          <polyline
            points={dashedPts.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke={estColor}
            strokeWidth={2.5}
            strokeDasharray="6 5"
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity={0.85}
          />
        )}
        {viewBars.map((b, i) => {
          const center = cx(i)
          const py = y(b.pe)
          const color = b.estimated ? estColor : nowColor
          return (
            <g key={b.key}>
              {b.estimated ? (
                <circle
                  cx={center}
                  cy={py}
                  r={5.5}
                  fill={surface}
                  stroke={estColor}
                  strokeWidth={2.5}
                />
              ) : (
                <circle
                  cx={center}
                  cy={py}
                  r={6}
                  fill={nowColor}
                  stroke={surface}
                  strokeWidth={2.5}
                />
              )}
              <text
                x={center}
                y={py - 12}
                fontSize={14}
                fontWeight={600}
                fill={color}
                textAnchor="middle"
              >
                {fmtMultiple(b.pe)}
              </text>
              <text
                x={center}
                y={H - 12}
                fontSize={13}
                fill={b.estimated ? estColor : axis}
                textAnchor={rotateLabels ? 'end' : 'middle'}
                transform={
                  rotateLabels ? `rotate(-40 ${center} ${H - 12})` : undefined
                }
              >
                {b.label}
              </text>
              {/* the move vs the anchor multiple, beneath a forward point's
                  label — green as the multiple compresses into growth */}
              {b.deltaPct != null && !rotateLabels && (
                <text
                  x={center}
                  y={H + 2}
                  fontSize={11}
                  fontWeight={500}
                  fill={b.deltaPct <= 0 ? up : down}
                  textAnchor="middle"
                >
                  {fmtPct(b.deltaPct)}
                </text>
              )}
            </g>
          )
        })}
      </Box>
    </Box>
  )
}

/** The trend chart's legend — a gold swatch for the reported/now multiples and a
 *  blue one for the forward estimates, mirroring the earnings charts' legend so
 *  the two read as one family. */
function PeLegend() {
  const swatch = (color: string, label: string) => (
    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
      <Box sx={{ width: 12, height: 12, borderRadius: 0.5, bgcolor: color }} />
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Stack>
  )
  return (
    <Stack
      direction="row"
      spacing={2}
      useFlexGap
      sx={{ flexWrap: 'wrap', mt: 1 }}
    >
      {swatch('secondary.main', 'Reported & now')}
      {swatch('primary.main', 'Upcoming (est.)')}
    </Stack>
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

/** The section heading shared by both walks: the "Forward P/E" label, a short
 *  descriptor of the window (per fiscal year vs. rolling quarter), and the
 *  price context every multiple divides. */
function ForwardPeHeader({
  price,
  windowLabel,
}: {
  price: number
  windowLabel: string
}) {
  return (
    <>
      <Stack
        direction="row"
        spacing={1}
        useFlexGap
        sx={{ alignItems: 'baseline', flexWrap: 'wrap' }}
      >
        <Typography
          variant="subtitle2"
          component="h3"
          sx={{ fontWeight: 700, letterSpacing: '0.01em' }}
        >
          Forward P/E
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}
        >
          {windowLabel}
        </Typography>
      </Stack>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', mt: 0.25 }}
      >
        What today&apos;s price ({fmtPrice(price)}) pays per $1 of earnings as
        estimates roll forward
      </Typography>
    </>
  )
}

/**
 * The forward P/E for a single period, drawn as an anchored walk of tiles plus
 * a bar chart and a footnote. The parent earnings card's Quarterly/Annual
 * toggle picks which:
 *
 * - **annual** — anchored on the last completed fiscal year (today's price over
 *   its reported EPS), stepping across each forecast year's consensus EPS.
 *   Symmetric full-fiscal-year windows.
 * - **quarterly** — anchored on the trailing twelve months through the last
 *   reported quarter, rolling the same window across the upcoming quarters as
 *   reported actuals blend into consensus estimates.
 *
 * Between each anchor and its forward steps sits the **Current P/E** — the
 * ticker card's trailing multiple, the figure quotes report today — so the
 * walk reads reported past → present → consensus future.
 *
 * Every multiple divides the SAME price, so a falling multiple is the expected
 * earnings growth. The fiscal-year anchor prefers the consensus-basis actual
 * the API serves, so the walk stays on one basis end to end; only its GAAP
 * fallback can carry a reported-vs-consensus basis gap (which the caption then
 * flags). Renders nothing when the chosen period has no forward consensus.
 */
export function ForwardPeSection({
  price,
  quarterly = null,
  annual = null,
  trailingPe = null,
  period,
}: {
  /** Today's price, from the ticker card — every multiple uses it. */
  price: number
  /** Feeds the quarterly walk: its trailing-TTM anchor and the rolling forward
   *  steps. */
  quarterly?: QuarterlyEarnings | null
  /** Feeds the annual walk: its last-reported-year anchor and the forward FY
   *  steps. */
  annual?: AnnualEarnings | null
  /** The ticker card's trailing multiple (metrics.pe) — the "Current P/E" tile
   *  each walk threads between its reported anchor and the forward steps. */
  trailingPe?: number | null
  /** Which walk to draw, mirroring the earnings card's period toggle. */
  period: 'quarterly' | 'annual'
}) {
  const fyAnchor = lastReportedFyPe(annual, price)
  const fySteps = fiscalYearSteps(annual, price)
  const qAnchor = trailingTtmPe(quarterly, price)
  const qSteps = rollingQuarterSteps(quarterly, price)

  // The present-day reference both walks share: the ticker card's trailing
  // multiple, threaded between the reported anchor and the forward steps as a
  // tile and as a solid "Now" column on the chart.
  const currentTile: (WalkTile & { key: string }) | null =
    trailingPe != null
      ? {
          key: 'current-pe',
          label: 'Current P/E',
          value: fmtMultiple(trailingPe),
          hint: 'Price ÷ trailing 12-mo EPS',
        }
      : null
  const nowBars: PeBar[] =
    trailingPe != null
      ? [{ key: 'now', label: 'Now', pe: trailingPe, estimated: false }]
      : []

  // The move from a walk's anchor multiple, green when the multiple compresses
  // (earnings expected to grow into the price), red when it expands.
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

  // One card-internal block, set off from the charts above by a top divider.
  // Only reached once a period has a walk to draw (each branch below bails to
  // null first), so the divider never rides an empty section.
  const withDivider = (children: ReactNode) => (
    <Box sx={{ mt: 3, pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
      {children}
    </Box>
  )

  // ── Annual walk: anchor on the last reported fiscal year, step across the
  //    forecast years' consensus. ──
  if (period === 'annual') {
    if (fySteps.length === 0) return null
    const fyDelta = deltaVs(fyAnchor?.pe, fyAnchor?.label)
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
      ...nowBars,
      ...fySteps
        .filter((s) => s.pe != null)
        .map((s, i) => ({
          key: `${s.label}-${i}`,
          label: s.label,
          pe: s.pe as number,
          estimated: true,
          deltaPct:
            fyAnchor?.pe != null
              ? ((s.pe as number) / fyAnchor.pe - 1) * 100
              : null,
        })),
    ]
    return withDivider(
      <>
        <ForwardPeHeader price={price} windowLabel="By fiscal year" />
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
          steps={[
            ...(currentTile ? [currentTile] : []),
            ...fySteps.map((s, i) => ({
              key: `${s.label}-${i}`,
              label: `Fwd P/E ${s.label}`,
              value: s.pe == null ? '—' : fmtMultiple(s.pe),
              hint:
                s.epsEstimate == null
                  ? null
                  : `Est. EPS ${fmtEps(s.epsEstimate)}`,
              delta: fyDelta(s.pe),
            })),
          ]}
        />
        {/* The walk again as a trend line — worth drawing only when there are
            at least two points to compare (a lone step reads on its tile). */}
        {fyBars.length >= 2 && (
          <Box sx={{ mt: 2 }}>
            <PeTrendChart
              bars={fyBars}
              ariaLabel="Forward price-to-earnings by fiscal year"
            />
            <PeLegend />
          </Box>
        )}
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', mt: 1.5 }}
        >
          {fyAnchor == null || fyAnchor.consensusBasis ? (
            <>
              The anchor is today&apos;s price over the last completed fiscal
              year&apos;s reported EPS on the analyst-consensus basis — the same
              basis each forward step&apos;s estimate uses — so every step in
              the walk covers a full fiscal year and compares like with like.
            </>
          ) : (
            <>
              The anchor is today&apos;s price over the last completed fiscal
              year&apos;s reported diluted EPS, so every step in the walk covers
              a full fiscal year. Each forward step divides the same price by
              that year&apos;s analyst-consensus EPS — a basis that can sit
              above reported (GAAP) EPS for companies with large non-GAAP
              adjustments.
            </>
          )}
          {trailingPe != null && (
            <>
              {' '}
              The Current P/E between them is the ticker card&apos;s trailing
              multiple — today&apos;s price over the last twelve months of
              reported EPS, the figure quotes report today.
            </>
          )}
        </Typography>
      </>,
    )
  }

  // ── Quarterly walk: anchor on the trailing twelve months, roll the window
  //    across the upcoming quarters. ──
  if (qSteps.length === 0) return null
  const qDelta = deltaVs(qAnchor?.pe, qAnchor?.label)
  const quarterBars: PeBar[] = [
    ...(qAnchor?.pe != null
      ? [
          {
            key: 'q-anchor',
            label: qAnchor.label,
            pe: qAnchor.pe,
            estimated: false,
          },
        ]
      : []),
    ...nowBars,
    ...qSteps
      .filter((s) => s.pe != null)
      .map((s) => ({
        key: s.key,
        label: s.label,
        pe: s.pe as number,
        estimated: true,
        deltaPct:
          qAnchor?.pe != null
            ? ((s.pe as number) / qAnchor.pe - 1) * 100
            : null,
      })),
  ]
  return withDivider(
    <>
      <ForwardPeHeader price={price} windowLabel="By quarter" />
      <PeWalk
        anchor={{
          label: `P/E ${qAnchor?.label ?? '(TTM)'}`,
          value: qAnchor?.pe != null ? fmtMultiple(qAnchor.pe) : '—',
          hint: qAnchor ? `TTM EPS ${fmtEps(qAnchor.ttmEps)}` : null,
        }}
        steps={[
          ...(currentTile ? [currentTile] : []),
          ...qSteps.map((s) => ({
            key: s.key,
            label: `Fwd P/E ${s.label}`,
            value: s.pe == null ? '—' : fmtMultiple(s.pe),
            hint: `Est. TTM EPS ${fmtEps(s.ttmEps)}`,
            delta: qDelta(s.pe),
          })),
        ]}
      />
      {/* Loss windows plot no point, so draw the line only when at least two
          multiples remain to compare. */}
      {quarterBars.length >= 2 && (
        <Box sx={{ mt: 2 }}>
          <PeTrendChart
            bars={quarterBars}
            ariaLabel="Forward price-to-earnings by quarter"
          />
          <PeLegend />
        </Box>
      )}
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', mt: 1 }}
      >
        Each step divides today&apos;s price by the twelve months of EPS ending
        that quarter — the anchor through the last reported quarter, then
        reported actuals blending into analyst estimates as the window rolls
        forward. A falling multiple means earnings are expected to grow into the
        price.
        {trailingPe != null && (
          <>
            {' '}
            The Current P/E is the ticker card&apos;s trailing multiple over
            reported EPS — the standard quote, which can sit apart from the
            anchor&apos;s consensus-basis window.
          </>
        )}
      </Typography>
    </>,
  )
}

export default ForwardPeSection
