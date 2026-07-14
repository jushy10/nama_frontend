import { Box, Container } from '@mui/material'
import HomeHero from '@/components/HomeHero'
import FeatureBento from '@/components/FeatureBento'
import TodaysBriefCard from '@/components/TodaysBriefCard'
import MarketIndices from '@/components/MarketIndices'
import MarketSummary from '@/components/MarketSummary'
import MegaCapGrowthLeaders from '@/components/MegaCapGrowthLeaders'
import SectorPulse from '@/components/SectorPulse'
import Reveal from '@/components/Reveal'
import { useMarketSummary, useSectorAnalysis } from '@/lib/queries'
import { usePageMeta } from '@/lib/usePageMeta'

/**
 * Home dashboard, read top to bottom as one story: a search-first hero that
 * states the pitch (an AI-driven stock screener), a bento grid of what the app
 * can do, then the day's live index moves (what's happening now), the AI market
 * + sector reads (what it means), and finally the mega-cap growth leaders (where
 * to look). Every band shares the same `xl` width and vertical rhythm so the
 * page reads as one system — the same width as the app bar and the rest of the
 * app — and each stacks cleanly on phones. Bands below the fold ease in on
 * scroll (see `Reveal`), a light cascade that respects reduced-motion.
 *
 * The two AI reads are best-effort and side by side. Each is gated on its own
 * query, so if one model read fails the survivor flexes to the full width; the
 * shared band drops out only when both are gone. (The hooks are also called
 * inside each card — React Query dedupes by key, so this reads the same cached
 * result, not a second fetch.)
 */
function Home() {
  usePageMeta(
    'Nama Insights — Free Stock & ETF Research with a Cash-Flow Focus',
    'Free research for US stocks and ETFs: live quotes, free-cash-flow metrics, earnings history, analyst coverage and AI analysis. No login, no paywall.',
  )
  const marketFailed = useMarketSummary().isError
  const sectorFailed = useSectorAnalysis().isError

  return (
    <>
      <HomeHero />

      <Reveal>
        <FeatureBento />
      </Reveal>

      <Reveal delay={80}>
        <TodaysBriefCard />
      </Reveal>

      <Reveal delay={80}>
        <MarketIndices />
      </Reveal>

      {(!marketFailed || !sectorFailed) && (
        <Reveal delay={80}>
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
        </Reveal>
      )}

      <Reveal delay={80}>
        <MegaCapGrowthLeaders />
      </Reveal>
    </>
  )
}

export default Home
