import { useState } from 'react'
import {
  Alert,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material'
import {
  quarterlyToEarningsHistory,
  quarterlyUpcoming,
  type ChartRange,
  type TickerCard,
} from '@/lib/api'
import {
  errorMessage,
  useAnnualEarnings,
  useCandles,
  useFiveYearReturn,
  useQuarterlyEarnings,
  useRecommendations,
} from '@/lib/queries'
import StockCard from '@/components/StockCard'
import PerformanceCard from '@/components/PerformanceCard'
import ProfitabilityCard from '@/components/ProfitabilityCard'
import PegCard from '@/components/PegCard'
import OptionsCard from '@/components/OptionsCard'
import CandleChart from '@/components/CandleChart'
import ChartRangeToggle from '@/components/ChartRangeToggle'
import RangeReturn from '@/components/RangeReturn'
import AnalystCard from '@/components/AnalystCard'
import EarningsCard from '@/components/EarningsCard'
import ForwardPeCard from '@/components/ForwardPeCard'

/**
 * The stock detail view — the snapshot card plus the performance/profitability/
 * PEG/options reads, analyst ratings, the price chart, and the earnings +
 * forward-P/E row. Rendered by the Search page once a ticker resolves to an
 * equity; the caller passes the already-loaded ticker card (which carries the
 * dividend/performance/metrics/options blocks), and the chart, 5Y pill, ratings,
 * and earnings ride the loaded ticker.
 */
export default function StockDetail({ stock }: { stock: TickerCard }) {
  const [range, setRange] = useState<ChartRange>('6M')
  const symbol = stock.ticker
  const candleQuery = useCandles(symbol, range)
  const fiveYearReturn = useFiveYearReturn(symbol)
  const recommendationsQuery = useRecommendations(symbol)
  // The earnings card runs entirely off the consolidated quarterly endpoint;
  // the profitability and PEG reads ride on the ticker card's `metrics` block.
  const quarterlyQuery = useQuarterlyEarnings(symbol)
  // The yearly series behind the card's Quarterly/Annual toggle. Best-effort:
  // if it fails the toggle simply doesn't appear, so no error state is shown.
  const annualQuery = useAnnualEarnings(symbol)

  return (
    <Stack spacing={3}>
      {/* Snapshot rides beside the Performance + Profitability stack on
          desktop (md+) and stacks on mobile; the price chart below keeps
          the full page width. The snapshot card stretches to match this
          column's height, so keeping the column filled matters. */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: 3,
          alignItems: 'stretch',
        }}
      >
        <StockCard stock={stock} />

        {/* Performance sits above Profitability in the right-hand column:
            the trailing returns over the "is it making money?" read. Both
            ride the loaded snapshot (Profitability off its metrics block). */}
        <Stack spacing={3}>
          {stock.performance && (
            <PerformanceCard
              perf={stock.performance}
              fiveYearReturn={fiveYearReturn}
            />
          )}
          {stock.metrics && (
            <ProfitabilityCard
              netMargin={stock.metrics.net_margin}
              grossMargin={stock.metrics.gross_margin}
              operatingMargin={stock.metrics.operating_margin}
            />
          )}
        </Stack>
      </Box>

      {/* The growth-adjusted valuation read — "is the price fair for the
          growth?" — full width below the snapshot row, riding the card's
          metrics block. */}
      {stock.metrics && (
        <PegCard
          peg={stock.metrics.peg}
          forwardPeg={stock.metrics.forward_peg}
        />
      )}

      {/* Options-market read, riding the single snapshot request. A null
          block (no priceable options) simply hides the card. */}
      {stock.options_metrics && <OptionsCard metrics={stock.options_metrics} />}

      {recommendationsQuery.isLoading && (
        <Stack sx={{ alignItems: 'center', py: 2 }}>
          <CircularProgress size={28} />
        </Stack>
      )}
      {recommendationsQuery.isError && (
        <Alert severity="warning" variant="outlined">
          {errorMessage(
            recommendationsQuery.error,
            'Could not load analyst ratings.',
          )}
        </Alert>
      )}
      {recommendationsQuery.data && (
        <AnalystCard recommendations={recommendationsQuery.data} />
      )}

      <Card variant="outlined" sx={{ borderColor: 'divider' }}>
        <CardContent sx={{ p: 3 }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            sx={{
              justifyContent: 'space-between',
              alignItems: { sm: 'center' },
              mb: 2,
            }}
          >
            <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline' }}>
              <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
                Price chart
              </Typography>
              {candleQuery.data && (
                <RangeReturn candles={candleQuery.data.candles} />
              )}
            </Stack>
            <ChartRangeToggle value={range} onChange={setRange} />
          </Stack>

          {candleQuery.isLoading && (
            <Stack
              sx={{
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 280,
              }}
            >
              <CircularProgress />
            </Stack>
          )}
          {candleQuery.isError && (
            <Alert severity="warning" variant="outlined">
              {errorMessage(candleQuery.error, 'Could not load chart data.')}
            </Alert>
          )}
          {candleQuery.data && (
            <CandleChart
              candles={candleQuery.data.candles}
              timeframe={candleQuery.data.timeframe}
            />
          )}
        </CardContent>
      </Card>

      {/* Earnings and Forward P/E share one full-width row on desktop.
          auto-fit (rather than a fixed 1fr 1fr) lets whichever card is
          present take the whole row when the other is missing — the
          Forward P/E card self-hides without a forward consensus, and
          the earnings slot is empty while its query loads or errors. */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(min(480px, 100%), 1fr))',
          gap: 3,
          alignItems: 'stretch',
        }}
      >
        {quarterlyQuery.isLoading && (
          <Stack sx={{ alignItems: 'center', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={28} />
          </Stack>
        )}
        {quarterlyQuery.isError && (
          <Alert severity="warning" variant="outlined">
            {errorMessage(
              quarterlyQuery.error,
              'Could not load earnings data.',
            )}
          </Alert>
        )}
        {quarterlyQuery.data && (
          <EarningsCard
            earnings={quarterlyToEarningsHistory(quarterlyQuery.data)}
            upcoming={quarterlyUpcoming(quarterlyQuery.data)}
            annual={annualQuery.data ?? null}
            revenueGrowth={stock.metrics?.revenue_growth_yoy ?? null}
            epsGrowth={stock.metrics?.eps_growth_yoy ?? null}
          />
        )}

        {/* Forward P/E, walked from the last reported period across the
            two forecast years and the upcoming quarters. Self-hides until a
            forward consensus (annual estimates or upcoming quarters) is
            available. */}
        <ForwardPeCard
          price={stock.price}
          quarterly={quarterlyQuery.data ?? null}
          annual={annualQuery.data ?? null}
          trailingPe={stock.metrics?.pe ?? null}
        />
      </Box>
    </Stack>
  )
}
