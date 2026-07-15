import { Box, Container } from '@mui/material'
import HomeHero from '@/components/HomeHero'
import FeatureBento from '@/components/FeatureBento'
import TodaysBriefCard from '@/components/TodaysBriefCard'
import MarketIndices from '@/components/MarketIndices'
import MarketSentiment from '@/components/MarketSentiment'
import MarketSummary from '@/components/MarketSummary'
import MegaCapGrowthLeaders from '@/components/MegaCapGrowthLeaders'
import SectorPulse from '@/components/SectorPulse'
import Reveal from '@/components/Reveal'
import { useMarketSummary, useSectorAnalysis } from '@/lib/queries'
import { usePageMeta } from '@/lib/usePageMeta'

/**
 * Home dashboard, read top to bottom as one story that leads with the market,
 * not the marketing. A split search-first hero states the pitch and carries a
 * live "market at a glance" snapshot (indices + sentiment) beside the search, so
 * a visitor sees how the market is doing without scrolling. Below it the fuller
 * live reads — the index chart (what's happening now) and the sentiment gauges
 * (how it feels) — then the AI reads (what it means): the day's brief, the market
 * summary and the sector pulse. Then the mega-cap growth leaders (where to look),
 * and finally the feature grid (explore the app), demoted to the foot of the page
 * now that the data leads it. Every band shares the same `xl` width and a slim
 * vertical rhythm so the page reads as one tight system; bands below the fold ease
 * in on scroll (see `Reveal`), a light cascade that respects reduced-motion.
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
        <MarketIndices />
      </Reveal>

      <Reveal delay={80}>
        <Box sx={{ borderTop: 1, borderColor: 'divider' }}>
          <Container maxWidth="xl" sx={{ py: { xs: 4, sm: 5, md: 6 } }}>
            <MarketSentiment />
          </Container>
        </Box>
      </Reveal>

      <Reveal delay={80}>
        <TodaysBriefCard />
      </Reveal>

      {(!marketFailed || !sectorFailed) && (
        <Reveal delay={80}>
          <Box sx={{ borderTop: 1, borderColor: 'divider' }}>
            <Container maxWidth="xl" sx={{ py: { xs: 4, sm: 5, md: 6 } }}>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column', md: 'row' },
                  alignItems: { xs: 'stretch', md: 'flex-start' },
                  gap: { xs: 5, md: 4 },
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

      <Reveal delay={80}>
        <FeatureBento />
      </Reveal>
    </>
  )
}

export default Home
