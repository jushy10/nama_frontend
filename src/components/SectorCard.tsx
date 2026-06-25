import type { KeyboardEvent, ReactNode } from 'react'
import {
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
} from '@mui/material'
import MemoryIcon from '@mui/icons-material/Memory'
import AccountBalanceIcon from '@mui/icons-material/AccountBalance'
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart'
import BoltIcon from '@mui/icons-material/Bolt'
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag'
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart'
import FactoryIcon from '@mui/icons-material/Factory'
import ScienceIcon from '@mui/icons-material/Science'
import PowerIcon from '@mui/icons-material/Power'
import ApartmentIcon from '@mui/icons-material/Apartment'
import CellTowerIcon from '@mui/icons-material/CellTower'
import CategoryIcon from '@mui/icons-material/Category'
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { sectorReturn, type Sector, type SectorWindow } from '@/lib/api'

/** Icon per sector, keyed by the API's sector name. Falls back to a generic. */
const SECTOR_ICONS: Record<string, ReactNode> = {
  Technology: <MemoryIcon />,
  Financials: <AccountBalanceIcon />,
  'Health Care': <MonitorHeartIcon />,
  Energy: <BoltIcon />,
  'Consumer Discretionary': <ShoppingBagIcon />,
  'Consumer Staples': <ShoppingCartIcon />,
  Industrials: <FactoryIcon />,
  Materials: <ScienceIcon />,
  Utilities: <PowerIcon />,
  'Real Estate': <ApartmentIcon />,
  'Communication Services': <CellTowerIcon />,
}

const fmt = (n: number | null) =>
  n == null
    ? '—'
    : n.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })

/** Signed percent, e.g. +1.84% / -0.64%. */
const fmtPct = (n: number | null) =>
  n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`

const moveColor = (n: number | null | undefined) =>
  n == null ? 'text.secondary' : n >= 0 ? 'success.main' : 'error.main'

export default function SectorCard({
  sector,
  timeframe,
  onSelect,
}: {
  sector: Sector
  timeframe: { key: SectorWindow; label: string }
  onSelect?: () => void
}) {
  const dayUp = (sector.change_percent ?? 0) >= 0
  // Gain for just the selected window — 1D is the day's move, the rest trailing.
  const selected = sectorReturn(sector, timeframe.key)

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect?.()
    }
  }

  return (
    <Card
      variant="outlined"
      role="button"
      tabIndex={0}
      aria-label={`View top holdings in ${sector.sector}`}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      sx={{
        height: '100%',
        cursor: 'pointer',
        borderColor: 'divider',
        transition: 'border-color 150ms',
        '&:hover': { borderColor: 'rgba(99,102,241,0.4)' },
        '&:focus-visible': {
          outline: '2px solid',
          outlineColor: 'primary.main',
          outlineOffset: 2,
        },
      }}
    >
      <CardContent
        sx={{
          p: 2.5,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {/* Header: icon + name/symbol, price + today's move */}
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}
        >
          <Stack
            direction="row"
            spacing={1.5}
            sx={{ alignItems: 'center', minWidth: 0 }}
          >
            <Avatar
              variant="rounded"
              sx={{
                width: 40,
                height: 40,
                bgcolor: 'rgba(99,102,241,0.12)',
                color: 'primary.light',
                flexShrink: 0,
              }}
            >
              {SECTOR_ICONS[sector.sector] ?? <CategoryIcon />}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="subtitle1"
                component="h3"
                sx={{ fontWeight: 600, lineHeight: 1.2 }}
              >
                {sector.sector}
              </Typography>
              <Chip
                label={sector.symbol}
                size="small"
                sx={{ mt: 0.5, height: 18, fontSize: '0.65rem' }}
              />
            </Box>
          </Stack>
          <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
            <Typography
              variant="h6"
              sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
            >
              ${fmt(sector.price)}
            </Typography>
            <Stack
              direction="row"
              sx={{
                alignItems: 'center',
                justifyContent: 'flex-end',
                color: moveColor(sector.change_percent),
              }}
            >
              {dayUp ? (
                <ArrowDropUpIcon fontSize="small" />
              ) : (
                <ArrowDropDownIcon fontSize="small" />
              )}
              <Typography
                variant="body2"
                sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
              >
                {fmtPct(sector.change_percent)}
              </Typography>
            </Stack>
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', display: 'block' }}
            >
              today
            </Typography>
          </Box>
        </Stack>

        {/* Hero: the selected timeframe's return — the only window shown */}
        <Box
          sx={{
            borderRadius: 2,
            bgcolor: 'rgba(99,102,241,0.08)',
            border: 1,
            borderColor: 'rgba(99,102,241,0.25)',
            px: 2,
            py: 1.5,
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {timeframe.label} return
          </Typography>
          <Typography
            sx={{
              fontWeight: 700,
              fontSize: '1.6rem',
              lineHeight: 1.1,
              color: moveColor(selected),
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {fmtPct(selected)}
          </Typography>
        </Box>

        {/* Click affordance for the holdings drill-down */}
        <Stack
          direction="row"
          sx={{
            mt: 'auto',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: 'primary.light',
          }}
        >
          <Typography
            variant="caption"
            sx={{
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Top holdings
          </Typography>
          <ChevronRightIcon fontSize="small" />
        </Stack>
      </CardContent>
    </Card>
  )
}
