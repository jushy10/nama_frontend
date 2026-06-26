import MarketIndices from '@/components/MarketIndices'
import Screener from '@/components/Screener'

/** Home dashboard: the day's index strip followed by the movers screener. */
function Home() {
  return (
    <>
      <MarketIndices />
      <Screener />
    </>
  )
}

export default Home
