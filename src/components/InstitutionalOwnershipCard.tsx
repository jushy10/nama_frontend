import { useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import AccountBalanceIcon from '@mui/icons-material/AccountBalance'
import SectionHeading from '@/components/SectionHeading'
import type {
  InstitutionalHolder,
  InstitutionalOwnership,
  OwnershipBreakdown,
} from '@/lib/api'

// Amber for the "mixed" read — the shared neutral-middle the verdict cards use
// when a window has both buyers and sellers (matches InsiderTransactionsCard).
const MIXED_COLOR = '#fbbf24' // amber-400

// How many holders the list shows before the "show all" expander.
const COLLAPSED_ROWS = 12

/** "$4.3M" / "$234.5B" — a compact dollar amount, the app's money idiom. */
function fmtMoney(n: number | null): string {
  if (n == null) return '—'
  return `$${n.toLocaleString('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2,
  })}`
}

/** "8.9%" — a one-decimal percentage; "—" when unknown. */
function fmtPct(n: number | null, digits = 1): string {
  if (n == null) return '—'
  return `${n.toFixed(digits)}%`
}

/** "Jun 30, 2026" from an ISO date, parsed as a *local* date so a UTC-midnight
 *  string doesn't format a day early — the same care the sibling cards take. */
function dayLabel(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/** "Fund" / "Institution" — the holder-type tag, from the raw slug. */
function holderTypeLabel(type: string): string {
  return type === 'mutual_fund' ? 'Fund' : 'Institution'
}

type Filter = 'all' | 'building' | 'trimming'

/** The conviction read, as a bordered pill — the same idiom as the insider and
 *  analyst-consensus pills, so the two ownership cards on this tab rhyme. */
function VerdictPill({ label, color }: { label: string; color: string }) {
  return (
    <Box
      sx={{
        flexShrink: 0,
        px: 1.5,
        py: 0.5,
        borderRadius: 2,
        border: '1px solid',
        borderColor: color,
        color,
        bgcolor: 'action.hover',
        fontWeight: 700,
        fontSize: '0.8rem',
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </Box>
  )
}

/** The signature: an ownership-composition meter. A blue "institutions" segment
 *  and a gold "insiders" segment over a muted "public float" track, widths ∝
 *  their share of the company. Deliberately the wordmark's blue+gold — the
 *  *who-owns-it* language, kept distinct from the green/red *which-way-they-trade*
 *  flow bar below. Renders nothing without an institutional figure to anchor it. */
function OwnershipMeter({ breakdown }: { breakdown: OwnershipBreakdown }) {
  const inst = breakdown.institutions_pct_held
  if (inst == null) return null

  // Clamp onto a 0–100 base of shares outstanding; the remainder is public/other.
  const instW = Math.min(Math.max(inst, 0), 100)
  const insiders = breakdown.insiders_pct_held ?? 0
  const insW = Math.min(Math.max(insiders, 0), 100 - instW)
  const publicW = Math.max(0, 100 - instW - insW)

  const legend: { label: string; value: number | null; color: string }[] = [
    { label: 'Institutions', value: inst, color: 'primary.main' },
    {
      label: 'Insiders',
      value: breakdown.insiders_pct_held,
      color: 'secondary.main',
    },
    { label: 'Public', value: publicW, color: 'text.disabled' },
  ]

  return (
    <Box>
      <Box
        role="img"
        aria-label={`Ownership: institutions ${fmtPct(inst)}, insiders ${fmtPct(
          breakdown.insiders_pct_held,
        )}, public ${fmtPct(publicW)}`}
        sx={{
          display: 'flex',
          height: 14,
          borderRadius: 1,
          overflow: 'hidden',
          bgcolor: 'action.hover',
        }}
      >
        {instW > 0 && (
          <Box sx={{ width: `${instW}%`, bgcolor: 'primary.main' }} />
        )}
        {insW > 0 && (
          <Box sx={{ width: `${insW}%`, bgcolor: 'secondary.main' }} />
        )}
      </Box>
      <Stack
        direction="row"
        spacing={2}
        sx={{ mt: 1, flexWrap: 'wrap', rowGap: 0.5 }}
      >
        {legend.map((item) => (
          <Stack
            key={item.label}
            direction="row"
            spacing={0.75}
            sx={{ alignItems: 'center' }}
          >
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: item.color,
                flexShrink: 0,
              }}
            />
            <Typography variant="caption" color="text.secondary">
              {item.label}{' '}
              <Box
                component="span"
                sx={{
                  fontWeight: 700,
                  color: 'text.primary',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {fmtPct(item.value)}
              </Box>
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  )
}

/** One side of the flow ledger: an uppercase label, a bold coloured dollar
 *  figure, and the holder count beneath. */
function Figure({
  label,
  value,
  count,
  unit,
  color,
  align,
}: {
  label: string
  value: number
  count: number
  unit: string
  color: string
  align: 'left' | 'right'
}) {
  return (
    <Box sx={{ textAlign: align }}>
      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          display: 'block',
        }}
      >
        {label}
      </Typography>
      <Typography
        variant="h6"
        sx={{
          fontWeight: 700,
          color,
          lineHeight: 1.2,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {fmtMoney(value)}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {count} {unit}
        {count === 1 ? '' : 's'}
      </Typography>
    </Box>
  )
}

/** A proportional bought↔sold flow bar (green added / red trimmed), widths ∝
 *  their share of the quarter's 13F dollar flow — the same idiom as the insider
 *  card so the two cards read as siblings. */
function FlowBar({ buyVal, sellVal }: { buyVal: number; sellVal: number }) {
  const total = buyVal + sellVal
  return (
    <Box
      role="img"
      aria-label={`Quarterly 13F flow: ${fmtMoney(buyVal)} added, ${fmtMoney(
        sellVal,
      )} trimmed`}
      sx={{
        display: 'flex',
        height: 10,
        borderRadius: 1,
        overflow: 'hidden',
        bgcolor: 'action.hover',
      }}
    >
      {total > 0 && buyVal > 0 && (
        <Box
          sx={{ width: `${(buyVal / total) * 100}%`, bgcolor: 'success.main' }}
        />
      )}
      {total > 0 && sellVal > 0 && (
        <Box
          sx={{ width: `${(sellVal / total) * 100}%`, bgcolor: 'error.main' }}
        />
      )}
    </Box>
  )
}

/** The hero: the ownership-composition meter (the signature) leads, then the
 *  quarterly buy-vs-sell flow — verdict pill, the two-sided added/trimmed figures,
 *  the flow bar, and the net. */
function SummaryCard({ data }: { data: InstitutionalOwnership }) {
  const f = data.flow
  const buyers = f.buyers_count
  const sellers = f.sellers_count
  const total = f.value_bought + f.value_sold

  const verdict =
    buyers === 0 && sellers === 0
      ? { label: 'No position changes', color: 'text.secondary' }
      : sellers === 0
        ? { label: 'Institutions accumulating', color: 'success.main' }
        : buyers === 0
          ? { label: 'Institutions distributing', color: 'error.main' }
          : { label: 'Mixed activity', color: MIXED_COLOR }

  const net = f.net_value_change
  const asOf = dayLabel(data.latest_report_date)
  const count = data.breakdown?.institutions_count ?? null
  const floatPct = data.breakdown?.institutions_float_pct_held ?? null

  return (
    <Card variant="outlined" sx={{ borderColor: 'divider' }}>
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        <SectionHeading
          component="h2"
          icon={<AccountBalanceIcon fontSize="small" />}
          title="Institutional ownership"
          subtitle="The big-money funds that hold this stock — and their latest quarterly moves."
          action={<VerdictPill label={verdict.label} color={verdict.color} />}
        />

        {data.breakdown && (
          <Box sx={{ mt: 2.5 }}>
            <OwnershipMeter breakdown={data.breakdown} />
            {(count != null || floatPct != null) && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mt: 1, display: 'block' }}
              >
                {count != null && (
                  <>
                    Held by{' '}
                    <Box
                      component="span"
                      sx={{ fontWeight: 700, color: 'text.primary' }}
                    >
                      {count.toLocaleString('en-US')}
                    </Box>{' '}
                    institutions
                  </>
                )}
                {count != null && floatPct != null && ' · '}
                {floatPct != null && `${fmtPct(floatPct)} of float`}
              </Typography>
            )}
          </Box>
        )}

        <Divider sx={{ my: 2.5, borderColor: 'divider' }} />

        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'text.secondary',
          }}
        >
          Quarterly moves
        </Typography>

        <Stack
          direction="row"
          spacing={2}
          sx={{
            mt: 1.5,
            justifyContent: 'space-between',
            alignItems: 'baseline',
          }}
        >
          <Figure
            label="Added"
            value={f.value_bought}
            count={buyers}
            unit="buyer"
            color="success.main"
            align="left"
          />
          <Figure
            label="Trimmed"
            value={f.value_sold}
            count={sellers}
            unit="seller"
            color="error.main"
            align="right"
          />
        </Stack>

        <Box sx={{ mt: 1.5 }}>
          <FlowBar buyVal={f.value_bought} sellVal={f.value_sold} />
        </Box>

        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mt: 1.5, display: 'block' }}
        >
          {total > 0 ? (
            <>
              Net{' '}
              <Box
                component="span"
                sx={{
                  fontWeight: 700,
                  color: net >= 0 ? 'success.main' : 'error.main',
                }}
              >
                {net >= 0 ? '+' : '-'}
                {fmtMoney(Math.abs(net))}
              </Box>{' '}
              across 13F filings
              {data.latest_report_date ? ` as of ${asOf}` : ''}
            </>
          ) : data.latest_report_date ? (
            `No reported position changes as of ${asOf}`
          ) : (
            'No reported position changes'
          )}
        </Typography>
      </CardContent>
    </Card>
  )
}

/** One holder: the fund and its position value on the top line, the type + % of
 *  the company held and the quarter-over-quarter change beneath. Builders read
 *  green (▲), trimmers red (▼); an unchanged/unknown holder reads quietly. */
function HolderRow({ holder }: { holder: InstitutionalHolder }) {
  const change = holder.pct_change
  const building = holder.is_buyer
  const trimming = holder.is_seller
  const tone = building
    ? 'success.main'
    : trimming
      ? 'error.main'
      : 'text.secondary'
  const glyph = building ? '▲' : trimming ? '▼' : ''
  const changeLabel =
    change == null
      ? 'New or unchanged'
      : change === 0
        ? 'No change'
        : `${fmtPct(Math.abs(change))}`

  return (
    <Box sx={{ minWidth: 0 }}>
      <Stack
        direction="row"
        spacing={1}
        sx={{ justifyContent: 'space-between', alignItems: 'baseline' }}
      >
        <Typography
          variant="body2"
          sx={{
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {holder.holder}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 700,
            flexShrink: 0,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {fmtMoney(holder.value)}
        </Typography>
      </Stack>
      <Stack
        direction="row"
        spacing={1}
        sx={{ justifyContent: 'space-between', alignItems: 'baseline' }}
      >
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {holderTypeLabel(holder.holder_type)}
          {holder.pct_held != null
            ? ` · ${fmtPct(holder.pct_held)} of shares`
            : ''}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            flexShrink: 0,
            fontWeight: 600,
            color: tone,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {glyph && (
            <Box component="span" sx={{ fontSize: '0.85em', mr: 0.5 }}>
              {glyph}
            </Box>
          )}
          {changeLabel}
        </Typography>
      </Stack>
    </Box>
  )
}

/** The top-holders list, scoped to the latest reported quarter, with an
 *  all/building/trimming filter and a show-all expander. */
function HoldersCard({
  holders,
  asOf,
}: {
  holders: InstitutionalHolder[]
  asOf: string
}) {
  const [filter, setFilter] = useState<Filter>('all')
  const [expanded, setExpanded] = useState(false)

  const shown =
    filter === 'building'
      ? holders.filter((h) => h.is_buyer)
      : filter === 'trimming'
        ? holders.filter((h) => h.is_seller)
        : holders
  const visible = expanded ? shown : shown.slice(0, COLLAPSED_ROWS)

  const emptyLine =
    filter === 'building'
      ? 'No institutions grew their position last quarter.'
      : filter === 'trimming'
        ? 'No institutions cut their position last quarter.'
        : 'No institutional holders on file.'

  return (
    <Card variant="outlined" sx={{ borderColor: 'divider' }}>
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack
          direction="row"
          spacing={2}
          sx={{
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            rowGap: 1,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'text.secondary',
              }}
            >
              Top holders
            </Typography>
            <Typography variant="caption" color="text.secondary">
              As of {asOf}
            </Typography>
          </Box>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={filter}
            onChange={(_, v: Filter | null) => v && setFilter(v)}
            aria-label="Filter institutional holders"
          >
            <ToggleButton value="all">All</ToggleButton>
            <ToggleButton value="building">Building</ToggleButton>
            <ToggleButton value="trimming">Trimming</ToggleButton>
          </ToggleButtonGroup>
        </Stack>

        {shown.length === 0 ? (
          <Typography color="text.secondary" sx={{ mt: 2.5 }}>
            {emptyLine}
          </Typography>
        ) : (
          <>
            <Stack
              spacing={1.5}
              divider={<Divider sx={{ borderColor: 'divider' }} />}
              sx={{ mt: 2 }}
            >
              {visible.map((h, i) => (
                <HolderRow
                  key={`${h.holder}-${h.date_reported}-${i}`}
                  holder={h}
                />
              ))}
            </Stack>
            {shown.length > COLLAPSED_ROWS && (
              <Button
                size="small"
                onClick={() => setExpanded((e) => !e)}
                sx={{ mt: 1.5 }}
              >
                {expanded ? 'Show fewer' : `Show all ${shown.length} holders`}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * The institutional-ownership section of the Insiders tab: an ownership-
 * composition + quarterly-flow summary over the top-holders list (scoped to the
 * latest reported 13F quarter). A stock with no institutional holders on file
 * shows a single empty card instead.
 */
export default function InstitutionalOwnershipCard({
  data,
}: {
  data: InstitutionalOwnership
}) {
  if (data.holders.length === 0) {
    return (
      <Card variant="outlined" sx={{ borderColor: 'divider' }}>
        <CardContent sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
            No institutional ownership
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            No 13F institutional holdings are on file for {data.symbol}.
          </Typography>
        </CardContent>
      </Card>
    )
  }

  // The list is the current picture — the holders reported for the most recent
  // quarter (the feed also carries earlier quarters for the same funds).
  const latest = data.latest_report_date
  const currentHolders = latest
    ? data.holders.filter((h) => h.date_reported === latest)
    : data.holders

  return (
    <Stack spacing={3}>
      <SummaryCard data={data} />
      <HoldersCard holders={currentHolders} asOf={dayLabel(latest)} />
    </Stack>
  )
}
