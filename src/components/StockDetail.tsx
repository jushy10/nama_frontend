import { useState } from 'react'
import {
  Alert,
  Box,
  Card,
  CardContent,
  CircularProgress,
  FormControlLabel,
  Stack,
  Switch,
  Tab,
  Tabs,
  Typography,
} from '@mui/material'
import {
  quarterlyToEarningsHistory,
  quarterlyUpcoming,
  type ChartRange,
  type TickerCardInclude,
} from '@/lib/api'
import {
  errorMessage,
  useAnnualEarnings,
  useCandles,
  useFiveYearReturn,
  useIndustryValuation,
  useQuarterlyEarnings,
  useRecommendations,
  useStockAnalysis,
  useSupportLevels,
  useTickerCard,
} from '@/lib/queries'
import AnalysisCard from '@/components/AnalysisCard'
import StockCard from '@/components/StockCard'
import PerformanceCard from '@/components/PerformanceCard'
import ProfitabilityCard from '@/components/ProfitabilityCard'
import PegCard from '@/components/PegCard'
import IndustryPeCard from '@/components/IndustryPeCard'
import OptionsCard from '@/components/OptionsCard'
import CandleChart from '@/components/CandleChart'
import ChartRangeToggle from '@/components/ChartRangeToggle'
import RangeReturn from '@/components/RangeReturn'
import AnalystCard from '@/components/AnalystCard'
import EarningsCard from '@/components/EarningsCard'

// The card carries everything the stock detail draws off in one request: the
// snapshot's dividend, the performance windows, the metrics (profitability +
// PEG), and the options read.
const SNAPSHOT_BLOCKS: TickerCardInclude[] = [
  'dividend',
  'performance',
  'metrics',
  'options_metrics',
]

// A small tab menu splits the detail into focused sections so it isn't one long
// scroll: Overview (snapshot, performance, the AI take and price chart),
// Valuation (profitability + the PEG and industry-P/E reads), Analysts (the
// sell-side ratings), Earnings, and Options.
type StockDetailTab =
  | 'overview'
  | 'valuation'
  | 'analysts'
  | 'earnings'
  | 'options'

/**
 * The stock detail view — the snapshot card plus the performance/profitability/
 * PEG/options reads, analyst ratings, the price chart, and the earnings +
 * forward-P/E row. The Search page hands it a symbol once the classifier calls
 * the ticker an equity; it fetches that ticker's card (with every block) itself,
 * and the chart, 5Y pill, ratings, and earnings ride the loaded ticker.
 */
export default function StockDetail({ symbol }: { symbol: string }) {
  const [range, setRange] = useState<ChartRange>('6M')
  const [showSupport, setShowSupport] = useState(true)
  const [tab, setTab] = useState<StockDetailTab>('overview')
  const cardQuery = useTickerCard(symbol, SNAPSHOT_BLOCKS)
  const stock = cardQuery.data
  // The chart, 5Y pill, ratings, and earnings ride the *loaded* ticker, so they
  // only fire once the card resolves — a bad symbol never kicks off more doomed
  // requests. The earnings card runs off the consolidated quarterly endpoint;
  // the profitability and PEG reads ride on the card's `metrics` block, and the
  // annual series (best-effort) backs the card's Quarterly/Annual toggle.
  const loadedSymbol = stock?.ticker ?? null
  const candleQuery = useCandles(loadedSymbol, range)
  // Support levels ride the loaded ticker, keyed by symbol only — a fixed 1Y
  // scan that doesn't refetch as the range changes; the chart draws just the
  // ones inside the visible price range.
  const supportQuery = useSupportLevels(loadedSymbol)
  const fiveYearReturn = useFiveYearReturn(loadedSymbol)
  const recommendationsQuery = useRecommendations(loadedSymbol)
  const quarterlyQuery = useQuarterlyEarnings(loadedSymbol)
  const annualQuery = useAnnualEarnings(loadedSymbol)
  // The AI take is the slowest read (a live model call), so it rides the loaded
  // ticker on its own and the card fills in once it lands.
  const analysisQuery = useStockAnalysis(loadedSymbol)
  // The industry P/E benchmark rides the loaded card's own industry slug (idle
  // until it resolves; never fires for an unclassified stock). Best-effort — it
  // self-hides if the industry has too few valued peers to stand as a
  // benchmark, so no loading/error UI.
  const industryValuationQuery = useIndustryValuation(stock?.industry ?? null)

  if (cardQuery.isLoading) {
    return (
      <Stack sx={{ alignItems: 'center', py: 2 }}>
        <CircularProgress />
      </Stack>
    )
  }
  if (cardQuery.isError) {
    return (
      <Alert severity="error" variant="outlined">
        {errorMessage(cardQuery.error)}
      </Alert>
    )
  }
  if (!stock) return null

  return (
    <>
      {/* A small tab menu keeps the detail from being one long scroll: Overview
          holds the essentials (snapshot, performance, the AI take and the price
          chart), Valuation gathers the analytical reads, Analysts the sell-side
          ratings, and Earnings and Options each get their own tab. Every query
          fires up top regardless of the active tab, so switching is instant and
          never refetches. Scrollable so the five labels never crowd a phone. */}
      <Tabs
        value={tab}
        onChange={(_, value: StockDetailTab) => setTab(value)}
        aria-label="Stock detail sections"
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab label="Overview" value="overview" />
        <Tab label="Valuation" value="valuation" />
        <Tab label="Analysts" value="analysts" />
        <Tab label="Earnings" value="earnings" />
        <Tab label="Options" value="options" />
      </Tabs>

      {tab === 'overview' && (
        <Stack spacing={3} role="tabpanel">
          {/* Identity, price and the key stats — what this is and where it
              trades — lead the tab, full width. */}
          <StockCard stock={stock} />

          {/* The trailing-return strip: a quick read on how it's performed,
              riding the loaded snapshot (5Y fills in a beat later). */}
          {stock.performance && (
            <PerformanceCard
              perf={stock.performance}
              fiveYearReturn={fiveYearReturn}
            />
          )}

          {/* The AI take — a plain-language buy/hold/sell read — the headline
              synthesis. It's fetched on its own since the model call is the
              slowest read, so the rest of the tab paints while this card shows
              its own spinner; a failed read (e.g. the model isn't configured)
              degrades to a warning rather than sinking the page. */}
          {analysisQuery.isLoading && (
            <Card variant="outlined" sx={{ borderColor: 'divider' }}>
              <CardContent sx={{ p: 3 }}>
                <Stack
                  direction="row"
                  spacing={1.5}
                  sx={{ alignItems: 'center' }}
                >
                  <CircularProgress size={20} />
                  <Typography color="text.secondary">
                    Generating AI analysis…
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          )}
          {analysisQuery.isError && (
            <Alert severity="warning" variant="outlined">
              {errorMessage(
                analysisQuery.error,
                'Could not load the AI analysis.',
              )}
            </Alert>
          )}
          {analysisQuery.data && <AnalysisCard analysis={analysisQuery.data} />}

          {/* The price chart anchors the tab. */}
          <Card variant="outlined" sx={{ borderColor: 'divider' }}>
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1.5}
                sx={{
                  justifyContent: 'space-between',
                  alignItems: { sm: 'center' },
                  mb: 2,
                }}
              >
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: 'baseline' }}
                >
                  <Typography
                    variant="h6"
                    component="h2"
                    sx={{ fontWeight: 600 }}
                  >
                    Price chart
                  </Typography>
                  {candleQuery.data && (
                    <RangeReturn candles={candleQuery.data.candles} />
                  )}
                </Stack>
                <Stack
                  direction="row"
                  spacing={1.5}
                  sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}
                >
                  {(supportQuery.data?.levels.length ?? 0) > 0 && (
                    <FormControlLabel
                      control={
                        <Switch
                          size="small"
                          checked={showSupport}
                          onChange={(e) => setShowSupport(e.target.checked)}
                        />
                      }
                      label="Support levels"
                      sx={{
                        m: 0,
                        color: 'text.secondary',
                        '& .MuiFormControlLabel-label': { fontSize: '0.8rem' },
                      }}
                    />
                  )}
                  <ChartRangeToggle value={range} onChange={setRange} />
                </Stack>
              </Stack>

              {candleQuery.isLoading && (
                <Stack
                  sx={{
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 360,
                  }}
                >
                  <CircularProgress />
                </Stack>
              )}
              {candleQuery.isError && (
                <Alert severity="warning" variant="outlined">
                  {errorMessage(
                    candleQuery.error,
                    'Could not load chart data.',
                  )}
                </Alert>
              )}
              {candleQuery.data && (
                <CandleChart
                  candles={candleQuery.data.candles}
                  timeframe={candleQuery.data.timeframe}
                  supportLevels={
                    showSupport ? supportQuery.data?.levels : undefined
                  }
                />
              )}
            </CardContent>
          </Card>
        </Stack>
      )}

      {/* Valuation gathers the analytical reads that used to crowd the old
          General tab: the profitability gauge, the growth-adjusted PEG, and the
          peer P/E benchmark. All ride the card's metrics block (the industry
          read its own best-effort query), so switching in is instant. */}
      {tab === 'valuation' && (
        <Stack spacing={3} role="tabpanel">
          {/* "Is it making money?" — the trailing net-margin read. */}
          {stock.metrics && (
            <ProfitabilityCard
              netMargin={stock.metrics.net_margin}
              grossMargin={stock.metrics.gross_margin}
              operatingMargin={stock.metrics.operating_margin}
            />
          )}

          {/* "Is the price fair for the growth?" — the growth-adjusted read. */}
          {stock.metrics && (
            <PegCard
              peg={stock.metrics.peg}
              forwardPeg={stock.metrics.forward_peg}
            />
          )}

          {/* "Is the price rich or cheap for its industry?" Best-effort:
              self-hides when fewer than MIN_INDUSTRY_PEERS back the benchmark
              (the card returns null), so a sole-peer "median" never renders as
              a verdict. */}
          {industryValuationQuery.data && (
            <IndustryPeCard
              stockPe={stock.metrics?.pe ?? null}
              valuation={industryValuationQuery.data}
            />
          )}

          {/* Nothing to value — a rare unclassified/uncovered name. A plain
              empty state beats a blank panel. */}
          {!stock.metrics && !industryValuationQuery.data && (
            <Card variant="outlined" sx={{ borderColor: 'divider' }}>
              <CardContent sx={{ p: 3, textAlign: 'center' }}>
                <Typography
                  variant="h6"
                  component="h2"
                  sx={{ fontWeight: 600 }}
                >
                  Valuation
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 1 }}>
                  No valuation data for {stock.ticker}.
                </Typography>
              </CardContent>
            </Card>
          )}
        </Stack>
      )}

      {/* Sell-side ratings on their own tab: the consensus verdict, the analyst
          distribution, the month-over-month drift and the 12-month price
          target — all riding the loaded ticker's recommendations read. */}
      {tab === 'analysts' && (
        <Box role="tabpanel">
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
            <AnalystCard
              recommendations={recommendationsQuery.data}
              price={stock.price}
            />
          )}
        </Box>
      )}

      {/* Earnings and valuation live in one card now: the plain-language beat
          verdict, the EPS/revenue charts, and the forward-P/E walk, all under a
          single Quarterly/Annual toggle. It fills the tab's width; the panel
          just shows a spinner or an error while the query resolves. */}
      {tab === 'earnings' && (
        <Box role="tabpanel">
          {quarterlyQuery.isLoading && (
            <Stack
              sx={{ alignItems: 'center', justifyContent: 'center', py: 2 }}
            >
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
              price={stock.price}
              quarterly={quarterlyQuery.data}
              trailingPe={stock.metrics?.pe ?? null}
            />
          )}
        </Box>
      )}

      {/* Options-market read, riding the single snapshot request. When the
          block is null (no priceable options) the tab shows a plain empty
          state rather than a blank panel. */}
      {tab === 'options' && (
        <Box role="tabpanel">
          {stock.options_metrics ? (
            <OptionsCard metrics={stock.options_metrics} price={stock.price} />
          ) : (
            <Card variant="outlined" sx={{ borderColor: 'divider' }}>
              <CardContent sx={{ p: 3, textAlign: 'center' }}>
                <Typography
                  variant="h6"
                  component="h2"
                  sx={{ fontWeight: 600 }}
                >
                  Options
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 1 }}>
                  No priceable options for {stock.ticker}.
                </Typography>
              </CardContent>
            </Card>
          )}
        </Box>
      )}
    </>
  )
}
