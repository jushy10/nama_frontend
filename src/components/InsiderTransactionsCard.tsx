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
import SwapVertIcon from '@mui/icons-material/SwapVert'
import SectionHeading from '@/components/SectionHeading'
import type { InsiderTransaction, InsiderTransactions } from '@/lib/api'

// Amber for the "mixed" read — the theme defines only green (buy) and red
// (sell), so this fills the neutral middle, the shared amber the verdict cards
// use for a two-sided read.
const MIXED_COLOR = '#fbbf24' // amber-400

// How many rows the feed shows before the "show all" expander — keeps the
// initial list tight when a heavy filer has dozens of transactions.
const COLLAPSED_ROWS = 12

/** "$4.3M" / "$34.2K" — a compact dollar amount, the app's money idiom. */
function fmtMoney(n: number | null): string {
  if (n == null) return '—'
  return `$${n.toLocaleString('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2,
  })}`
}

/** "$200.50" — a plain two-decimal price. */
function fmtPrice(n: number | null): string {
  if (n == null) return '—'
  return `$${n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

/** "1,000" — a whole-share count. */
function fmtShares(n: number | null): string {
  if (n == null) return '—'
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

// Roman-numeral generational suffixes (II, III, IV, …) — kept upper-case by the
// name formatter rather than title-cased to "Iii".
const ROMAN_SUFFIX = /^(?:i{1,3}|iv|vi{0,3}|ix|xi{0,2})$/i

/** Tidy a raw SEC reporting-owner name into Title Case — the source mixes
 *  "COOK TIMOTHY D" with "Borders Ben", so normalize for a clean feed. Keeps
 *  single-letter middle initials and roman-numeral suffixes upper-case, and
 *  capitalizes after an apostrophe or hyphen (O'Brien, Smith-Jones). */
function formatName(raw: string): string {
  return raw
    .trim()
    .split(/\s+/)
    .map((w) => {
      if (w.length <= 1 || ROMAN_SUFFIX.test(w)) return w.toUpperCase()
      return w
        .toLowerCase()
        .replace(/(^|['’-])([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase())
    })
    .join(' ')
}

/** "Jun 15, 2026" from an ISO date, parsed as a *local* date so a UTC-midnight
 *  string doesn't format a day early in negative offsets — the same care
 *  AnalystCard / EarningsCard take with date-only fields. */
function dayLabel(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

type Filter = 'open' | 'all'

/** The conviction read, as a bordered pill — a factual categorization of the
 *  open-market (P/S) activity, in the same idiom as the analyst consensus pill. */
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

/** One side of the ledger: an uppercase label, a bold coloured dollar figure,
 *  and the trade count beneath. */
function Figure({
  label,
  value,
  count,
  color,
  align,
}: {
  label: string
  value: number
  count: number
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
        {count} {count === 1 ? 'trade' : 'trades'}
      </Typography>
    </Box>
  )
}

/** The signature: a proportional buy↔sell flow bar — a green "bought" segment
 *  and a red "sold" segment, widths ∝ their share of the open-market dollar
 *  flow. An empty (all-comp) window leaves a plain track. */
function FlowBar({ buyVal, sellVal }: { buyVal: number; sellVal: number }) {
  const total = buyVal + sellVal
  return (
    <Box
      role="img"
      aria-label={`Open-market flow: ${fmtMoney(buyVal)} bought, ${fmtMoney(
        sellVal,
      )} sold`}
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

/** The hero: the conviction verdict, the two-sided bought/sold figures, the flow
 *  bar, and the net. Reads the open-market rollup only — the comp/tax noise
 *  doesn't move it. */
function SummaryCard({ data }: { data: InsiderTransactions }) {
  const s = data.summary
  const buys = s.open_market_buy_count
  const sells = s.open_market_sell_count
  const total = s.open_market_buy_value + s.open_market_sell_value

  const verdict =
    buys === 0 && sells === 0
      ? { label: 'No open-market trades', color: 'text.secondary' }
      : sells === 0
        ? { label: 'Insiders buying', color: 'success.main' }
        : buys === 0
          ? { label: 'Insiders selling', color: 'error.main' }
          : { label: 'Mixed activity', color: MIXED_COLOR }

  const net = s.net_value

  return (
    <Card variant="outlined" sx={{ borderColor: 'divider' }}>
      <CardContent
        sx={{
          p: { xs: 2, sm: 2.5 },
          '&:last-child': { pb: { xs: 2, sm: 2.5 } },
        }}
      >
        <SectionHeading
          component="h2"
          icon={<SwapVertIcon fontSize="small" />}
          title="Insider transactions"
          subtitle="Open-market buys and sells from SEC Form 4 filings."
          action={<VerdictPill label={verdict.label} color={verdict.color} />}
        />

        <Stack
          direction="row"
          spacing={2}
          sx={{
            mt: 1.75,
            justifyContent: 'space-between',
            alignItems: 'baseline',
          }}
        >
          <Figure
            label="Bought"
            value={s.open_market_buy_value}
            count={buys}
            color="success.main"
            align="left"
          />
          <Figure
            label="Sold"
            value={s.open_market_sell_value}
            count={sells}
            color="error.main"
            align="right"
          />
        </Stack>

        <Box sx={{ mt: 1.5 }}>
          <FlowBar
            buyVal={s.open_market_buy_value}
            sellVal={s.open_market_sell_value}
          />
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
              on the open market · {data.count} reported{' '}
              {data.count === 1 ? 'transaction' : 'transactions'}
            </>
          ) : (
            `${data.count} reported ${
              data.count === 1 ? 'transaction' : 'transactions'
            } · no open-market buys or sells`
          )}
        </Typography>
      </CardContent>
    </Card>
  )
}

/** One transaction: the insider and the trade's dollar value on the top line,
 *  the type + role and the share/price/date detail beneath. Open-market buys and
 *  sells carry the green/red tone + a ▲/▼ glyph; the comp/tax rows read quietly. */
function InsiderRow({ txn }: { txn: InsiderTransaction }) {
  const buy = txn.is_open_market_buy
  const sell = txn.is_open_market_sale
  const tone = buy ? 'success.main' : sell ? 'error.main' : 'text.secondary'
  const glyph = buy ? '▲' : sell ? '▼' : ''
  const typeLabel = buy ? 'Bought' : sell ? 'Sold' : txn.code_label
  const detail =
    txn.shares != null
      ? `${fmtShares(txn.shares)} sh${
          txn.price_per_share != null
            ? ` @ ${fmtPrice(txn.price_per_share)}`
            : ''
        }`
      : null

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
          {formatName(txn.insider_name)}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 700,
            flexShrink: 0,
            color: tone,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {glyph && (
            <Box component="span" sx={{ fontSize: '0.7em', mr: 0.5 }}>
              {glyph}
            </Box>
          )}
          {fmtMoney(txn.value)}
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
          <Box component="span" sx={{ color: tone, fontWeight: 600 }}>
            {typeLabel}
          </Box>
          {txn.role ? ` · ${txn.role}` : ''}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}
        >
          {detail ? `${detail} · ` : ''}
          {dayLabel(txn.transaction_date)}
        </Typography>
      </Stack>
    </Box>
  )
}

/** The transaction feed with the buys-&-sells / all-activity filter and a
 *  show-all expander. */
function FeedCard({ transactions }: { transactions: InsiderTransaction[] }) {
  const [filter, setFilter] = useState<Filter>('open')
  const [expanded, setExpanded] = useState(false)

  const shown =
    filter === 'open'
      ? transactions.filter((t) => t.is_open_market)
      : transactions
  const visible = expanded ? shown : shown.slice(0, COLLAPSED_ROWS)

  return (
    <Card variant="outlined" sx={{ borderColor: 'divider' }}>
      <CardContent
        sx={{
          p: { xs: 2, sm: 2.5 },
          '&:last-child': { pb: { xs: 2, sm: 2.5 } },
        }}
      >
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
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'text.secondary',
            }}
          >
            Transactions
          </Typography>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={filter}
            onChange={(_, v: Filter | null) => v && setFilter(v)}
            aria-label="Filter insider transactions"
          >
            <ToggleButton value="open">Buys &amp; sells</ToggleButton>
            <ToggleButton value="all">All activity</ToggleButton>
          </ToggleButtonGroup>
        </Stack>

        {shown.length === 0 ? (
          <Typography color="text.secondary" sx={{ mt: 2 }}>
            No open-market buys or sells here — only grants, option exercises,
            or tax withholding. Switch to All activity to see them.
          </Typography>
        ) : (
          <>
            <Stack
              spacing={1.5}
              divider={<Divider sx={{ borderColor: 'divider' }} />}
              sx={{ mt: 2 }}
            >
              {visible.map((t, i) => (
                <InsiderRow
                  key={`${t.filing_date}-${t.insider_name}-${i}`}
                  txn={t}
                />
              ))}
            </Stack>
            {shown.length > COLLAPSED_ROWS && (
              <Button
                size="small"
                onClick={() => setExpanded((e) => !e)}
                sx={{ mt: 1.5 }}
              >
                {expanded
                  ? 'Show fewer'
                  : `Show all ${shown.length} transactions`}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * The Insiders tab body: a conviction summary (verdict + bought/sold + the flow
 * bar) over the filterable Form 4 transaction feed. A stock with no reported
 * activity shows a single empty card instead.
 */
export default function InsiderTransactionsCard({
  data,
}: {
  data: InsiderTransactions
}) {
  if (data.transactions.length === 0) {
    return (
      <Card variant="outlined" sx={{ borderColor: 'divider' }}>
        <CardContent sx={{ p: { xs: 2.5, sm: 3 }, textAlign: 'center' }}>
          <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
            No insider transactions
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            No recent Form 4 buys or sells are on file for {data.symbol}.
          </Typography>
        </CardContent>
      </Card>
    )
  }
  return (
    <Stack spacing={2}>
      <SummaryCard data={data} />
      <FeedCard transactions={data.transactions} />
    </Stack>
  )
}
