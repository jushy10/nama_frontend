import { useMemo, useState } from 'react'
import {
  Alert,
  Box,
  CircularProgress,
  Container,
  IconButton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import {
  sectorReturn,
  SECTOR_WINDOWS,
  type Sector,
  type SectorWindow,
} from '@/lib/api'
import { errorMessage, useSectors } from '@/lib/queries'
import SectorCard from '@/components/SectorCard'
import SectorStocksDialog from '@/components/SectorStocksDialog'

type Window = SectorWindow

export default function Sectors() {
  const sectorsQuery = useSectors()
  const [timeframe, setTimeframe] = useState<Window>('1d')
  // The sector whose holdings drill-down is open (null = closed).
  const [selected, setSelected] = useState<Sector | null>(null)

  const tf =
    SECTOR_WINDOWS.find((w) => w.key === timeframe) ?? SECTOR_WINDOWS[0]

  // Sort by the selected window, best first; missing values sink to the bottom.
  const sectors = useMemo(() => {
    const data = sectorsQuery.data
    if (!data) return []
    return [...data].sort((a, b) => {
      const av = sectorReturn(a, timeframe) ?? -Infinity
      const bv = sectorReturn(b, timeframe) ?? -Infinity
      return bv - av
    })
  }, [sectorsQuery.data, timeframe])

  // Day-move tally and the freshest "as of" stamp, for the summary line.
  const { up, down, asOf } = useMemo(() => {
    let up = 0
    let down = 0
    let asOf = 0
    for (const s of sectors) {
      if ((s.change_percent ?? 0) >= 0) up += 1
      else down += 1
      const t = s.as_of ? Date.parse(s.as_of) : 0
      if (t > asOf) asOf = t
    }
    return { up, down, asOf }
  }, [sectors])

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 4, sm: 6 } }}>
      <Stack
        direction="row"
        spacing={1}
        sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}
      >
        <Box>
          <Typography
            variant="h4"
            component="h1"
            sx={{ color: 'primary.light', fontWeight: 700 }}
          >
            Market Sectors
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            How the 11 S&amp;P sectors are moving today. Pick a timeframe, or
            open a sector to see its top holdings.
          </Typography>
        </Box>
        {sectorsQuery.isSuccess && (
          <Tooltip title="Refresh">
            <IconButton
              onClick={() => sectorsQuery.refetch()}
              aria-label="Refresh sectors"
              sx={{ color: 'text.secondary' }}
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        )}
      </Stack>

      {sectorsQuery.isSuccess && (
        <Stack
          direction="row"
          spacing={2}
          sx={{ mt: 2, flexWrap: 'wrap', color: 'text.secondary' }}
        >
          <Typography variant="body2">
            <Box
              component="span"
              sx={{ color: 'success.main', fontWeight: 600 }}
            >
              {up} up
            </Box>{' '}
            ·{' '}
            <Box component="span" sx={{ color: 'error.main', fontWeight: 600 }}>
              {down} down
            </Box>{' '}
            today
          </Typography>
          {asOf > 0 && (
            <Typography variant="body2">
              As of {new Date(asOf).toLocaleString()}
            </Typography>
          )}
        </Stack>
      )}

      {/* Timeframe selector — drives the hero number and the sort order. */}
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
            onChange={(_, value: Window | null) => value && setTimeframe(value)}
            aria-label="Performance timeframe"
            sx={{ flexWrap: 'wrap' }}
          >
            {SECTOR_WINDOWS.map((w) => (
              <ToggleButton key={w.key} value={w.key} sx={{ px: 2, py: 0.5 }}>
                {w.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
      </Box>

      <Box sx={{ mt: 4 }}>
        {sectorsQuery.isLoading && (
          <Stack sx={{ alignItems: 'center', py: 6 }}>
            <CircularProgress />
          </Stack>
        )}
        {sectorsQuery.isError && (
          <Alert severity="error" variant="outlined">
            {errorMessage(sectorsQuery.error)}
          </Alert>
        )}
        {sectorsQuery.isSuccess && (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, 1fr)',
                lg: 'repeat(3, 1fr)',
              },
              gap: 2,
            }}
          >
            {sectors.map((s) => (
              <SectorCard
                key={s.symbol}
                sector={s}
                timeframe={tf}
                onSelect={() => setSelected(s)}
              />
            ))}
          </Box>
        )}
      </Box>

      <SectorStocksDialog sector={selected} onClose={() => setSelected(null)} />
    </Container>
  )
}
