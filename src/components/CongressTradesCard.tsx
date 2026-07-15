import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Stack,
  Typography,
} from '@mui/material'
import AccountBalanceIcon from '@mui/icons-material/AccountBalance'
import SectionHeading from '@/components/SectionHeading'
import type { CongressTrade, CongressTrades } from '@/lib/api'

// Amber for the "mixed" read — the theme defines only green (buy) and red (sell),
// so this fills the neutral middle, the same amber the insider/verdict cards use.
const MIXED_COLOR = '#fbbf24' // amber-400

// How many trades the feed shows before the "show all" expander.
const COLLAPSED_ROWS = 6

/** "~$4.3M" / "~$34.2K" — a compact dollar amount. The tilde is deliberate:
 *  Congress discloses a *range*, so every figure here is an estimate (the band
 *  midpoint), never a reported total. */
function fmtEst(n: number | null): string {
  if (n == null) return '—'
  return `~$${n.toLocaleString('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  })}`
}

/** "Jul 2, 2026" from an ISO date, parsed as a *local* date so a UTC-midnight
 *  string doesn't format a day early — the same care the other date-only cards take. */
function dayLabel(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/** "Bought" / "Sold" / "Exchanged" / the raw type for the rare other action. */
function typeLabel(t: CongressTrade): string {
  if (t.is_buy) return 'Bought'
  if (t.is_sell) return 'Sold'
  if (t.tx_type === 'Exchange') return 'Exchanged'
  return t.tx_type
}

/** The conviction read as a bordered pill, in the same idiom as the insider /
 *  analyst-consensus pills. */
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

/** The proportional bought↔sold flow bar — a green "bought" segment and a red
 *  "sold" segment, widths ∝ their share of the estimated dollar flow. */
function FlowBar({ buyVal, sellVal }: { buyVal: number; sellVal: number }) {
  const total = buyVal + sellVal
  return (
    <Box
      role="img"
      aria-label={`Congressional flow: ${fmtEst(buyVal)} bought, ${fmtEst(
        sellVal,
      )} sold (estimated)`}
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

/** One disclosed trade: the member + estimated size on the top line (buys green /
 *  sells red with a ▲/▼ glyph), the chamber + action + disclosed date beneath. */
function TradeRow({ trade }: { trade: CongressTrade }) {
  const tone = trade.is_buy
    ? 'success.main'
    : trade.is_sell
      ? 'error.main'
      : 'text.secondary'
  const glyph = trade.is_buy ? '▲' : trade.is_sell ? '▼' : ''

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
          {trade.member}
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
          {fmtEst(trade.amount_midpoint)}
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
            {typeLabel(trade)}
          </Box>
          {` · ${trade.chamber}`}
          {trade.amount_range ? ` · ${trade.amount_range}` : ''}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}
        >
          {dayLabel(trade.disclosure_date ?? trade.transaction_date)}
        </Typography>
      </Stack>
    </Box>
  )
}

/**
 * Best-effort ticker section: a stock's recent Congressional trades (STOCK Act
 * disclosures) with a net bought-vs-sold read over the filterable feed. It
 * **self-hides** when there are none — Congress trades few stocks, so most cards
 * render nothing — so it only appears where there's a real signal, and a failed
 * fetch simply omits it.
 */
export default function CongressTradesCard({ data }: { data: CongressTrades }) {
  const [expanded, setExpanded] = useState(false)

  // Hide when empty — the best-effort contract: no activity, no card.
  if (data.items.length === 0) return null

  const s = data.summary
  const buys = s.buy_count
  const sells = s.sell_count
  const total = s.buy_value + s.sell_value
  const net = s.net_value

  const verdict =
    buys === 0 && sells === 0
      ? { label: 'Recent activity', color: 'text.secondary' }
      : sells === 0
        ? { label: 'Congress buying', color: 'success.main' }
        : buys === 0
          ? { label: 'Congress selling', color: 'error.main' }
          : { label: 'Mixed activity', color: MIXED_COLOR }

  const visible = expanded ? data.items : data.items.slice(0, COLLAPSED_ROWS)

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
          icon={<AccountBalanceIcon fontSize="small" />}
          title="Congress trades"
          subtitle="Stock trades disclosed by members of Congress under the STOCK Act."
          action={<VerdictPill label={verdict.label} color={verdict.color} />}
        />

        {total > 0 && (
          <Box sx={{ mt: 2 }}>
            <FlowBar buyVal={s.buy_value} sellVal={s.sell_value} />
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mt: 1, display: 'block' }}
            >
              Net{' '}
              <Box
                component="span"
                sx={{
                  fontWeight: 700,
                  color: net >= 0 ? 'success.main' : 'error.main',
                }}
              >
                {net >= 0 ? '+' : '−'}
                {fmtEst(Math.abs(net)).replace('~', '')}
              </Box>{' '}
              (est.) across {data.total} disclosed{' '}
              {data.total === 1 ? 'trade' : 'trades'}
            </Typography>
          </Box>
        )}

        <Stack
          spacing={1.5}
          divider={<Divider sx={{ borderColor: 'divider' }} />}
          sx={{ mt: 2 }}
        >
          {visible.map((t, i) => (
            <TradeRow
              key={`${t.member}-${t.transaction_date}-${t.amount_range}-${i}`}
              trade={t}
            />
          ))}
        </Stack>

        <Stack
          direction="row"
          spacing={1}
          sx={{
            mt: 1.5,
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            rowGap: 0.5,
          }}
        >
          {data.items.length > COLLAPSED_ROWS ? (
            <Button size="small" onClick={() => setExpanded((e) => !e)}>
              {expanded ? 'Show fewer' : `Show all ${data.items.length} trades`}
            </Button>
          ) : (
            <Box />
          )}
          <Button
            size="small"
            component={RouterLink}
            to="/congress"
            sx={{ color: 'text.secondary' }}
          >
            All Congress trades →
          </Button>
        </Stack>

        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mt: 1.5, display: 'block' }}
        >
          Congress discloses a dollar range, not an exact amount, so figures are
          estimated at the midpoint of each band.
        </Typography>
      </CardContent>
    </Card>
  )
}
