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
import CategoryOutlined from '@mui/icons-material/CategoryOutlined'
import {
  sectorReturn,
  SECTOR_WINDOWS,
  type Sector,
  type SectorWindow,
} from '@/lib/api'
import { errorMessage, useSectors } from '@/hooks/queries'
import { usePageMeta } from '@/hooks/usePageMeta'
import SectorCard from '@/components/SectorCard'
import SectorStocksDialog from '@/components/SectorStocksDialog'
import PageHero from '@/components/PageHero'

type Window = SectorWindow

export default function Sectors() {
  usePageMeta(
    'Stock Market Sectors — Performance & Valuation | Nama Insights',
    'Explore the US stock market by sector: performance across time windows, valuation and the companies driving each sector.',
  )

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
    <Container maxWidth="xl" sx={{ py: { xs: 3, sm: 5 } }}>
      <PageHero
        eyebrowIcon={CategoryOutlined}
        eyebrow="Market sectors"
        title="How the 11 S&P sectors are moving"
        subtitle="Today's leaders and laggards across the S&P 500 sectors. Pick a timeframe, or open a sector to see its top holdings."
        action={
          sectorsQuery.isSuccess ? (
            <Tooltip title="Refresh">
              <IconButton
                onClick={() => sectorsQuery.refetch()}
                aria-label="Refresh sectors"
                sx={{ color: 'text.secondary' }}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          ) : undefined
        }
      />

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
            // rowGap so wrapped buttons read as a second row of pills rather
            // than fusing to the row above; taller hit area on phones.
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
              // One card per row on phones; two-up from the sm tablet width and
              // three-up from lg. A long sector name ("Communication Services")
              // may wrap to a second line in the half-width card, which reads
              // fine — far better than a lone full-width card stranding a tablet.
              // minmax(0,·) lets a card shrink below its content's intrinsic width.
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, minmax(0, 1fr))',
                lg: 'repeat(3, minmax(0, 1fr))',
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
