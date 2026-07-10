import { Box, Container } from '@mui/material'
import HomeHero from '@/components/HomeHero'
import MarketIndices from '@/components/MarketIndices'
import MarketSummary from '@/components/MarketSummary'
import MegaCapGrowthLeaders from '@/components/MegaCapGrowthLeaders'
import SectorPulse from '@/components/SectorPulse'
import { useMarketSummary, useSectorAnalysis } from '@/lib/queries'

/**
 * Home dashboard, read top to bottom as one story: a hero intro, then the day's
 * live index moves (what's happening now), the AI market + sector reads (what it
 * means), and finally the mega-cap growth leaders (where to look). Every band
 * shares the same `xl` width and vertical rhythm so the page reads as one system
 * — the same width as the app bar and the rest of the app — and each stacks
 * cleanly on phones.
 *
 * The two AI reads are best-effort and side by side. Each is gated on its own
 * query, so if one model read fails the survivor flexes to the full width; the
 * shared band drops out only when both are gone. (The hooks are also called
 * inside each card — React Query dedupes by key, so this reads the same cached
 * result, not a second fetch.)
 */
function Home() {
  const marketFailed = useMarketSummary().isError
  const sectorFailed = useSectorAnalysis().isError

  return (
    <>
      <HomeHero />

      <MarketIndices />

      {(!marketFailed || !sectorFailed) && (
        <Box sx={{ borderTop: 1, borderColor: 'divider' }}>
          <Container maxWidth="xl" sx={{ py: { xs: 4, sm: 6 } }}>
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
    </>
  )
}

export default Home
