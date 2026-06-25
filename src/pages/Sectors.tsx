import { useEffect, useMemo, useState } from 'react'
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
  ApiError,
  getSectors,
  sectorReturn,
  SECTOR_WINDOWS,
  type Sector,
  type SectorWindow,
} from '@/lib/api'
import SectorCard from '@/components/SectorCard'
import SectorStocksDialog from '@/components/SectorStocksDialog'

type Status =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'success'; sectors: Sector[] }

type Window = SectorWindow

export default function Sectors() {
  const [status, setStatus] = useState<Status>({ state: 'loading' })
  const [timeframe, setTimeframe] = useState<Window>('ytd')
  // The sector whose holdings drill-down is open (null = closed).
  const [selected, setSelected] = useState<Sector | null>(null)
  // Bumping this re-runs the fetch effect — drives the refresh button.
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    const ac = new AbortController()
    setStatus({ state: 'loading' })
    getSectors(ac.signal)
      .then((sectors) => setStatus({ state: 'success', sectors }))
      .catch((err) => {
        if (ac.signal.aborted) return
        const message =
          err instanceof ApiError
            ? err.message
            : 'Could not reach the server. Please try again.'
        setStatus({ state: 'error', message })
      })
    return () => ac.abort()
  }, [nonce])

  const tf =
    SECTOR_WINDOWS.find((w) => w.key === timeframe) ?? SECTOR_WINDOWS[0]

  // Sort by the selected window, best first; missing values sink to the bottom.
  const sectors = useMemo(() => {
    if (status.state !== 'success') return []
    return [...status.sectors].sort((a, b) => {
      const av = sectorReturn(a, timeframe) ?? -Infinity
      const bv = sectorReturn(b, timeframe) ?? -Infinity
      return bv - av
    })
  }, [status, timeframe])

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
        {status.state === 'success' && (
          <Tooltip title="Refresh">
            <IconButton
              onClick={() => setNonce((n) => n + 1)}
              aria-label="Refresh sectors"
              sx={{ color: 'text.secondary' }}
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        )}
      </Stack>

      {status.state === 'success' && (
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
        {status.state === 'loading' && (
          <Stack sx={{ alignItems: 'center', py: 6 }}>
            <CircularProgress />
          </Stack>
        )}
        {status.state === 'error' && (
          <Alert severity="error" variant="outlined">
            {status.message}
          </Alert>
        )}
        {status.state === 'success' && (
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
