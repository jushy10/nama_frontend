import { useState } from 'react'
import {
  Box,
  Card,
  CardContent,
  Chip,
  FormControl,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  type SelectChangeEvent,
} from '@mui/material'
import CandlestickChartIcon from '@mui/icons-material/CandlestickChart'
import SectionHeading from '@/components/SectionHeading'
import type { OptionContract, OptionContractType, OptionsFlow } from '@/lib/api'

// Calls read green (upside bets), puts red (downside cover) — the same
// green/red idiom the insider and options-market cards use for a two-sided read.
const CALL_COLOR = 'success.main'
const PUT_COLOR = 'error.main'

/** "$4.3M" / "$0" — a compact dollar amount, the app's money idiom; a dash for
 *  an unpriceable figure. */
function fmtMoney(n: number | null): string {
  if (n == null) return '—'
  return `$${n.toLocaleString('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2,
  })}`
}

/** "1,250" — a whole count (volume, open interest); a dash when unreported. */
function fmtInt(n: number | null): string {
  if (n == null) return '—'
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

/** "$203.90" — a plain two-decimal price/strike; a dash when absent. */
function fmtPrice(n: number | null): string {
  if (n == null) return '—'
  return `$${n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

/** "28.4%" — implied volatility (already a percent); a dash when absent. */
function fmtPct(n: number | null): string {
  return n == null ? '—' : `${n.toFixed(1)}%`
}

/** Parse a date-only "YYYY-MM-DD" as a *local* date — `new Date(iso)` treats it
 *  as UTC midnight, which formats a day early in negative offsets. */
function parseDateOnly(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** "Jul 31, 2026" — expiry dates can cross a year boundary, so keep the year. */
const fmtDate = (iso: string) =>
  parseDateOnly(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

/** One side's headline: an uppercase label, the big contract-volume count in its
 *  side colour, and the day's premium beneath. */
function SideFigure({
  label,
  volume,
  premium,
  color,
  align,
}: {
  label: string
  volume: number
  premium: number
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
        {fmtInt(volume)}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {fmtMoney(premium)} premium
      </Typography>
    </Box>
  )
}

/** The proportional call↔put volume bar — a green calls segment and a red puts
 *  segment, widths ∝ their share of today's contract volume. */
function VolumeBar({ callVol, putVol }: { callVol: number; putVol: number }) {
  const total = callVol + putVol
  return (
    <Box
      role="img"
      aria-label={`Volume: ${fmtInt(callVol)} call contracts, ${fmtInt(
        putVol,
      )} put contracts`}
      sx={{
        display: 'flex',
        height: 10,
        borderRadius: 1,
        overflow: 'hidden',
        bgcolor: 'action.hover',
      }}
    >
      {total > 0 && callVol > 0 && (
        <Box
          sx={{ width: `${(callVol / total) * 100}%`, bgcolor: CALL_COLOR }}
        />
      )}
      {total > 0 && putVol > 0 && (
        <Box sx={{ width: `${(putVol / total) * 100}%`, bgcolor: PUT_COLOR }} />
      )}
    </Box>
  )
}

/** One standout (unusual-activity) contract: a call/put tag, its strike, the
 *  volume-vs-open-interest that flagged it, and the day's premium. */
function UnusualRow({ c }: { c: OptionContract }) {
  const isCall = c.type === 'call'
  const color = isCall ? CALL_COLOR : PUT_COLOR
  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{ justifyContent: 'space-between', alignItems: 'baseline' }}
    >
      <Typography
        variant="body2"
        sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}
      >
        <Box component="span" sx={{ color, fontWeight: 700 }}>
          {isCall ? 'CALL' : 'PUT'} {fmtPrice(c.strike)}
        </Box>
        <Box component="span" sx={{ color: 'text.secondary' }}>
          {' · '}
          {fmtInt(c.volume)} vol vs {fmtInt(c.open_interest)} OI
        </Box>
      </Typography>
      <Typography
        variant="body2"
        sx={{
          fontWeight: 700,
          flexShrink: 0,
          color,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {fmtMoney(c.premium)}
      </Typography>
    </Stack>
  )
}

/** The strike ladder for one side: strike, last, volume, open interest, IV, and
 *  the day's premium. In-the-money rows carry a faint tint; unusual rows a dot in
 *  the strike cell. Scrolls within a fixed height so a deep chain stays compact. */
function ChainTable({
  contracts,
  color,
}: {
  contracts: OptionContract[]
  color: string
}) {
  if (contracts.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ mt: 2 }}>
        No contracts on this side for this expiry.
      </Typography>
    )
  }
  return (
    <TableContainer sx={{ mt: 1.5, maxHeight: 420 }}>
      <Table size="small" stickyHeader sx={{ '& td, & th': { px: 1 } }}>
        <TableHead>
          <TableRow>
            <TableCell>Strike</TableCell>
            <TableCell align="right">Last</TableCell>
            <TableCell align="right">Volume</TableCell>
            <TableCell align="right">Open int.</TableCell>
            <TableCell align="right">IV</TableCell>
            <TableCell align="right">Premium</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {contracts.map((c) => (
            <TableRow
              key={`${c.type}-${c.strike}`}
              sx={c.in_the_money ? { bgcolor: 'action.hover' } : undefined}
            >
              <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>
                <Stack
                  direction="row"
                  spacing={0.75}
                  sx={{ alignItems: 'center' }}
                >
                  {c.unusual && (
                    <Box
                      aria-label="unusual activity"
                      sx={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        bgcolor: color,
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <span>{fmtPrice(c.strike)}</span>
                </Stack>
              </TableCell>
              <TableCell
                align="right"
                sx={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {fmtPrice(c.last_price)}
              </TableCell>
              <TableCell
                align="right"
                sx={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {fmtInt(c.volume)}
              </TableCell>
              <TableCell
                align="right"
                sx={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {fmtInt(c.open_interest)}
              </TableCell>
              <TableCell
                align="right"
                sx={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {fmtPct(c.implied_volatility)}
              </TableCell>
              <TableCell
                align="right"
                sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}
              >
                {fmtMoney(c.premium)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

/**
 * The Options-tab flow view: one expiry's calls/puts chain, the day's aggregate
 * flow (call vs put volume, the put/call lean and net premium), and the
 * unusual-activity standouts (contracts trading above their open interest). The
 * expiry selector rides `data.expiration`; picking another asks the parent to
 * refetch. A symbol with no listed options renders a single empty card.
 *
 * Scope note (shown on the card): this reads Yahoo's cumulative day volume and
 * prior-day open interest — a "where's the volume and money going" snapshot, not a
 * trade-by-trade tape with the bid/ask side of each print.
 */
export default function OptionsFlowCard({
  data,
  expiration,
  onExpirationChange,
}: {
  data: OptionsFlow
  /** The expiry currently requested (null = the nearest, which `data.expiration`
   *  resolves to). Kept in the parent so the query refetches on a change. */
  expiration: string | null
  onExpirationChange: (iso: string) => void
}) {
  const [side, setSide] = useState<OptionContractType>('call')

  if (data.expirations.length === 0 || !data.summary || !data.expiration) {
    return (
      <Card variant="outlined" sx={{ borderColor: 'divider' }}>
        <CardContent sx={{ p: { xs: 2.5, sm: 3 }, textAlign: 'center' }}>
          <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
            No options chain
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            No listed options for {data.ticker}.
          </Typography>
        </CardContent>
      </Card>
    )
  }

  const s = data.summary
  const net = s.net_premium
  // The selector reflects the served expiry; `expiration` (the requested one) may
  // be null on first load, when the backend picked the nearest for us.
  const selected = expiration ?? data.expiration

  const expirySelect = (
    <FormControl size="small" sx={{ minWidth: 150 }}>
      <Select
        value={selected}
        onChange={(e: SelectChangeEvent) => onExpirationChange(e.target.value)}
        aria-label="Expiration"
        sx={{ fontWeight: 600 }}
      >
        {data.expirations.map((iso) => (
          <MenuItem key={iso} value={iso}>
            {fmtDate(iso)}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )

  const sideContracts = side === 'call' ? data.calls : data.puts

  return (
    <Stack spacing={2}>
      {/* The flow hero: call vs put volume, the volume bar, and the put/call +
          net-premium lean — the day's directional read at a glance. */}
      <Card variant="outlined" sx={{ borderColor: 'divider' }}>
        <CardContent
          sx={{
            p: { xs: 2, sm: 2.5 },
            '&:last-child': { pb: { xs: 2, sm: 2.5 } },
          }}
        >
          <SectionHeading
            component="h2"
            icon={<CandlestickChartIcon fontSize="small" />}
            title="Options flow"
            subtitle="The calls and puts coming in — today's volume and the money behind it."
            action={expirySelect}
          />

          <Stack
            direction="row"
            spacing={2}
            sx={{
              mt: 2,
              justifyContent: 'space-between',
              alignItems: 'baseline',
            }}
          >
            <SideFigure
              label="Calls"
              volume={s.call_volume}
              premium={s.call_premium}
              color={CALL_COLOR}
              align="left"
            />
            <SideFigure
              label="Puts"
              volume={s.put_volume}
              premium={s.put_premium}
              color={PUT_COLOR}
              align="right"
            />
          </Stack>

          <Box sx={{ mt: 1.5 }}>
            <VolumeBar callVol={s.call_volume} putVol={s.put_volume} />
          </Box>

          <Stack
            direction="row"
            spacing={2}
            sx={{
              mt: 1.5,
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              rowGap: 0.5,
            }}
          >
            <Typography variant="caption" color="text.secondary">
              Put/call{' '}
              <Box
                component="span"
                sx={{ fontWeight: 700, color: 'text.primary' }}
              >
                {s.put_call_volume_ratio == null
                  ? '—'
                  : s.put_call_volume_ratio.toFixed(2)}
              </Box>{' '}
              by volume · {fmtInt(s.total_volume)} contracts
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Net{' '}
              <Box
                component="span"
                sx={{
                  fontWeight: 700,
                  color: net >= 0 ? CALL_COLOR : PUT_COLOR,
                }}
              >
                {net >= 0 ? '+' : '−'}
                {fmtMoney(Math.abs(net))}
              </Box>{' '}
              into {net >= 0 ? 'calls' : 'puts'}
            </Typography>
          </Stack>

          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mt: 1.75, display: 'block' }}
          >
            {data.spot != null ? `Spot ${fmtPrice(data.spot)} · ` : ''}
            Expiry {fmtDate(data.expiration)}. A snapshot of today's volume and
            prior-day open interest — not a trade-by-trade tape, and not advice.
          </Typography>
        </CardContent>
      </Card>

      {/* Unusual activity: contracts trading above their open interest (fresh
          positioning), most money first. Self-hides when nothing stands out. */}
      {data.unusual.length > 0 && (
        <Card variant="outlined" sx={{ borderColor: 'divider' }}>
          <CardContent
            sx={{
              p: { xs: 2, sm: 2.5 },
              '&:last-child': { pb: { xs: 2, sm: 2.5 } },
            }}
          >
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}
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
                Unusual activity
              </Typography>
              <Chip
                size="small"
                label={`${data.unusual.length}`}
                sx={{ height: 20 }}
              />
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Contracts trading above their open interest — more bought today
              than were outstanding.
            </Typography>
            <Stack spacing={1.25} sx={{ mt: 1.75 }}>
              {data.unusual.map((c) => (
                <UnusualRow key={`${c.type}-${c.strike}`} c={c} />
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* The chain itself: a Calls/Puts toggle over the strike ladder. */}
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
              Chain
            </Typography>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={side}
              onChange={(_, v: OptionContractType | null) => v && setSide(v)}
              aria-label="Chain side"
            >
              <ToggleButton value="call">Calls</ToggleButton>
              <ToggleButton value="put">Puts</ToggleButton>
            </ToggleButtonGroup>
          </Stack>
          <ChainTable
            contracts={sideContracts}
            color={side === 'call' ? CALL_COLOR : PUT_COLOR}
          />
        </CardContent>
      </Card>
    </Stack>
  )
}
