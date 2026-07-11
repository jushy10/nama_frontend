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
import type { StockIndex } from '@/lib/api'
import { errorMessage, useHeatMap } from '@/lib/queries'
import { dedupeShareClasses } from '@/lib/heatmap'
import HeatMapChart, { HeatMapLegend } from '@/components/HeatMap'

const SCOPES: { value: StockIndex; label: string }[] = [
  { value: 'sp500', label: 'S&P 500' },
  { value: 'nasdaq100', label: 'Nasdaq 100' },
]

export default function HeatMapPage() {
  const [scope, setScope] = useState<StockIndex>('sp500')
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

  // Up/down tally across every tile, for the summary line.
  const tally = useMemo(() => {
    let up = 0
    let down = 0
    for (const sector of board?.sectors ?? []) {
      for (const industry of sector.industries) {
        for (const s of industry.stocks) {
          if (s.change_percent == null) continue
          if (s.change_percent >= 0) up += 1
          else down += 1
        }
      }
    }
    return { up, down }
  }, [board])

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 4, sm: 6 } }}>
      <Box>
        <Typography
          variant="h4"
          component="h1"
          sx={{ color: 'primary.light', fontWeight: 700 }}
        >
          Market Heat Map
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          Every stock a tile — sized by market cap, coloured by today&apos;s
          price move — grouped by sector and industry.{' '}
          {isMobile ? 'Tap a tile for details.' : 'Click a tile to open it.'}
        </Typography>
      </Box>

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
            <HeatMapLegend />
          </Stack>
        )}
      </Stack>

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
              <HeatMapChart data={board} />
            </Box>
          ))}
      </Box>
    </Container>
  )
}
