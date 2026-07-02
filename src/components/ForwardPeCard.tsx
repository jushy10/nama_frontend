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
 * Today's price over the adjusted trailing-twelve-month EPS — the last four
 * reported quarters' actuals summed, the same (consensus) basis the forward
 * estimates are on, so every step of the Current → Fwd walk compares like
 * with like. nulls are skipped and the newest four actuals summed. null until
 * four actuals exist or when the TTM is a loss (a P/E over negative earnings
 * is meaningless).
 */
function currentTtmPe(
  quarterly: QuarterlyEarnings | null,
  price: number,
): { pe: number; ttmEps: number } | null {
  const actuals = (quarterly?.quarters ?? [])
    .filter((q) => q.is_reported)
    .map((q) => q.eps_actual)
    .filter((v): v is number => v != null)
  if (actuals.length < 4) return null
  // Oldest → newest, so the newest four are at the tail.
  const ttmEps = actuals.slice(-4).reduce((sum, v) => sum + v, 0)
  if (ttmEps <= 0) return null
  return { pe: price / ttmEps, ttmEps }
}

/** One step of the Current → FY1 → FY2 walk: a fiscal year's forward P/E. */
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

/**
 * The rolling forward P/E for each upcoming quarter: today's price over the
 * twelve months of EPS ending at that quarter — reported actuals plus
 * consensus estimates as the window rolls forward. A quarter is skipped when
 * its four-quarter window is incomplete (missing EPS, or not enough history)
 * or sums to a loss.
 */
function rollingQuarterBars(
  quarterly: QuarterlyEarnings | null,
  price: number,
): PeBar[] {
  const qs = quarterly?.quarters ?? [] // oldest → newest
  const eps = qs.map((q) => (q.is_reported ? q.eps_actual : q.eps_estimate))
  const bars: PeBar[] = []
  qs.forEach((q, i) => {
    if (q.is_reported || i < 3) return
    const window = eps.slice(i - 3, i + 1)
    if (window.some((v) => v == null)) return
    const ttm = window.reduce((sum: number, v) => sum + (v as number), 0)
    if (ttm <= 0) return
    bars.push({
      key: q.period_end ?? String(i),
      label: quarterLabel(q),
      pe: price / ttm,
      estimated: true,
    })
  })
  return bars
}

/**
 * A simple bar chart of P/E multiples, one column per period: the "Now" bar
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

/** One tile of the Current → Fwd walk: label, big multiple, and the EPS that
 *  drives it, plus (on forward steps) the change versus today's multiple. */
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
        flex: '1 1 120px',
        maxWidth: 220,
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

/**
 * The forward P/E, given room to breathe: a Current P/E → FY1 → FY2 walk
 * (today's price over the last four reported quarters' EPS, then over each
 * forecast year's consensus EPS — the annual series carries two years of
 * estimates), the same walk drawn as a bar chart, and a by-quarter chart of
 * the rolling 12-month P/E as the EPS window rolls across the upcoming
 * quarters. Every multiple divides the SAME price by an EPS on the SAME
 * (consensus) basis, so a falling multiple is purely the expected earnings
 * growth. The card drops entirely when there's no forward consensus to show.
 */
export default function ForwardPeCard({
  price,
  quarterly = null,
  annual = null,
  forwardPe = null,
}: {
  /** Today's price, from the stock snapshot — every multiple uses it. */
  price: number
  /** Feeds the Current P/E anchor (TTM of its reported quarters) and the
   *  by-quarter rolling forward P/E chart. */
  quarterly?: QuarterlyEarnings | null
  annual?: AnnualEarnings | null
  /** The snapshot's own forward P/E (price ÷ FY1 consensus): the fallback
   *  first step when the annual series isn't available. */
  forwardPe?: number | null
}) {
  const current = currentTtmPe(quarterly, price)
  const fySteps = fiscalYearSteps(annual, price, forwardPe)
  const qBars = rollingQuarterBars(quarterly, price)
  // No forward consensus anywhere → nothing to say; drop the card.
  if (fySteps.length === 0 && qBars.length === 0) return null

  // Both charts open on the same trailing anchor bar, when there is one.
  const nowBar: PeBar[] = current
    ? [{ key: 'now', label: 'Now', pe: current.pe, estimated: false }]
    : []
  const quarterBars: PeBar[] = [...nowBar, ...qBars]
  // The fiscal-year walk as chart columns — only the years whose consensus
  // yields a meaningful (positive-earnings) multiple.
  const fyBars: PeBar[] = [
    ...nowBar,
    ...fySteps
      .filter((s) => s.pe != null)
      .map((s, i) => ({
        key: `${s.label}-${i}`,
        label: s.label,
        pe: s.pe as number,
        estimated: true,
      })),
  ]

  // The move from today's multiple, green when the multiple compresses
  // (earnings expected to grow into the price), red when it expands.
  const deltaVsNow = (pe: number | null) => {
    if (pe == null || !current) return null
    const pct = (pe / current.pe - 1) * 100
    return {
      text: `${fmtPct(pct)} vs now`,
      color:
        pct < 0 ? 'success.main' : pct > 0 ? 'error.main' : 'text.secondary',
    }
  }

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
          <>
            <Stack
              direction="row"
              useFlexGap
              spacing={1}
              sx={{ mt: 2.5, alignItems: 'center', flexWrap: 'wrap' }}
            >
              <PeStep
                label="Current P/E"
                value={current ? fmtMultiple(current.pe) : '—'}
                hint={current ? `TTM EPS ${fmtEps(current.ttmEps)}` : null}
              />
              {fySteps.map((s, i) => (
                <Fragment key={`${s.label}-${i}`}>
                  <Typography
                    aria-hidden
                    sx={{
                      color: 'text.secondary',
                      fontSize: '1.2rem',
                      lineHeight: 1,
                    }}
                  >
                    →
                  </Typography>
                  <PeStep
                    label={`Fwd P/E ${s.label}`}
                    value={s.pe == null ? '—' : fmtMultiple(s.pe)}
                    hint={
                      s.epsEstimate == null
                        ? null
                        : `Est. EPS ${fmtEps(s.epsEstimate)}`
                    }
                    delta={deltaVsNow(s.pe)}
                  />
                </Fragment>
              ))}
            </Stack>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mt: 1.5 }}
            >
              Current P/E is today&apos;s price over the last four reported
              quarters&apos; EPS — the same basis the analyst estimates use, so
              every step compares like with like. Each forward step divides the
              same price by that fiscal year&apos;s consensus EPS.
            </Typography>
          </>
        )}

        {/* The walk again as columns — worth drawing only when there are at
            least two bars to compare (a lone step already reads on its tile). */}
        {fyBars.length >= 2 && (
          <Box
            sx={{
              mt: 2.5,
              pt: 2.5,
              borderTop: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}
            >
              By fiscal year
            </Typography>
            <Box sx={{ mt: 1 }}>
              <PeBarChart
                bars={fyBars}
                ariaLabel="Forward price-to-earnings by fiscal year"
              />
            </Box>
          </Box>
        )}

        {qBars.length > 0 && (
          <Box
            sx={
              fySteps.length > 0 || fyBars.length >= 2
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
            <Box sx={{ mt: 1 }}>
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
              Each bar divides today&apos;s price by the twelve months of EPS
              ending that quarter — reported actuals plus analyst estimates as
              the window rolls forward. A falling multiple means earnings are
              expected to grow into the price.
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  )
}
