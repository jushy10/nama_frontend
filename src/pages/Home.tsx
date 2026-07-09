import { Box, Container } from '@mui/material'
import MarketIndices from '@/components/MarketIndices'
import MarketSummary from '@/components/MarketSummary'
import MegaCapGrowthLeaders from '@/components/MegaCapGrowthLeaders'
import SectorPulse from '@/components/SectorPulse'
import { useMarketSummary, useSectorAnalysis } from '@/lib/queries'

/**
 * Home dashboard: the AI market summary and the sector-pulse read shown side by
 * side (they stack on narrow screens), then the day's index strip.
 *
 * Both reads are best-effort. Each card is gated on its own query, so if one
 * model read fails the survivor flexes to the full width; the shared band drops
 * out only when both are gone. (The hooks are also called inside each card —
 * React Query dedupes by key, so this reads the same cached result, not a second
 * fetch.)
 */
function Home() {
  const marketFailed = useMarketSummary().isError
  const sectorFailed = useSectorAnalysis().isError

  return (
    <>
      {(!marketFailed || !sectorFailed) && (
        <Box sx={{ borderTop: 1, borderColor: 'divider' }}>
          <Container maxWidth="lg" sx={{ py: { xs: 4, sm: 6 } }}>
            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                alignItems: { xs: 'stretch', md: 'flex-start' },
                gap: { xs: 4, md: 3 },
              }}
            >
              {!marketFailed && (
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <MarketSummary />
                </Box>
              )}
              {!sectorFailed && (
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <SectorPulse />
                </Box>
              )}
            </Box>
          </Container>
        </Box>
      )}
      <MegaCapGrowthLeaders />
      <MarketIndices />
    </>
  )
}

export default Home
