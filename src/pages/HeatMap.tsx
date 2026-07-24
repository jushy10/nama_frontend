import { useMemo, useState } from 'react'
import {
  Alert,
  Box,
  CircularProgress,
  Container,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
} from '@mui/material'
import {
  heatMapReturn,
  SECTOR_WINDOWS,
  type SectorWindow,
  type StockIndex,
} from '@/lib/api'
import GridViewOutlined from '@mui/icons-material/GridViewOutlined'
import { errorMessage, useHeatMap } from '@/hooks/queries'
import { dedupeShareClasses } from '@/lib/heatmap'
import { usePageMeta } from '@/hooks/usePageMeta'
import HeatMapChart, { HeatMapLegend } from '@/components/HeatMap'
import PageHero from '@/components/PageHero'

const SCOPES: { value: StockIndex; label: string }[] = [
  { value: 'sp500', label: 'S&P 500' },
  { value: 'nasdaq100', label: 'Nasdaq 100' },
]

export default function HeatMapPage() {
  usePageMeta(
    'Stock Market Heat Map — S&P 500 & Nasdaq-100 | Nama Insights',
    'A live market heat map of the S&P 500 and Nasdaq-100 — every stock sized by market cap and colored by its move for the day.',
  )

  const [scope, setScope] = useState<StockIndex>('sp500')
  // The timeframe the board colours by. `1d` is the live day move; the rest read the
  // trailing performance windows the backend attaches to each tile.
  const [timeframe, setTimeframe] = useState<SectorWindow>('1d')
  const query = useHeatMap(scope)
  // On touch there's no hover tooltip, and a tap opens a detail sheet rather than
  // navigating — so the instruction differs from the desktop click-through.
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down('sm'))

  // Collapse multi-class shares (GOOGL/GOOG, …) to one tile per company so nothing
  // is double-counted — feeds both the treemap and the up/down tally below.
  const board = useMemo(
    () => (query.data ? dedupeShareClasses(query.data) : undefined),
    [query.data],
  )

  // Up/down tally across every tile for the selected timeframe, for the summary line.
  const tally = useMemo(() => {
    let up = 0
    let down = 0
    for (const sector of board?.sectors ?? []) {
      for (const industry of sector.industries) {
        for (const s of industry.stocks) {
          const value = heatMapReturn(s, timeframe)
          if (value == null) continue
          if (value >= 0) up += 1
          else down += 1
        }
      }
    }
    return { up, down }
  }, [board, timeframe])

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 3, sm: 5 } }}>
      <PageHero
        eyebrowIcon={GridViewOutlined}
        eyebrow="Market heat map"
        title="The market at a glance"
        subtitle={
          <>
            Every stock is a tile, sized by market cap and coloured by its move
            over the timeframe you pick, grouped by sector and industry.{' '}
            {isMobile ? 'Tap a tile for details.' : 'Click a tile to open it.'}
          </>
        }
      />

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{
          mt: 3,
          alignItems: { sm: 'center' },
          justifyContent: 'space-between',
        }}
      >
        <ToggleButtonGroup
          size="small"
          exclusive
          value={scope}
          onChange={(_, v: StockIndex | null) => v && setScope(v)}
          aria-label="Index"
        >
          {SCOPES.map((s) => (
            <ToggleButton key={s.value} value={s.value} sx={{ px: 2 }}>
              {s.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        {query.isSuccess && (
          <Stack
            direction="row"
            spacing={2}
            sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}
          >
            <Typography variant="body2" color="text.secondary">
              <Box
                component="span"
                sx={{ color: 'success.main', fontWeight: 600 }}
              >
                {tally.up} up
              </Box>{' '}
              ·{' '}
              <Box
                component="span"
                sx={{ color: 'error.main', fontWeight: 600 }}
              >
                {tally.down} down
              </Box>{' '}
              · {board?.count ?? 0} stocks
            </Typography>
            <HeatMapLegend window={timeframe} />
          </Stack>
        )}
      </Stack>

      {/* Timeframe selector — recolours the whole board (and the up/down tally + legend)
          to each stock's return over the chosen window. */}
      <Box sx={{ mt: 3 }}>
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Timeframe
        </Typography>
        <Box sx={{ mt: 0.5 }}>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={timeframe}
            onChange={(_, v: SectorWindow | null) => v && setTimeframe(v)}
            aria-label="Heat map timeframe"
            // rowGap so wrapped pills read as a second row rather than fusing to the row
            // above; taller hit area on phones.
            sx={{ flexWrap: 'wrap', rowGap: 0.5 }}
          >
            {SECTOR_WINDOWS.map((w) => (
              <ToggleButton
                key={w.key}
                value={w.key}
                sx={{ px: 2, py: { xs: 0.75 } }}
              >
                {w.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
      </Box>

      <Box sx={{ mt: 3 }}>
        {query.isLoading && (
          <Stack sx={{ alignItems: 'center', py: 8 }}>
            <CircularProgress />
          </Stack>
        )}
        {query.isError && (
          <Alert severity="error" variant="outlined">
            {errorMessage(query.error)}
          </Alert>
        )}
        {query.isSuccess &&
          board &&
          (board.count === 0 ? (
            <Alert severity="info" variant="outlined">
              No stocks to map yet — the universe is still being populated.
            </Alert>
          ) : (
            <Box
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                overflow: 'hidden',
                bgcolor: 'background.paper',
              }}
            >
              <HeatMapChart data={board} window={timeframe} />
            </Box>
          ))}
      </Box>
    </Container>
  )
}
