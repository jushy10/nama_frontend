import MarketIndices from '@/components/MarketIndices'
import SectorPulse from '@/components/SectorPulse'

/**
 * Home dashboard: the AI sector-pulse read (which sectors are leading/lagging
 * today) up top, then the day's index strip.
 */
function Home() {
  return (
    <>
      <SectorPulse />
      <MarketIndices />
    </>
  )
}

export default Home
