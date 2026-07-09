import MarketIndices from '@/components/MarketIndices'
import MarketSummary from '@/components/MarketSummary'
import SectorPulse from '@/components/SectorPulse'

/**
 * Home dashboard: the AI market summary (how the US market has moved over the
 * past year/month/week) up top, then the sector-pulse read (which sectors are
 * leading/lagging today), then the day's index strip.
 */
function Home() {
  return (
    <>
      <MarketSummary />
      <SectorPulse />
      <MarketIndices />
    </>
  )
}

export default Home
