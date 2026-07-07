import {
  Alert,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material'
import { errorMessage, useEtfDetail } from '@/lib/queries'
import EtfCard from '@/components/EtfCard'
import FundReturnsCard from '@/components/FundReturnsCard'
import TopHoldingsCard from '@/components/TopHoldingsCard'
import SectorWeightingsCard from '@/components/SectorWeightingsCard'
import EtfBenchmarkCard from '@/components/EtfBenchmarkCard'

/**
 * The fund detail view — the ETF snapshot card, its YTD/3Y/5Y returns and an
 * "About" blurb, the top-holdings and sector-weighting breakdowns, and the
 * performance-vs-S&P 500 comparison chart. Rendered by the Search page once a
 * ticker resolves to an ETF; it fetches the fund's full detail (holdings and
 * sector weights aren't on the ticker card). Funds don't carry a standalone
 * candlestick chart — the rebased benchmark overlay is the fund's price view.
 */
export default function EtfDetail({ symbol }: { symbol: string }) {
  const etfQuery = useEtfDetail(symbol)
  const etf = etfQuery.data

  return (
    <Box>
      {etfQuery.isLoading && (
        <Stack sx={{ alignItems: 'center', py: 2 }}>
          <CircularProgress />
        </Stack>
      )}
      {etfQuery.isError && (
        <Alert severity="error" variant="outlined">
          {errorMessage(etfQuery.error)}
        </Alert>
      )}
      {etf && (
        <Stack spacing={3}>
          {/* Snapshot beside the returns + about stack on desktop; stacks on
              mobile. The snapshot card stretches to match this column. */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' },
              gap: 3,
              alignItems: 'stretch',
            }}
          >
            <EtfCard etf={etf} />

            <Stack spacing={3}>
              <FundReturnsCard etf={etf} />
              {etf.description && (
                <Card variant="outlined" sx={{ borderColor: 'divider' }}>
                  <CardContent sx={{ p: 3 }}>
                    <Typography
                      variant="h6"
                      component="h2"
                      sx={{ fontWeight: 600, mb: 1 }}
                    >
                      About
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ lineHeight: 1.6 }}
                    >
                      {etf.description}
                    </Typography>
                  </CardContent>
                </Card>
              )}
            </Stack>
          </Box>

          {/* Holdings + sector mix share a row on desktop; each self-hides when
              its breakdown is missing, so auto-fit lets whichever remains take
              the full width. */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(min(360px, 100%), 1fr))',
              gap: 3,
              alignItems: 'stretch',
            }}
          >
            <TopHoldingsCard holdings={etf.top_holdings} />
            <SectorWeightingsCard weightings={etf.sector_weightings} />
          </Box>

          {/* How the fund has tracked the S&P 500 over a chosen range — the
              rebased overlay plus the out/under-performance gap. This is the
              fund's price view; funds skip the standalone candlestick chart. */}
          <EtfBenchmarkCard symbol={etf.ticker} />
        </Stack>
      )}
    </Box>
  )
}
