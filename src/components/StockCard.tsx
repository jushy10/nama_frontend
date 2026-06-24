import {
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
} from '@mui/material'
import { stockLogoUrl, type Stock } from '@/lib/api'

const fmt = (n: number | null) =>
  n == null
    ? '—'
    : n.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })

const fmtInt = (n: number | null) =>
  n == null ? '—' : n.toLocaleString('en-US')

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', px: 1.5, py: 1 }}>
      <Typography
        component="dt"
        variant="caption"
        sx={{
          color: 'text.secondary',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {label}
      </Typography>
      <Typography
        component="dd"
        sx={{ m: 0, mt: 0.25, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </Typography>
    </Box>
  )
}

export default function StockCard({ stock }: { stock: Stock }) {
  const up = (stock.change ?? 0) >= 0
  const changeColor = up ? 'success.main' : 'error.main'
  const sign = up ? '+' : ''
  const asOf = stock.as_of ? new Date(stock.as_of).toLocaleString() : '—'

  return (
    <Card variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.12)' }}>
      <CardContent sx={{ p: 3 }}>
        <Stack
          direction="row"
          spacing={2}
          sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}
        >
          <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
            <Avatar
              variant="rounded"
              src={stockLogoUrl(stock.symbol)}
              alt={`${stock.symbol} logo`}
              slotProps={{ img: { loading: 'lazy', style: { objectFit: 'contain' } } }}
              sx={{ width: 56, height: 56, bgcolor: '#fff', color: '#111', p: 0.75 }}
            >
              {stock.symbol.charAt(0)}
            </Avatar>
            <Box>
              <Typography variant="h5" component="h2" sx={{ fontWeight: 700 }}>
                {stock.symbol}
              </Typography>
              {stock.name && (
                <Typography variant="body2" color="text.secondary">
                  {stock.name}
                </Typography>
              )}
              {stock.exchange && (
                <Chip
                  label={stock.exchange}
                  size="small"
                  sx={{ mt: 0.5, height: 20, fontSize: '0.7rem' }}
                />
              )}
            </Box>
          </Stack>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="h4" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              ${fmt(stock.price)}
            </Typography>
            <Typography
              variant="body2"
              sx={{ fontWeight: 500, color: changeColor, fontVariantNumeric: 'tabular-nums' }}
            >
              {sign}
              {fmt(stock.change)} ({sign}
              {fmt(stock.change_percent)}%)
            </Typography>
          </Box>
        </Stack>

        <Box
          component="dl"
          sx={{
            mt: 3,
            mb: 0,
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
            gap: 1,
          }}
        >
          <Stat label="Open" value={fmt(stock.open)} />
          <Stat label="High" value={fmt(stock.high)} />
          <Stat label="Low" value={fmt(stock.low)} />
          <Stat label="Prev Close" value={fmt(stock.previous_close)} />
          <Stat label="Bid" value={fmt(stock.bid)} />
          <Stat label="Ask" value={fmt(stock.ask)} />
          <Stat label="Spread" value={fmt(stock.spread)} />
          <Stat label="Volume" value={fmtInt(stock.volume)} />
        </Box>

        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', mt: 2, textAlign: 'right' }}
        >
          As of {asOf}
        </Typography>
      </CardContent>
    </Card>
  )
}
