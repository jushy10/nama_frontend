import { useState, type ReactElement } from 'react'
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
  useEarningsAnalysis,
  useEma,
  useFiveYearReturn,
  useIndustryValuation,
  usePeHistory,
  useAnalystInfo,
  useQuarterlyEarnings,
  useRatingsAnalysis,
  useStockAnalysis,
  useSupportLevels,
  useTickerCard,
} from '@/lib/queries'
import ShowChartIcon from '@mui/icons-material/ShowChart'
import DashboardIcon from '@mui/icons-material/Dashboard'
import AssessmentIcon from '@mui/icons-material/Assessment'
import GroupsIcon from '@mui/icons-material/Groups'
import BarChartIcon from '@mui/icons-material/BarChart'
import CandlestickChartIcon from '@mui/icons-material/CandlestickChart'
import AnalysisCard from '@/components/AnalysisCard'
import StockHeader from '@/components/StockHeader'
import StockCard from '@/components/StockCard'
import ProfitabilityCard from '@/components/ProfitabilityCard'
import CashGenerationCard from '@/components/CashGenerationCard'
import IndustryPeCard from '@/components/IndustryPeCard'
import PeHistoryCard from '@/components/PeHistoryCard'
import OptionsCard from '@/components/OptionsCard'
import CandleChart from '@/components/CandleChart'
import ChartRangeToggle from '@/components/ChartRangeToggle'
import RangeReturn from '@/components/RangeReturn'
import AnalystCard from '@/components/AnalystCard'
import RatingsReviewCard from '@/components/RatingsReviewCard'
import EarningsCard from '@/components/EarningsCard'
import EarningsAnalysisCard from '@/components/EarningsAnalysisCard'
import AnalysisLoadingCard from '@/components/AnalysisLoadingCard'

// The card carries everything the stock detail draws off in one request: the
// snapshot's dividend, the performance windows, the metrics (profitability),
// and the options read.
const SNAPSHOT_BLOCKS: TickerCardInclude[] = [
  'dividend',
  'performance',
  'metrics',
  'options_metrics',
]

// A small tab menu splits the detail into focused sections so it isn't one long
// scroll: Overview (snapshot, performance, the AI take and price chart),
// Fundamentals (profitability, cash generation, and the industry-P/E and
// P/E-history reads), Analysts (the sell-side ratings), Earnings, and Options.
type StockDetailTab =
  | 'overview'
  | 'fundamentals'
  | 'analysts'
  | 'earnings'
  | 'options'

// The tab strip's sections, each with a small leading glyph so the row scans as
// icons + labels rather than five look-alike words — Overview, Fundamentals,
// Analysts, Earnings, Options.
const STOCK_TABS: {
  value: StockDetailTab
  label: string
  icon: ReactElement
}[] = [
  { value: 'overview', label: 'Overview', icon: <DashboardIcon /> },
  { value: 'fundamentals', label: 'Fundamentals', icon: <AssessmentIcon /> },
  { value: 'analysts', label: 'Analysts', icon: <GroupsIcon /> },
  { value: 'earnings', label: 'Earnings', icon: <BarChartIcon /> },
  { value: 'options', label: 'Options', icon: <CandlestickChartIcon /> },
]

// The active-tab pill reuses the top nav's house treatment (src/App.tsx) — a
// navy→blue fill with a soft glow — so the detail's section switcher reads as
// the same control family rather than a stray restyle.
const ACTIVE_PILL = 'linear-gradient(135deg, #07378e 0%, #4f83e6 100%)'
const ACTIVE_GLOW = '0 6px 16px -5px rgba(47,99,180,0.55)'

/**
 * The stock detail view — the snapshot card plus the performance/profitability/
 * options reads, analyst ratings, the price chart, and the earnings +
 * forward-P/E row. The Search page hands it a symbol once the classifier calls
 * the ticker an equity; it fetches that ticker's card (with every block) itself,
 * and the chart, 5Y pill, ratings, and earnings ride the loaded ticker.
 */
export default function StockDetail({ symbol }: { symbol: string }) {
  const [range, setRange] = useState<ChartRange>('6M')
  const [showSupport, setShowSupport] = useState(true)
  const [showEma, setShowEma] = useState(true)
  const [tab, setTab] = useState<StockDetailTab>('overview')
  const cardQuery = useTickerCard(symbol, SNAPSHOT_BLOCKS)
  const stock = cardQuery.data
  // The chart, 5Y pill, ratings, and earnings ride the *loaded* ticker, so they
  // only fire once the card resolves — a bad symbol never kicks off more doomed
  // requests. The earnings card runs off the consolidated quarterly endpoint;
  // the profitability read rides on the card's `metrics` block, and the
  // annual series (best-effort) backs the card's Quarterly/Annual toggle.
  const loadedSymbol = stock?.ticker ?? null
  const candleQuery = useCandles(loadedSymbol, range)
  // Support levels ride the loaded ticker, keyed by symbol only — a fixed 1Y
  // scan that doesn't refetch as the range changes; the chart draws just the
  // ones inside the visible price range.
  const supportQuery = useSupportLevels(loadedSymbol)
  // EMA overlay follows the chart's range (so the lines sit under the same bars)
  // and is only fetched while the toggle is on. Best-effort: a failure just
  // leaves the overlay off, never disturbs the price chart.
  const emaQuery = useEma(loadedSymbol, range, showEma)
  const fiveYearReturn = useFiveYearReturn(loadedSymbol)
  const analystQuery = useAnalystInfo(loadedSymbol)
  const quarterlyQuery = useQuarterlyEarnings(loadedSymbol)
  const annualQuery = useAnnualEarnings(loadedSymbol)
  // The AI take is the slowest read (a live model call), so it rides the loaded
  // ticker on its own and the card fills in once it lands.
  const analysisQuery = useStockAnalysis(loadedSymbol)
  // The earnings-tab AI read, a separate live (slow, paid) model call that leads
  // the earnings tab once it lands. Unlike the other reads it's gated on the tab
  // being open, so it never fires on a detail-page load that stays on Overview.
  // The hook stays mounted here (not inside the tab panel) with a staleTime, so
  // the result is cached and toggling away and back doesn't re-fire the call.
  // Best-effort: it's supplementary to the charts, so an error (or a symbol the
  // model can't read) just omits the card rather than warning.
  const earningsAnalysisQuery = useEarningsAnalysis(
    loadedSymbol,
    tab === 'earnings',
  )
  // The Analysts-tab AI read — a plain-language take on the sell-side coverage,
  // gated on the tab being open (the same slow/paid model-call discipline as the
  // earnings analysis, held fresh across tab switches). Best-effort: an error or
  // an uncovered symbol just omits the card.
  const ratingsAnalysisQuery = useRatingsAnalysis(
    loadedSymbol,
    tab === 'analysts',
  )
  // The industry P/E benchmark rides the loaded card's own industry slug (idle
  // until it resolves; never fires for an unclassified stock). Best-effort — it
  // self-hides if the industry has too few valued peers to stand as a
  // benchmark, so no loading/error UI.
  const industryValuationQuery = useIndustryValuation(stock?.industry ?? null)
  // The stock's own trailing-P/E history rides the loaded ticker (idle until it
  // resolves). Best-effort — an uncovered/blocked symbol resolves to an empty
  // series and the card self-hides, so no loading/error UI.
  const peHistoryQuery = usePeHistory(loadedSymbol)

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
    <Stack spacing={{ xs: 2, sm: 3 }}>
      {/* The identity + live quote lead the page and stay put across every tab
          via the persistent header, so the ticker, name and price never scroll
          out of mind while you read Fundamentals, Analysts or Options. */}
      <StockHeader stock={stock} />

      {/* A pill tab strip splits the detail into focused sections so it isn't
          one long scroll: Overview holds the essentials (snapshot, the AI take
          and the price chart), Fundamentals the analytical reads, Analysts the
          sell-side ratings, and Earnings and Options each get their own tab.
          Most queries fire up top regardless of the active tab, so switching is
          instant and never refetches; the one exception is the earnings
          analysis, a slow paid model call gated on the Earnings tab being open.
          The strip sticks just under the app bar and scrolls sideways on a
          phone, so the sections stay one tap away however far you've scrolled. */}
      <Box
        sx={{
          position: 'sticky',
          top: { xs: 56, sm: 64 },
          zIndex: 3,
          py: 1,
          mx: { xs: -2, sm: -3 },
          px: { xs: 2, sm: 3 },
          bgcolor: (theme) =>
            theme.palette.mode === 'dark'
              ? 'rgba(10,10,15,0.82)'
              : 'rgba(247,248,250,0.82)',
          backdropFilter: 'blur(12px)',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Tabs
          value={tab}
          onChange={(_, value: StockDetailTab) => setTab(value)}
          aria-label="Stock detail sections"
          variant="scrollable"
          scrollButtons={false}
          sx={{
            minHeight: 0,
            '& .MuiTabs-indicator': { display: 'none' },
            '& .MuiTabs-flexContainer': { gap: 0.5 },
            '& .MuiTabs-scroller': { py: 0.25 },
            '& .MuiSvgIcon-root': { fontSize: '1.1rem' },
            '& .MuiTab-root': {
              minHeight: 0,
              minWidth: 0,
              gap: 0.5,
              px: 1.25,
              py: 0.9,
              borderRadius: 999,
              textTransform: 'none',
              fontWeight: 600,
              fontSize: { xs: '0.8rem', sm: '0.875rem' },
              color: 'text.secondary',
              transition:
                'color 0.2s ease, background 0.25s ease, box-shadow 0.25s ease',
              '&:hover': { color: 'text.primary', bgcolor: 'action.hover' },
            },
            '& .Mui-selected': {
              color: '#fff !important',
              background: ACTIVE_PILL,
              boxShadow: ACTIVE_GLOW,
              '&:hover': { background: ACTIVE_PILL },
            },
          }}
        >
          {STOCK_TABS.map((t) => (
            <Tab
              key={t.value}
              value={t.value}
              label={t.label}
              icon={t.icon}
              iconPosition="start"
              disableRipple
            />
          ))}
        </Tabs>
      </Box>

      {tab === 'overview' && (
        <Stack spacing={3} role="tabpanel">
          {/* The snapshot hero leads the tab, full width: what this is and
              where it trades, the key stats, and the trailing-return strip —
              all in one card (5Y fills in a beat later). */}
          <StockCard
            stock={stock}
            perf={stock.performance}
            fiveYearReturn={fiveYearReturn}
          />

          {/* The AI take — a plain-language buy/hold/sell read — the headline
              synthesis. It's fetched on its own since the model call is the
              slowest read, so the rest of the tab paints while this card shows
              its own spinner; a failed read (e.g. the model isn't configured)
              degrades to a warning rather than sinking the page. */}
          {analysisQuery.isLoading && (
            <AnalysisLoadingCard title="AI Analysis" />
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
                  <ShowChartIcon
                    fontSize="small"
                    sx={{ color: 'primary.main', alignSelf: 'center' }}
                  />
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
                  <FormControlLabel
                    control={
                      <Switch
                        size="small"
                        checked={showEma}
                        onChange={(e) => setShowEma(e.target.checked)}
                      />
                    }
                    label="Moving averages"
                    sx={{
                      m: 0,
                      color: 'text.secondary',
                      '& .MuiFormControlLabel-label': { fontSize: '0.8rem' },
                    }}
                  />
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
                  emaLines={showEma ? emaQuery.data?.lines : undefined}
                />
              )}
            </CardContent>
          </Card>
        </Stack>
      )}

      {/* Fundamentals gathers the analytical reads that used to crowd the old
          General tab: the profitability gauge, the cash-generation read, and the
          peer P/E benchmark. The first two ride the card's metrics block (the
          industry read its own best-effort query), so switching in is instant. */}
      {tab === 'fundamentals' && (
        <Stack spacing={3} role="tabpanel">
          {/* "Is it making money?" — the trailing net-margin read. */}
          {stock.metrics && (
            <ProfitabilityCard
              netMargin={stock.metrics.net_margin}
              grossMargin={stock.metrics.gross_margin}
              operatingMargin={stock.metrics.operating_margin}
            />
          )}

          {/* "Does it throw off cash?" — free cash flow yield, how operating
              cash converts to free cash after capex, and the cash multiples.
              Self-hides when the whole cash-flow block is uncovered. */}
          {stock.metrics && <CashGenerationCard metrics={stock.metrics} />}

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

          {/* "Is the price rich or cheap versus its own history?" The trailing
              P/E at each past earnings release, anchored on the stock's own
              median rather than its peers'. Best-effort: self-hides when the
              series is too short (an uncovered/blocked symbol comes back near
              empty), so no loading/error UI. */}
          {peHistoryQuery.data && (
            <PeHistoryCard history={peHistoryQuery.data} />
          )}

          {/* Nothing to value — a rare unclassified/uncovered name. A plain
              empty state beats a blank panel. */}
          {!stock.metrics &&
            !industryValuationQuery.data &&
            !peHistoryQuery.data?.points.length && (
              <Card variant="outlined" sx={{ borderColor: 'divider' }}>
                <CardContent sx={{ p: 3, textAlign: 'center' }}>
                  <Typography
                    variant="h6"
                    component="h2"
                    sx={{ fontWeight: 600 }}
                  >
                    Fundamentals
                  </Typography>
                  <Typography color="text.secondary" sx={{ mt: 1 }}>
                    No fundamental data for {stock.ticker}.
                  </Typography>
                </CardContent>
              </Card>
            )}
        </Stack>
      )}

      {/* Sell-side ratings on their own tab: an AI take on the coverage leads,
          then the consensus verdict, the analyst distribution, the
          month-over-month drift, the 12-month price target and the most credible
          firms' current stance — all riding the loaded ticker's analyst-info
          read. */}
      {tab === 'analysts' && (
        <Stack spacing={3} role="tabpanel">
          {/* The AI ratings take leads the tab — a plain-language read of what
              the sell-side thinks. Its own slow model call, gated on the tab, so
              it shows a loading card then fills in; a failure degrades to a
              warning rather than sinking the ratings below. */}
          {ratingsAnalysisQuery.isLoading && (
            <AnalysisLoadingCard title="Ratings Analysis" />
          )}
          {ratingsAnalysisQuery.isError && (
            <Alert severity="warning" variant="outlined">
              {errorMessage(
                ratingsAnalysisQuery.error,
                'Could not load the ratings analysis.',
              )}
            </Alert>
          )}
          {ratingsAnalysisQuery.data && (
            <RatingsReviewCard analysis={ratingsAnalysisQuery.data} />
          )}

          {analystQuery.isLoading && (
            <Stack sx={{ alignItems: 'center', py: 2 }}>
              <CircularProgress size={28} />
            </Stack>
          )}
          {analystQuery.isError && (
            <Alert severity="warning" variant="outlined">
              {errorMessage(
                analystQuery.error,
                'Could not load analyst ratings.',
              )}
            </Alert>
          )}
          {analystQuery.data && (
            <AnalystCard
              recommendations={analystQuery.data.recommendations}
              topFirms={analystQuery.data.top_firms}
              price={stock.price}
            />
          )}
        </Stack>
      )}

      {/* Earnings and valuation live in one card now: the plain-language beat
          verdict, the EPS/revenue charts, and the forward-P/E walk, all under a
          single Quarterly/Annual toggle. It fills the tab's width; the panel
          just shows a spinner or an error while the query resolves. */}
      {tab === 'earnings' && (
        <Stack spacing={3} role="tabpanel">
          {/* The AI earnings read leads the tab once it lands — a slow model
              call, so it shows its own spinner and quietly omits itself on an
              error (it's supplementary to the charts below, and the endpoint
              404s for a symbol it can't read). */}
          {earningsAnalysisQuery.isLoading && (
            <AnalysisLoadingCard
              title="Earnings Analysis"
              subtitle="Reading the earnings story"
              points={4}
            />
          )}
          {earningsAnalysisQuery.data && (
            <EarningsAnalysisCard analysis={earningsAnalysisQuery.data} />
          )}

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
        </Stack>
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
    </Stack>
  )
}
