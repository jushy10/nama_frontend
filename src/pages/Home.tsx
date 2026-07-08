import MarketIndices from '@/components/MarketIndices'
import SectorPulse from '@/components/SectorPulse'

/**
 * Home dashboard: the day's index strip, then the AI sector-pulse read (which
 * sectors are leading/lagging today).
 */
function Home() {
  return (
    <>
      <MarketIndices />
      <SectorPulse />
    </>
  )
}

export default Home
