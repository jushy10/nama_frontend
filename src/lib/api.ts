/** Client for the nama backend API. */

/** Trailing price-return windows (percent). Any window may be null. */
export interface StockPerformance {
  '1w': number | null
  '1m': number | null
  '3m': number | null
  '6m': number | null
  ytd: number | null
  '1y': number | null
}

/** Opt-in enrichment blocks the ticker-card endpoint can attach. */
export type TickerCardInclude =
  | 'dividend'
  | 'performance'
  | 'metrics'
  | 'options_metrics'

/**
 * A ticker card's dividend block: percent yield plus the annual per-share
 * payout in the quote currency. Either is null for a non-payer or an
 * uncovered field.
 */
export interface TickerDividend {
  yield_percentage: number | null
  per_share: number | null
}

/**
 * A ticker card's full valuation, profitability, health and growth ladder — every
 * fundamental the app materializes on the stock, served off one DB read (only the
 * price-anchored multiples are computed live on the quote).
 *
 * Valuation: `pe`/`pb`/`ps` are the trailing price-to-earnings/book/sales multiples
 * (price over the last twelve months of reported EPS, book value per share, and
 * sales per share); `peg` is `pe` over trailing EPS growth (a "multiple justified by
 * growth?" read); `eps` is the trailing EPS the `pe` divides by; `forward_pe`/
 * `forward_ps` are the same multiples on next year's analyst-consensus EPS/revenue —
 * what the price implies about what's *expected*, not what's reported.
 *
 * Profitability & health: the margins are trailing percentages; `roe` is return on
 * equity (percent); `current_ratio` (current assets over liabilities) and
 * `debt_to_equity` (a ratio) read liquidity and leverage; `beta` is volatility
 * versus the market (1 = moves with it).
 *
 * Growth: `revenue_growth_yoy`/`eps_growth_yoy` are the trailing year-over-year
 * rates for the top and bottom line, and `forward_revenue_growth_yoy`/
 * `forward_eps_growth_yoy` the analyst-expected next-year (FY1→FY2) rates.
 *
 * The cash-flow block reads the same business through what it actually banks:
 * `price_to_fcf` is the trailing price-to-free-cash-flow multiple (a cash-based
 * cousin of `pe`); `fcf_yield` and `ocf_yield` are free and operating cash flow
 * as a percent of market cap — the cash a shareholder's dollar earns, the gap
 * between them the drag from capital spending; `fcf_growth_yoy` is the trailing
 * year-over-year change in free cash flow (percent, signed). Any field a vendor
 * doesn't cover is null.
 */
export interface TickerMetrics {
  pe: number | null
  pb: number | null
  ps: number | null
  peg: number | null
  eps: number | null
  forward_pe: number | null
  forward_ps: number | null
  price_to_fcf: number | null
  fcf_yield: number | null
  ocf_yield: number | null
  gross_margin: number | null
  operating_margin: number | null
  net_margin: number | null
  roe: number | null
  current_ratio: number | null
  debt_to_equity: number | null
  beta: number | null
  revenue_growth_yoy: number | null
  eps_growth_yoy: number | null
  fcf_growth_yoy: number | null
  forward_revenue_growth_yoy: number | null
  forward_eps_growth_yoy: number | null
}

/**
 * A ticker card's options-market block — four derived figures, not a chain.
 * `implied_volatility` is the annualized at-the-money IV at the ~1-month
 * expiry (percent); `expected_move_percent` is the swing priced in by
 * `expected_move_by` (the ATM straddle over spot); `insurance_cost_percent`
 * is what a quarter of downside cover costs until `insurance_expires` (an ATM
 * put over spot); `put_call_ratio` is which way today's bets lean — above 1
 * protective, below 1 optimistic. Every field is independently null when its
 * contracts are too thin to price.
 */
export interface OptionsMetrics {
  implied_volatility: number | null
  expected_move_percent: number | null
  expected_move_by: string | null
  insurance_cost_percent: number | null
  insurance_expires: string | null
  put_call_ratio: number | null
}

/** Which side of an options chain a contract sits on. */
export type OptionContractType = 'call' | 'put'

/**
 * One contract's row on the options chain (`GET /stocks/ticker/{ticker}/options`).
 * `mid` is the fair price (bid/ask midpoint, else last); `premium` is the dollars
 * that changed hands today (`mid` × volume × 100 — a lot is 100 shares), the figure
 * a flow screen ranks by. `implied_volatility` is a percent. `volume_oi_ratio` is
 * today's volume over prior open interest, and `unusual` flags a contract whose
 * volume exceeded that open interest (fresh positioning). Any figure is null when the
 * vendor didn't quote it — an unpriced or untraded contract, not a zero.
 */
export interface OptionContract {
  expiration: string
  strike: number
  type: OptionContractType
  bid: number | null
  ask: number | null
  last_price: number | null
  mid: number | null
  volume: number | null
  open_interest: number | null
  implied_volatility: number | null
  in_the_money: boolean | null
  premium: number | null
  volume_oi_ratio: number | null
  unusual: boolean
}

/**
 * The day's aggregate flow across the shown expiry. Per-side volume/open interest,
 * the put/call lean (volume and open-interest ratios, null when their call
 * denominator is 0), the dollar premium into each side, and `net_premium` — call
 * premium minus put premium (positive = money leaning into calls).
 */
export interface OptionsFlowSummary {
  call_volume: number
  put_volume: number
  total_volume: number
  call_open_interest: number
  put_open_interest: number
  put_call_volume_ratio: number | null
  put_call_oi_ratio: number | null
  call_premium: number
  put_premium: number
  net_premium: number
}

/**
 * A stock's options-flow read for one expiration
 * (`GET /stocks/ticker/{ticker}/options`) — the calls and puts coming in, the
 * volume, and the money behind them. `spot` is the underlying price for
 * at-the-money context; `expiration` is the expiry the `calls`/`puts` are for and
 * `expirations` the full list of listed expiries (for a client-side selector).
 * `unusual` are the standout contracts (volume above open interest), most-money-
 * first. A symbol with no listed options comes back with a null `expiration`/
 * `summary` and empty lists (a 200, not a 404) — the card self-hides.
 *
 * Scope: Yahoo publishes cumulative day volume and prior-day open interest, not a
 * trade-by-trade tape — so this is a "where's the volume and money going" snapshot,
 * not print-level sweep/block flow.
 */
export interface OptionsFlow {
  ticker: string
  spot: number | null
  expiration: string | null
  expirations: string[]
  summary: OptionsFlowSummary | null
  calls: OptionContract[]
  puts: OptionContract[]
  unusual: OptionContract[]
}

/**
 * What kind of instrument a symbol is. `equity` is a common stock; `etf` is an
 * exchange-traded fund (present in the screened ETF universe). Drives which
 * detail page a ticker belongs on — the stock page (`/stocks`) redirects an
 * `etf` to the fund page (`/etfs`), and vice versa.
 */
export type AssetType = 'equity' | 'etf'

/**
 * The per-ticker card from `/stocks/ticker/{ticker}` — the app's one stock
 * snapshot: the live quote plus name, exchange, market cap, and the company's
 * `sector`/`industry` classification. The classification arrives as the
 * backend's snake_case slugs (e.g. `"industrials"`, `"engineering_construction"`)
 * and is null when uncovered. The `dividend`/`performance`/`metrics`/
 * `options_metrics` blocks arrive only when requested via `include` and are null
 * otherwise (or when their source is down).
 */
export interface TickerCard {
  ticker: string
  name: string | null
  exchange: string | null
  /** `etf` when the ticker is in the ETF universe, else `equity`. */
  asset_type: AssetType
  sector: string | null
  industry: string | null
  price: number
  change: number | null
  change_percent: number | null
  market_cap: number | null
  dividend: TickerDividend | null
  performance: StockPerformance | null
  metrics: TickerMetrics | null
  options_metrics: OptionsMetrics | null
}

/**
 * The quote fields a price tile renders: the live price and the day's move.
 * Both a stock's `TickerCard` and an ETF's `EtfDetail` satisfy it, so a tile can
 * be fed from either the `/stocks/ticker/{ticker}` card or the
 * `/stocks/etf/{ticker}` fund detail.
 */
export type Quote = Pick<TickerCard, 'price' | 'change' | 'change_percent'>

/**
 * A market sector, tracked via its SPDR Select Sector ETF (XLK, XLF, …).
 * `change`/`change_percent` are the move for the current session; `performance`
 * holds the trailing returns over longer windows.
 */
export interface Sector {
  sector: string
  symbol: string
  price: number
  change: number | null
  change_percent: number | null
  previous_close: number | null
  as_of: string | null
  performance: StockPerformance | null
}

export interface SectorsResponse {
  count: number
  sectors: Sector[]
}

/** The market's risk posture the day's sector rotation implies. */
export type MarketTone = 'risk_on' | 'risk_off' | 'mixed'

/**
 * One constituent stock that drove a sector's move today — the grounded "why"
 * behind the note. `change_percent` is the stock's real day move and
 * `market_cap` its size, both service-supplied (a live quote + the anchor
 * figure), never authored by the model.
 */
export interface SectorMover {
  ticker: string
  name: string | null
  change_percent: number | null
  market_cap: number | null
}

/**
 * A recent headline from one of a sector's movers — the candidate catalyst.
 * Carried straight from the news store (not authored by the model): `ticker` is
 * the mover it belongs to and `link` opens the source article.
 */
export interface SectorHeadline {
  ticker: string
  title: string
  published_at: string | null
  publisher: string | null
  link: string | null
}

/**
 * One sector called out in the AI sector analysis. `change_percent` is the
 * sector proxy's real move on the day (joined from the board, not authored by
 * the model); `note` is the model's one-line read on why it stands out.
 * `movers` and `headlines` are the grounded receipts behind that note — the
 * constituent stocks that drove the move and recent headlines from them — joined
 * from the board, not authored, so the note's specifics can be verified.
 */
export interface SectorHighlight {
  sector: string
  symbol: string
  change_percent: number | null
  note: string
  movers: SectorMover[]
  headlines: SectorHeadline[]
}

/**
 * An AI-generated read of how the market's sectors are moving today: a plain
 * `summary`, the risk posture (`tone`), and the standout `leaders`/`laggards`
 * with a one-line note each. `disclaimer` is service-authored — descriptive,
 * not financial advice. `model`/`generated_at` record what produced it and when.
 */
export interface SectorAnalysis {
  summary: string
  tone: MarketTone
  leaders: SectorHighlight[]
  laggards: SectorHighlight[]
  disclaimer: string
  model: string
  generated_at: string
}

/** Which trailing timeframe a market-summary breakdown covers. */
export type MarketPeriodName = 'week' | 'month' | 'year'

/**
 * One headline index's return over a single timeframe. `symbol` is the proxy ETF
 * the index is read through (SPY for the S&P 500, QQQ for the Nasdaq);
 * `change_percent` is that proxy's real move over the period (from the board, not
 * authored by the model).
 */
export interface MarketIndexReturn {
  name: string
  symbol: string
  change_percent: number | null
}

/**
 * One timeframe in the market summary — the past week, month, or year — with each
 * index's real return over it and the AI's one-line read of the stretch.
 */
export interface MarketPeriod {
  period: MarketPeriodName
  indexes: MarketIndexReturn[]
  note: string
}

/**
 * An AI-generated overview of how the US market has moved lately: a plain
 * `summary`, the risk posture (`tone`), and a `periods` breakdown by timeframe
 * (the past year, month and week), each with the indexes' real returns and a
 * one-line note. `disclaimer` is service-authored — descriptive, not financial
 * advice. `model`/`generated_at` record what produced it and when.
 */
export interface MarketSummary {
  summary: string
  tone: MarketTone
  periods: MarketPeriod[]
  disclaimer: string
  model: string
  generated_at: string
}

/** Trailing-return windows in display order, for selectors and strips. */
export const PERF_WINDOWS: { key: keyof StockPerformance; label: string }[] = [
  { key: '1w', label: '1W' },
  { key: '1m', label: '1M' },
  { key: '3m', label: '3M' },
  { key: '6m', label: '6M' },
  { key: 'ytd', label: 'YTD' },
  { key: '1y', label: '1Y' },
]

/** Sector timeframe key: the day's move (`1d`) plus the trailing windows. */
export type SectorWindow = '1d' | keyof StockPerformance

/**
 * Windows for the sector timeframe selector. `1D` is the current session's move
 * (`change_percent`); the rest are trailing returns from `performance`.
 */
export const SECTOR_WINDOWS: { key: SectorWindow; label: string }[] = [
  { key: '1d', label: '1D' },
  ...PERF_WINDOWS,
]

/** A sector's return over one window; `1D` reads the current session's move. */
export function sectorReturn(s: Sector, key: SectorWindow): number | null {
  return key === '1d' ? s.change_percent : (s.performance?.[key] ?? null)
}

/** One OHLC candlestick. `time` is UNIX epoch seconds (UTC). */
export interface Candle {
  time: number
  timestamp: string
  open: number
  high: number
  low: number
  close: number
  volume: number | null
  direction: string
}

export interface CandleSeries {
  symbol: string
  timeframe: string
  count: number
  candles: Candle[]
}

/**
 * Percent move across a candle series, from the first bar's open to the last
 * bar's close — the whole charted window, including the first bar's own move.
 * `null` when the series is empty or has no usable base price.
 */
export function rangeReturnPct(candles: Candle[]): number | null {
  const first = candles[0]
  const last = candles[candles.length - 1]
  if (!first || !last || !first.open) return null
  return ((last.close - first.open) / first.open) * 100
}

/** Where the latest RSI sits relative to the overbought/oversold thresholds. */
export type RsiSignal = 'oversold' | 'overbought' | 'neutral'

/** One RSI reading. `time` is UNIX epoch seconds (UTC); `value` is 0–100. */
export interface RsiPoint {
  time: number
  timestamp: string
  value: number
}

/**
 * A Relative Strength Index series. `latest` is the most recent reading (null
 * when the window is too short to compute one); `signal` classifies it against
 * `overbought`/`oversold` (conventionally 70/30).
 */
export interface RsiSeries {
  symbol: string
  timeframe: string
  period: number
  count: number
  latest: number | null
  signal: RsiSignal
  overbought: number
  oversold: number
  points: RsiPoint[]
}

/** How firmly a support level has held, by how many swing lows formed it. */
export type SupportStrength = 'weak' | 'moderate' | 'strong'

/**
 * One horizontal support level — a price zone where the stock has repeatedly
 * found buyers (clustered swing lows). `touches` is how many formed it,
 * `last_touched` dates the most recent, and `distance_percent` is how far the
 * level sits below the reference price (`<= 0`, since support is under the price).
 */
export interface SupportLevel {
  price: number
  touches: number
  last_touched: string // ISO date (YYYY-MM-DD)
  strength: SupportStrength
  distance_percent: number
}

/**
 * Detected support levels for a ticker, strongest-ranked and returned
 * nearest-first. `reference_price` is the latest close the levels were measured
 * against — what "below the current price" means here. `levels` is empty when
 * there isn't enough history, or no swing low sits below the price, to find any.
 */
export interface SupportLevels {
  symbol: string
  timeframe: string
  reference_price: number
  count: number
  levels: SupportLevel[]
}

/** One EMA reading. `time` is UNIX epoch seconds (UTC) — the same clock the
 * candles use, so a point lines up with the bar sharing its `time`. `value` is
 * the moving average in the quote currency (an overlay on the price axis). */
export interface EmaPoint {
  time: number
  timestamp: string
  value: number
}

/**
 * One exponential-moving-average line at a single lookback `period` (e.g. the
 * 50-EMA). `latest` is the final value; `points` starts once there's enough
 * history to seed the average, so a short window can leave it empty (and a
 * deep period like 200 needs a long range to appear at all).
 */
export interface EmaLine {
  period: number
  count: number
  latest: number | null
  points: EmaPoint[]
}

/**
 * The EMA overlay for a ticker — one line per requested period (e.g. the
 * 9/21/50 set), drawn on the candle chart's price axis. `lines` is in the
 * order the periods were requested.
 */
export interface EmaSeries {
  symbol: string
  timeframe: string
  lines: EmaLine[]
}

/** Which way one horizon is heading, read off the slope of its EMA. */
export type TrendDirection = 'up' | 'down' | 'sideways'

/**
 * The two horizons combined into one plain reading — the headline. The long
 * horizon sets the primary trend; the short one qualifies it (e.g. an uptrend
 * that's `uptrend_pullback` when the short term has turned down). `unknown` when
 * there isn't enough history to read a horizon.
 */
export type TrendReading =
  | 'uptrend'
  | 'uptrend_pullback'
  | 'uptrend_consolidating'
  | 'downtrend'
  | 'downtrend_bounce'
  | 'downtrend_stalling'
  | 'range_bound'
  | 'range_turning_up'
  | 'range_turning_down'
  | 'unknown'

/**
 * One horizon's trend read, from the slope of its EMA. `slope_percent` is that
 * slope averaged per bar (what the sideways band is applied to); `change_percent`
 * is the same move totalled over the `lookback` bars it was measured across.
 * `price_vs_ema_percent` is where the latest close sits relative to the EMA
 * (positive = above), context the direction doesn't fold in.
 */
export interface TrendLeg {
  period: number
  lookback: number
  direction: TrendDirection
  slope_percent: number
  change_percent: number
  price_vs_ema_percent: number
  ema: number
}

/**
 * A ticker's trend at a short and a long horizon, plus their combined `reading`.
 * `short_term` / `long_term` are null when a horizon lacks the history to warm
 * its EMA (and the reading is then `unknown`). `reference_price` is the latest
 * close the read was taken at.
 */
export interface StockTrend {
  symbol: string
  timeframe: string
  reference_price: number
  reading: TrendReading
  short_term: TrendLeg | null
  long_term: TrendLeg | null
}

/** A trading suggestion derived from RSI, from Strong Buy down to Strong Sell. */
export type RsiAction = 'Strong Buy' | 'Buy' | 'Hold' | 'Sell' | 'Strong Sell'

/**
 * Width of the softer Buy/Sell bands that sit just inside the oversold and
 * overbought thresholds. With the conventional 30/70 lines this puts a plain
 * Buy at 30–40 and a plain Sell at 60–70, leaving the Strong calls for the
 * extremes beyond 30/70.
 */
export const RSI_ACTION_MARGIN = 10

/**
 * Map an RSI series to a five-step call. Below `oversold` is a Strong Buy; the
 * band just above it (within RSI_ACTION_MARGIN) softens to Buy. The overbought
 * side mirrors that — above `overbought` is a Strong Sell, the band just below
 * is Sell — and everything in the middle is Hold. The threshold values
 * themselves count as the softer Buy/Sell. Returns null when there's no
 * reading to judge.
 */
export function rsiVerdict(rsi: RsiSeries): RsiAction | null {
  if (rsi.latest == null) return null
  if (rsi.latest < rsi.oversold) return 'Strong Buy'
  if (rsi.latest <= rsi.oversold + RSI_ACTION_MARGIN) return 'Buy'
  if (rsi.latest > rsi.overbought) return 'Strong Sell'
  if (rsi.latest >= rsi.overbought - RSI_ACTION_MARGIN) return 'Sell'
  return 'Hold'
}

/**
 * A bottom-line profitability call from trailing net margin: is the company
 * actually making money, and how comfortably. Net margin is THE profit read —
 * gross or operating margin can be positive while the net line bleeds, so this
 * keys off net alone.
 */
export type ProfitabilityVerdict =
  | 'Highly Profitable'
  | 'Profitable'
  | 'Marginally Profitable'
  | 'Unprofitable'

/**
 * Net-margin tiers, richest-first. Net margin (net income ÷ revenue) is the
 * share of every sales dollar kept as profit: above zero the company earns a
 * profit, at or below zero it loses money. The cutoffs are broad large-cap
 * rules of thumb — 20%+ is exceptional, double digits healthy, a thin
 * single-digit margin leaves little cushion. NOT sector-aware (a grocer runs on
 * thin margins by nature, software far fatter), so it's a rough guide.
 */
export const PROFIT_TIERS: { verdict: ProfitabilityVerdict; floor: number }[] =
  [
    { verdict: 'Highly Profitable', floor: 20 },
    { verdict: 'Profitable', floor: 10 },
    { verdict: 'Marginally Profitable', floor: 0 },
  ]

/**
 * Map a trailing net margin (a percent) to a profitability call. Returns null
 * when there's no margin to judge. A flat-or-negative margin (≤ 0) is
 * Unprofitable — no bottom-line profit; above zero the tiers grade how
 * comfortable the profit is. The 0% floor is strict, so exactly break-even
 * reads as Unprofitable rather than a wafer-thin profit.
 */
export function profitabilityVerdict(
  netMargin: number | null,
): ProfitabilityVerdict | null {
  if (netMargin == null) return null
  if (netMargin <= 0) return 'Unprofitable'
  for (const tier of PROFIT_TIERS) {
    if (netMargin >= tier.floor) return tier.verdict
  }
  /* c8 ignore next — any margin > 0 clears the 0 floor above */
  return 'Unprofitable'
}

/**
 * A plain-language read on how much free cash a business throws off relative to
 * its price, keyed off free-cash-flow yield (FCF ÷ market cap). Like a bond's
 * yield, a higher figure means more cash returned per dollar paid; at or below
 * zero the company burns cash rather than generating it.
 */
export type CashFlowVerdict =
  | 'Cash Rich'
  | 'Cash Generative'
  | 'Thin Free Cash'
  | 'Cash Burning'

/**
 * FCF-yield tiers, richest-first. Free-cash-flow yield (free cash flow ÷ market
 * cap) is the cash a shareholder's dollar earns each year: above ~6% is a rich,
 * bond-like cash return, 3–6% a healthy self-funding level, and a thin sub-3%
 * yield means you're paying up for the cash (a pricey or capital-hungry name).
 * Broad large-cap rules of thumb — NOT sector-aware (a fast grower reinvests
 * everything by design), so it's a rough guide, not a verdict on the business.
 */
export const FCF_YIELD_TIERS: { verdict: CashFlowVerdict; floor: number }[] = [
  { verdict: 'Cash Rich', floor: 6 },
  { verdict: 'Cash Generative', floor: 3 },
  { verdict: 'Thin Free Cash', floor: 0 },
]

/**
 * Map a trailing free-cash-flow yield (a percent) to a cash-generation call.
 * Returns null when there's no yield to judge. A flat-or-negative yield (≤ 0)
 * is Cash Burning — no free cash after running and investing in the business;
 * above zero the tiers grade how generous the cash return is. The 0% floor is
 * strict, so exactly break-even reads as Cash Burning rather than a razor-thin
 * yield.
 */
export function cashFlowVerdict(
  fcfYield: number | null,
): CashFlowVerdict | null {
  if (fcfYield == null) return null
  if (fcfYield <= 0) return 'Cash Burning'
  for (const tier of FCF_YIELD_TIERS) {
    if (fcfYield >= tier.floor) return tier.verdict
  }
  /* c8 ignore next — any yield > 0 clears the 0 floor above */
  return 'Cash Burning'
}

/**
 * How much a company leans on borrowed money, from its debt-to-equity ratio (total
 * debt ÷ shareholders' equity): `Low Debt` (a conservative balance sheet, debt at or
 * below equity), `Moderate Debt` (more debt than equity but within a normal range),
 * and `High Leverage` (debt runs well above equity, lifting both returns and risk).
 */
export type LeverageVerdict = 'Low Debt' | 'Moderate Debt' | 'High Leverage'

/**
 * Debt/equity tiers, safest-first, by ceiling. At or below 1.0 debt doesn't exceed
 * equity (conservative); up to 2.0 is a moderate, common load; above that the balance
 * sheet leans heavily on debt. Broad rules of thumb — NOT sector-aware (banks and
 * utilities carry far more debt by design), so it's a rough guide, not a verdict.
 */
export const LEVERAGE_TIERS: { verdict: LeverageVerdict; ceiling: number }[] = [
  { verdict: 'Low Debt', ceiling: 1 },
  { verdict: 'Moderate Debt', ceiling: 2 },
]

/**
 * The leverage verdict for a debt/equity ratio, or null when unknown or negative
 * (a negative ratio comes from negative equity — buybacks or accumulated losses —
 * which isn't a clean high/low read, so no verdict is given).
 */
export function leverageVerdict(
  debtToEquity: number | null,
): LeverageVerdict | null {
  if (debtToEquity == null || debtToEquity < 0) return null
  for (const tier of LEVERAGE_TIERS) {
    if (debtToEquity <= tier.ceiling) return tier.verdict
  }
  return 'High Leverage'
}

/**
 * Whether the price looks reasonable for the growth behind it, from the PEG ratio
 * (P/E ÷ earnings growth): `Cheap for Growth` (PEG at or below 1 — the classic
 * "growth you're not paying up for"), `Fairly Priced` (1–2, roughly in balance), and
 * `Priced for Growth` (above 2 — a rich multiple the growth has to justify).
 */
export type ValuationVerdict =
  | 'Cheap for Growth'
  | 'Fairly Priced'
  | 'Priced for Growth'

/**
 * PEG tiers, cheapest-first, by ceiling. Under 1.0 the multiple is low relative to
 * the growth it rests on; 1–2 is a fair balance; above 2 the price runs ahead of the
 * growth. A rough, non-sector-aware guide (and only as good as trailing EPS growth —
 * meaningless when earnings shrank, which is why PEG is null there).
 */
export const PEG_TIERS: { verdict: ValuationVerdict; ceiling: number }[] = [
  { verdict: 'Cheap for Growth', ceiling: 1 },
  { verdict: 'Fairly Priced', ceiling: 2 },
]

/**
 * The valuation-for-growth verdict for a PEG ratio, or null when unknown or
 * non-positive (a non-positive PEG means a trailing loss or shrinking earnings, where
 * the ratio has no meaning).
 */
export function valuationVerdict(peg: number | null): ValuationVerdict | null {
  if (peg == null || peg <= 0) return null
  for (const tier of PEG_TIERS) {
    if (peg <= tier.ceiling) return tier.verdict
  }
  return 'Priced for Growth'
}

/**
 * Which way today's options flow leans, from the put/call ratio: `optimistic`
 * (calls dominate — upside bets), `protective` (puts dominate — downside
 * cover), or `balanced` in the narrow band around parity.
 */
export type OptionsSentiment = 'optimistic' | 'balanced' | 'protective'

/**
 * Half-width of the "balanced" band around a put/call ratio of 1. A ratio
 * within ±0.05 of parity is too close to call either way, so it reads as
 * balanced rather than flipping label on noise.
 */
export const PCR_BALANCED_MARGIN = 0.05

/**
 * Map a put/call ratio to a sentiment lean. Below the balanced band calls
 * dominate (optimistic); above it puts dominate (protective). Returns null
 * when there's no ratio to judge.
 */
export function optionsSentiment(
  putCallRatio: number | null,
): OptionsSentiment | null {
  if (putCallRatio == null) return null
  if (putCallRatio < 1 - PCR_BALANCED_MARGIN) return 'optimistic'
  if (putCallRatio > 1 + PCR_BALANCED_MARGIN) return 'protective'
  return 'balanced'
}

/**
 * Where an options figure sits on its scale — `low`, the unremarkable `mid`,
 * or `high`. Drives the traffic-light colouring on the options card: low reads
 * green (calm / small / cheap), mid amber, high red (wild / big / pricey).
 */
export type OptionsLevel = 'low' | 'mid' | 'high'

/** The options-card figures that get a low/mid/high read (the put/call ratio
 *  is judged separately, by `optionsSentiment`). */
export type OptionsGauge =
  | 'implied_volatility'
  | 'expected_move'
  | 'insurance_cost'

/**
 * Low/high cut-offs per options gauge: below `lowBelow` is `low`, above
 * `highAbove` is `high`, between (edges inclusive) is `mid`. Broad large-cap,
 * roughly-one-month rules of thumb — NOT symbol-aware (a sleepy utility and a
 * meme stock live on very different scales), so the card frames the colour as
 * a rough guide, not advice.
 *
 * - implied_volatility: under 20% annualized is a calm large-cap, over 40%
 *   prices in real turbulence.
 * - expected_move: an under-4% swing priced into ~a month is small; over 8%
 *   is a big month by blue-chip standards.
 * - insurance_cost: an ATM put under 3% of spot for the quarter is cheap
 *   cover; over 6% the market charges real money for protection.
 */
export const OPTIONS_LEVEL_BANDS: Record<
  OptionsGauge,
  { lowBelow: number; highAbove: number }
> = {
  implied_volatility: { lowBelow: 20, highAbove: 40 },
  expected_move: { lowBelow: 4, highAbove: 8 },
  insurance_cost: { lowBelow: 3, highAbove: 6 },
}

/**
 * Grade one options figure against its gauge's bands (see
 * OPTIONS_LEVEL_BANDS). Returns null when there's no figure to judge.
 */
export function optionsLevel(
  gauge: OptionsGauge,
  n: number | null,
): OptionsLevel | null {
  if (n == null) return null
  const { lowBelow, highAbove } = OPTIONS_LEVEL_BANDS[gauge]
  if (n < lowBelow) return 'low'
  if (n > highAbove) return 'high'
  return 'mid'
}

/**
 * A five-step long/short call read off the options flow, most to least
 * bullish. Deliberately the "Go / Lean" vocabulary rather than RSI's
 * Buy/Sell so the two cards never read as the same signal — this one follows
 * where option traders' money is going today, nothing about price levels.
 */
export type OptionsSignal =
  | 'Go Long'
  | 'Lean Long'
  | 'Neutral'
  | 'Lean Short'
  | 'Go Short'

/**
 * Put/call cut-offs for the strong calls, either side of the balanced band
 * (PCR_BALANCED_MARGIN). Below 0.7 calls outnumber puts ~3:2 or better — a
 * decisive bullish tilt in today's flow — and the mirror ratio above 1.4
 * (1/0.7) is a decisively protective book. Between a strong edge and the
 * balanced band the flow leans without conviction, so the call softens to
 * "Lean". Follow-the-flow rules of thumb, NOT contrarian and NOT symbol-aware
 * — the card frames it as a rough guide, not advice.
 */
export const PCR_STRONG_LONG = 0.7
export const PCR_STRONG_SHORT = 1.4

/**
 * Map a put/call ratio to a long/short call. Follows the flow: heavy call
 * buying reads long, heavy put buying short, the balanced band around parity
 * neutral, with the strong edges reserved for a decisive tilt (the cut-off
 * values themselves count as the softer "Lean"). Returns null when there's no
 * ratio to judge.
 */
export function optionsSignal(
  putCallRatio: number | null,
): OptionsSignal | null {
  if (putCallRatio == null) return null
  if (putCallRatio < PCR_STRONG_LONG) return 'Go Long'
  if (putCallRatio < 1 - PCR_BALANCED_MARGIN) return 'Lean Long'
  if (putCallRatio <= 1 + PCR_BALANCED_MARGIN) return 'Neutral'
  if (putCallRatio <= PCR_STRONG_SHORT) return 'Lean Short'
  return 'Go Short'
}

/** How far back a chart reaches. Doubles as the API `range` query value. */
export const CHART_RANGES = [
  '1D',
  '7D',
  '1M',
  '3M',
  '6M',
  '1Y',
  '2Y',
  '5Y',
  '10Y',
  'YTD',
  'MAX',
] as const
export type ChartRange = (typeof CHART_RANGES)[number]

/** Candle granularity accepted by the API `timeframe` query value. */
export type Timeframe =
  | '1Min'
  | '5Min'
  | '15Min'
  | '30Min'
  | '1Hour'
  | '4Hour'
  | '1Day'
  | '1Week'
  | '1Month'

/**
 * A sensible candle granularity for a given range, chosen so each chart shows
 * enough bars to read the shape without smearing — from ~40 at the short end up
 * to a few hundred for a decade of weeklies.
 */
export function defaultTimeframe(range: ChartRange): Timeframe {
  switch (range) {
    case '1D':
      return '5Min'
    case '7D':
      return '15Min'
    case '1M':
      return '4Hour'
    case '3M':
    case '6M':
    case '1Y':
    case 'YTD':
      return '1Day'
    case '2Y':
    case '5Y':
    case '10Y':
      return '1Week'
    case 'MAX':
      return '1Month'
  }
}

/** Thrown when the API responds with a non-2xx status. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// Baked in at build time (see VITE_API_URL). In dev there's no VITE_API_URL, so
// we fall back to a relative "/api" prefix that the Vite dev server proxies to
// the real API (see vite.config.ts). That keeps dev requests same-origin and
// sidesteps CORS, with no extra setup.
const API_BASE = import.meta.env.VITE_API_URL || '/api'

/** URL of the company logo image (PNG) for a ticker symbol. */
export function stockLogoUrl(symbol: string): string {
  return `${API_BASE}/stocks/${encodeURIComponent(symbol)}/logo`
}

/** Turn a non-2xx response into an ApiError carrying the server's `detail`. */
async function toApiError(res: Response): Promise<ApiError> {
  let detail = `Request failed (${res.status})`
  try {
    const body = (await res.json()) as { detail?: string }
    if (body?.detail) detail = body.detail
  } catch {
    // Non-JSON error body — keep the default message.
  }
  return new ApiError(res.status, detail)
}

/**
 * A ticker's asset type from the lightweight classifier (`GET
 * /stocks/type/{ticker}`) — `etf` for a screened fund, else `equity`. One cheap
 * DB membership check, no quote or fundamentals; the Search page uses it to pick
 * which detail to render before fetching it.
 */
export interface TickerType {
  ticker: string
  asset_type: AssetType
}

/**
 * Classify a ticker as an equity or an ETF (`GET /stocks/type/{ticker}`) without
 * pulling its whole card. Never 404s for a real symbol (an unknown ticker reads
 * as an equity); a malformed symbol throws an `ApiError` 400.
 */
export async function getTickerType(
  ticker: string,
  signal?: AbortSignal,
): Promise<TickerType> {
  const res = await fetch(
    `${API_BASE}/stocks/type/${encodeURIComponent(ticker)}`,
    { signal },
  )
  if (!res.ok) throw await toApiError(res)
  return (await res.json()) as TickerType
}

/**
 * Fetch the quote card for one ticker (`/stocks/ticker/{ticker}`). Pass
 * `include` to attach the opt-in blocks — an unrequested block comes back
 * null and costs the backend no upstream call.
 */
export async function getTickerCard(
  ticker: string,
  opts: { include?: TickerCardInclude[]; signal?: AbortSignal } = {},
): Promise<TickerCard> {
  const include = opts.include?.length
    ? `?include=${opts.include.join(',')}`
    : ''
  const res = await fetch(
    `${API_BASE}/stocks/ticker/${encodeURIComponent(ticker)}${include}`,
    { signal: opts.signal },
  )
  if (!res.ok) throw await toApiError(res)
  return (await res.json()) as TickerCard
}

/**
 * Fetch several ticker cards concurrently, preserving the order of `tickers`.
 * A ticker that fails (bad symbol, network blip) resolves to `null` instead of
 * rejecting the whole batch, so one dud never blanks the rest of the row.
 */
export async function getTickerCards(
  tickers: string[],
  opts: { include?: TickerCardInclude[]; signal?: AbortSignal } = {},
): Promise<(TickerCard | null)[]> {
  return Promise.all(
    tickers.map((t) => getTickerCard(t, opts).catch(() => null)),
  )
}

/** One point on a stock's trailing-P/E history: the P/E at a past earnings release. */
export interface PeHistoryPoint {
  /** The announcement date the P/E is anchored on (ISO `yyyy-mm-dd`). */
  date: string
  /** The close on/near that date. */
  price: number
  /** The trailing-twelve-month reported EPS the market knew then. */
  ttm_eps: number
  /** `price / ttm_eps` — the trailing multiple at that release. */
  pe: number
}

/** A stock's trailing P/E over time — one point per reported quarter, oldest first. */
export interface PeHistory {
  ticker: string
  /** Number of points (may be fewer than the reported quarters). */
  count: number
  points: PeHistoryPoint[]
}

/**
 * A stock's trailing-P/E history (`GET /stocks/ticker/{ticker}/pe-history`) — the
 * closing price at each past earnings release over the trailing-twelve-month
 * reported EPS then known, the backward-looking companion to the card's live
 * `metrics.pe`. Best-effort on the backend: an uncovered or upstream-blocked symbol
 * comes back with an empty `points` (a 200, not a 404), so the card self-hides.
 */
export async function getPeHistory(
  ticker: string,
  signal?: AbortSignal,
): Promise<PeHistory> {
  const res = await fetch(
    `${API_BASE}/stocks/ticker/${encodeURIComponent(ticker)}/pe-history`,
    { signal },
  )
  if (!res.ok) throw await toApiError(res)
  return (await res.json()) as PeHistory
}

/**
 * A stock's options-flow read for one expiration
 * (`GET /stocks/ticker/{ticker}/options`). Pass `expiration` (a listed
 * `YYYY-MM-DD`) to switch expiries; omit it for the nearest upcoming. Best-effort
 * on the backend: a symbol with no listed options comes back with a null
 * `expiration`/`summary` and empty lists (a 200, not a 404), so the card
 * self-hides; a blocked upstream fetch is a 502.
 */
export async function getOptionsFlow(
  ticker: string,
  opts: { expiration?: string; signal?: AbortSignal } = {},
): Promise<OptionsFlow> {
  const qs = opts.expiration
    ? `?expiration=${encodeURIComponent(opts.expiration)}`
    : ''
  const res = await fetch(
    `${API_BASE}/stocks/ticker/${encodeURIComponent(ticker)}/options${qs}`,
    { signal: opts.signal },
  )
  if (!res.ok) throw await toApiError(res)
  return (await res.json()) as OptionsFlow
}

/** Fetch the day's snapshot for every tracked market sector. */
export async function getSectors(signal?: AbortSignal): Promise<Sector[]> {
  const res = await fetch(`${API_BASE}/sectors`, { signal })
  if (!res.ok) throw await toApiError(res)
  const data = (await res.json()) as SectorsResponse
  if (!Array.isArray(data?.sectors)) {
    throw new ApiError(res.status, 'Malformed sectors response')
  }
  return data.sectors
}

// ---------------------------------------------------------------------------
// US Treasury yield curve (GET /market/yield-curve + /market/yield-history)
// ---------------------------------------------------------------------------

/** One maturity point on the par-yield curve. `months` is the tenor in months
 *  (1, 24, 120…) for ordering; `label` is the display tenor ("1M", "2Y", "10Y");
 *  `rate` is the annualized yield in percent. */
export interface YieldTenor {
  label: string
  months: number
  rate: number
}

/** The current US Treasury par-yield curve snapshot (`GET /market/yield-curve`)
 *  — one yield per maturity, shortest-first. `spread_2s10s` is 10Y − 2Y in
 *  percentage points (negative = inverted); `as_of` dates the reading. */
export interface YieldCurve {
  as_of: string
  two_year: number | null
  ten_year: number | null
  spread_2s10s: number | null
  is_inverted: boolean | null
  count: number
  tenors: YieldTenor[]
}

/** One maturity's yield on one date. `date` is an ISO `yyyy-mm-dd`. */
export interface YieldObservation {
  date: string
  rate: number
}

/** One maturity's yield over time (e.g. the 2Y), oldest observation first. */
export interface YieldSeries {
  label: string
  observations: YieldObservation[]
}

/** The 2Y/10Y yield history (`GET /market/yield-history`) plus the derived
 *  10Y−2Y spread series; the point the spread crosses below zero is where the
 *  curve inverts. */
export interface YieldHistory {
  latest_spread: number | null
  is_inverted: boolean | null
  series: YieldSeries[]
  spread: YieldObservation[]
}

/** The shape of the curve, from the 2s10s spread — the label the explainer
 *  keys its plain-English reading on. */
export type CurveShape = 'normal' | 'flat' | 'inverted'

/** Classify the curve from its 10Y−2Y spread (percentage points). A tiny band
 *  around zero reads as "flat" rather than pretending a 3bp gap has a slope. */
export function curveShape(spread: number | null | undefined): CurveShape {
  if (spread == null) return 'flat'
  if (spread < 0) return 'inverted'
  if (spread < 0.15) return 'flat'
  return 'normal'
}

/** Fetch the current US Treasury par-yield curve snapshot. */
export async function getYieldCurve(signal?: AbortSignal): Promise<YieldCurve> {
  const res = await fetch(`${API_BASE}/market/yield-curve`, { signal })
  if (!res.ok) throw await toApiError(res)
  const data = (await res.json()) as YieldCurve
  if (!Array.isArray(data?.tenors)) {
    throw new ApiError(res.status, 'Malformed yield curve response')
  }
  return data
}

/** Fetch the 2Y/10Y Treasury yield history (default ~3 years). */
export async function getYieldHistory(
  signal?: AbortSignal,
): Promise<YieldHistory> {
  const res = await fetch(`${API_BASE}/market/yield-history`, { signal })
  if (!res.ok) throw await toApiError(res)
  const data = (await res.json()) as YieldHistory
  if (!Array.isArray(data?.series)) {
    throw new ApiError(res.status, 'Malformed yield history response')
  }
  return data
}

/** Fetch the AI read of today's sectors (which are leading and which lagging). */
export async function getSectorAnalysis(
  signal?: AbortSignal,
): Promise<SectorAnalysis> {
  const res = await fetch(`${API_BASE}/sectors/analysis`, { signal })
  if (!res.ok) throw await toApiError(res)
  return (await res.json()) as SectorAnalysis
}

/** Fetch the AI overview of how the US market moved over the year/month/week. */
export async function getMarketSummary(
  signal?: AbortSignal,
): Promise<MarketSummary> {
  const res = await fetch(`${API_BASE}/market/summary`, { signal })
  if (!res.ok) throw await toApiError(res)
  return (await res.json()) as MarketSummary
}

// ---------------------------------------------------------------------------
// Market sentiment (GET /market/sentiment) — VIX + CNN Fear & Greed, one payload
// ---------------------------------------------------------------------------

/** The VIX (CBOE volatility index) close. `regime` is a volatility band —
 *  low / normal / elevated / high / extreme. `change` is day-over-day points;
 *  `as_of` dates the reading (an end-of-day close, so it may lag ~1 day). */
export interface VixSnapshot {
  as_of: string
  value: number
  previous_close: number | null
  change: number | null
  change_percent: number | null
  regime: string
}

/** The CNN Fear & Greed score (0–100, higher = greedier). `band` is the
 *  canonical key (extreme_fear…extreme_greed), `label` its display form, and
 *  `rating` is CNN's own word. The `previous_*` values are the score at each
 *  trailing horizon, for a then-vs-now read. */
export interface FearGreedSnapshot {
  score: number
  as_of: string
  rating: string
  band: string
  label: string
  previous_close: number | null
  previous_1_week: number | null
  previous_1_month: number | null
  previous_1_year: number | null
}

/** The combined home-page read. Either leg may be `null` when its source is
 *  briefly unavailable — the widget shows whichever it has. */
export interface MarketSentiment {
  vix: VixSnapshot | null
  fear_greed: FearGreedSnapshot | null
}

/** Fetch the VIX + CNN Fear & Greed read for the home-page sentiment widget. */
export async function getMarketSentiment(
  signal?: AbortSignal,
): Promise<MarketSentiment> {
  const res = await fetch(`${API_BASE}/market/sentiment`, { signal })
  if (!res.ok) throw await toApiError(res)
  return (await res.json()) as MarketSentiment
}

/** Index universe the screener can narrow to. */
export type StockIndex = 'sp500' | 'nasdaq100'

/** One stock tile in the heat map: sized by `market_cap`, coloured by its return over
 *  the selected timeframe. `change_percent` is the day's move (null = no live quote today
 *  → an uncoloured tile); `performance` carries the trailing windows (1W…1Y, YTD) the
 *  timeframe selector colours by, and is absent/null when the backend fetched no history
 *  (or hasn't shipped the field yet — the board falls back to the day move). */
export interface HeatMapStock {
  ticker: string
  name: string | null
  market_cap: number
  change_percent: number | null
  performance?: StockPerformance | null
}

/** An industry group within a sector — its stocks and their combined cap.
 *  `industry` is null for a sector's not-yet-classified names. */
export interface HeatMapIndustry {
  industry: string | null
  market_cap: number
  stocks: HeatMapStock[]
}

/** A sector group — its industry sub-groups and their combined cap. */
export interface HeatMapSector {
  sector: string
  market_cap: number
  industries: HeatMapIndustry[]
}

/** The whole board: which index it covers, the tile count, and the sector tree
 *  (largest sector first). Structure + tile size come from the stored universe;
 *  the colours are live quotes, so a tile with no quote today is left null. */
export interface HeatMap {
  scope: string
  count: number
  sectors: HeatMapSector[]
}

/**
 * Fetch the market heat map for an index (`GET /market/heatmap`). A Finviz-style
 * treemap: every stock a tile sized by market cap and coloured by the day's move,
 * grouped sector → industry → stock. Defaults to the S&P 500.
 */
export async function getHeatMap(
  index: StockIndex = 'sp500',
  signal?: AbortSignal,
): Promise<HeatMap> {
  const res = await fetch(`${API_BASE}/market/heatmap?index=${index}`, {
    signal,
  })
  if (!res.ok) throw await toApiError(res)
  return (await res.json()) as HeatMap
}

/**
 * A heat-map tile's return over one timeframe window — the value that sizes the tile's
 * colour and prints under its ticker. `1D` reads the live day move (`change_percent`);
 * every other window reads the trailing `performance` block. Null when that window has no
 * data (no live quote for `1D`, or no history / a backend that predates the `performance`
 * field for the rest) — the tile then renders neutral. The window ladder is shared with
 * the sector board (`SECTOR_WINDOWS`), so both controls read the same keys.
 */
export function heatMapReturn(
  stock: HeatMapStock,
  key: SectorWindow,
): number | null {
  return key === '1d'
    ? stock.change_percent
    : (stock.performance?.[key] ?? null)
}

/** One name in the screener's gainers/losers lists. */
export interface ScreenedStock {
  symbol: string
  name: string | null
  sector: string | null
  price: number
  change: number | null
  change_percent: number | null
  previous_close: number | null
  as_of: string | null
}

/**
 * Screener payload: the top gainers and losers for the chosen filters, plus
 * counts describing how big the matched universe was and how much of it had a
 * usable quote.
 */
export interface ScreenerResult {
  index: string | null
  sector: string | null
  limit: number
  universe_count: number
  quoted_count: number
  as_of: string | null
  gainers: ScreenedStock[]
  losers: ScreenedStock[]
}

/** Index filter options for the screener, in display order. */
export const SCREENER_INDICES: { value: StockIndex; label: string }[] = [
  { value: 'sp500', label: 'S&P 500' },
  { value: 'nasdaq100', label: 'Nasdaq 100' },
]

/**
 * The 11 GICS sectors the screener accepts as its `sector` filter (matching is
 * case-insensitive). These are the official GICS names — note "Information
 * Technology" and "Health Care" — not the SPDR ETF labels used elsewhere.
 */
export const GICS_SECTORS = [
  'Information Technology',
  'Health Care',
  'Financials',
  'Consumer Discretionary',
  'Consumer Staples',
  'Communication Services',
  'Industrials',
  'Energy',
  'Utilities',
  'Real Estate',
  'Materials',
] as const

/**
 * Fetch the screener's top gainers and losers. `index`/`sector` narrow the
 * universe (omit either for everything); `limit` is how many names per side,
 * clamped by the API to 1–50.
 */
export async function getScreener(
  opts: {
    index?: StockIndex | null
    sector?: string | null
    limit?: number
    signal?: AbortSignal
  } = {},
): Promise<ScreenerResult> {
  const qs = new URLSearchParams()
  if (opts.index) qs.set('index', opts.index)
  if (opts.sector) qs.set('sector', opts.sector)
  if (opts.limit != null) qs.set('limit', String(opts.limit))
  const res = await fetch(`${API_BASE}/stocks/screener?${qs}`, {
    signal: opts.signal,
  })
  if (!res.ok) throw await toApiError(res)
  const data = (await res.json()) as ScreenerResult
  if (!Array.isArray(data?.gainers) || !Array.isArray(data?.losers)) {
    throw new ApiError(res.status, 'Malformed screener response')
  }
  return data
}

// A few vendor slugs don't follow the underscore convention, so the generic
// split-and-title-case would mangle them (Yahoo's fund sector keys, e.g.
// `realestate` → "Realestate"). Map those explicitly.
const CLASSIFICATION_ALIASES: Record<string, string> = {
  realestate: 'Real Estate',
}

/**
 * Turn a backend snake_case classification slug into a display label —
 * `"consumer_electronics"` → `"Consumer Electronics"`. Words split on
 * underscores and title-cased; anything already spaced passes through. A few
 * non-underscore vendor slugs are aliased first (see `CLASSIFICATION_ALIASES`).
 * Used for the universe screener's sector/industry menus and rows, the stock
 * card, and the ETF sector-weighting breakdown.
 */
export function humanizeClassification(slug: string): string {
  const alias = CLASSIFICATION_ALIASES[slug.toLowerCase()]
  if (alias) return alias
  return slug
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/**
 * A per-industry trailing-P/E benchmark (`GET /stocks/industries/{industry}/pe`)
 * over the screened universe — the median multiple its peers trade on plus the
 * interquartile range (`p25_pe`/`p75_pe`, the middle-half band) and the peer
 * `count`. It's the anchor that turns one stock's P/E from an absolute number
 * into a relative one. All three stats are null when `count` is 0 (an unknown
 * industry, or none of its members valued yet); `industry` echoes the normalized
 * slug.
 */
export interface IndustryValuation {
  industry: string
  count: number
  median_pe: number | null
  p25_pe: number | null
  p75_pe: number | null
}

/**
 * The smallest peer sample an industry benchmark can rest on and still stand
 * for the *industry* rather than one or two companies — sole-peer industries
 * exist in the live universe, where the "median" is just that stock's own
 * multiple. Below this the card self-hides: a median over a couple of names is
 * noise, not an anchor. Mirrors the backend's
 * `IndustryValuation.MIN_REPRESENTATIVE_PEERS` gate on the AI-analysis context.
 */
export const MIN_INDUSTRY_PEERS = 5

/** Where a stock's trailing P/E sits versus its industry's median. */
export type IndustryPeStance = 'below' | 'in_line' | 'above'

/**
 * Grade a stock's trailing P/E against its industry median: `below`
 * (meaningfully cheaper), `above` (meaningfully pricier), or `in_line` within a
 * ±10% dead-band that keeps small gaps from reading as a signal. Null when
 * either figure is missing or non-positive — there's no gradeable comparison
 * without two positive multiples.
 */
export function industryPeStance(
  stockPe: number | null,
  medianPe: number | null,
): IndustryPeStance | null {
  if (stockPe == null || medianPe == null || stockPe <= 0 || medianPe <= 0) {
    return null
  }
  const ratio = stockPe / medianPe
  if (ratio <= 0.9) return 'below'
  if (ratio >= 1.1) return 'above'
  return 'in_line'
}

/**
 * The industry P/E benchmark for a symbol's own industry. Best-effort on the
 * backend: an unscreened/unclassified symbol, or an industry with no valued
 * peers, comes back with `count: 0` and null stats (a 200, not a 404). Throws an
 * `ApiError` 400 only on a blank/malformed industry.
 */
export async function getIndustryValuation(
  industry: string,
  signal?: AbortSignal,
): Promise<IndustryValuation> {
  const res = await fetch(
    `${API_BASE}/stocks/industries/${encodeURIComponent(industry)}/pe`,
    { signal },
  )
  if (!res.ok) throw await toApiError(res)
  return (await res.json()) as IndustryValuation
}

/**
 * A sort key for the universe search — the column metrics (market cap, trailing
 * P/E, trailing revenue/EPS growth, and their forward FY1→FY2 analyst-consensus
 * counterparts) plus two server-computed blends that have no column of their own:
 * `growth` (the equal-weight blend of trailing revenue + EPS growth) and
 * `forward_growth` (the same blend of the forward pair), each ranking the fastest
 * all-round growers — realized or expected — from one control.
 */
export type StockSearchSort =
  | 'market_cap'
  | 'pe'
  | 'revenue_growth'
  | 'eps_growth'
  | 'growth'
  | 'forward_revenue_growth'
  | 'forward_eps_growth'
  | 'forward_growth'
/** Sort direction, shared by any sortable list. */
export type SortOrder = 'asc' | 'desc'

/**
 * A market-cap size bucket — the screener's `market_cap` tier filter. Mega ≥ $200B,
 * large $10–200B, mid $2–10B, small $250M–$2B (the API's half-open ranges; since the
 * universe floor is $1B, `small` surfaces the $1–2B slice).
 */
export type MarketCapTier = 'mega' | 'large' | 'mid' | 'small'

/**
 * One row of a universe search (`GET /stocks/ticker`) — the screened stock's
 * stored facts, with no live price (the search is a single DB read; open the row
 * for a live quote). `market_cap` is raw USD; `pe_ratio` is the trailing
 * price-to-earnings multiple (price over trailing EPS), null for a loss-maker or
 * an uncovered name; the two trailing `*_growth_yoy` are the latest reported
 * year-over-year growth and the two `forward_*_growth_yoy` their forward
 * (next fiscal year to the one after, analyst consensus) counterparts (all
 * percent, EPS on the analyst-consensus basis). `in_sp500`/`in_nasdaq100` are
 * definite booleans; everything else may be null until the enriching sync
 * reaches the stock — the forward pair the most often, since it needs two
 * upcoming years of estimates.
 */
export interface StockSearchResult {
  ticker: string
  name: string | null
  sector: string | null
  industry: string | null
  market_cap: number | null
  pe_ratio: number | null
  revenue_growth_yoy: number | null
  eps_growth_yoy: number | null
  forward_revenue_growth_yoy: number | null
  forward_eps_growth_yoy: number | null
  in_sp500: boolean
  in_nasdaq100: boolean
}

/**
 * A page of universe-search results plus the pagination envelope. `total` is the
 * full match count before the window (so the pager can size itself); `count` is
 * this page's row count; `limit`/`offset` echo the window the page was cut with.
 */
export interface StockSearchResponse {
  total: number
  limit: number
  offset: number
  count: number
  results: StockSearchResult[]
}

/**
 * Search/filter/sort the screened ≥$1B universe (`GET /stocks/ticker`). `q`
 * matches (case-insensitive substring) the company name OR ticker, so "NV"
 * surfaces Nvidia and NVDA; `sectors`/`industries` each take one or more
 * classification slugs (or raw labels — the API slugifies them) and match ANY of
 * them (an OR set), while the two axes AND together; `inSp500`/`inNasdaq100`
 * narrow to index members; `marketCaps` narrows to the union of one or more cap
 * tiers (mega/large/mid/small). `country` scopes to one listing market
 * (`us`/`ca`) — omit for every market; a value keeps a market-cap sort within one
 * currency (US in USD, Canada in CAD) and, on the Canadian side, hides the CDR /
 * dual-listing duplicates of US companies the API already flags. `sort` (default
 * market cap, a trailing or forward growth metric, or a `growth`/`forward_growth`
 * blend) and `order` (default desc) order the page; `limit`/`offset` window it.
 * Each filter is sent as a repeated query param (`?sector=a&sector=b`). Only
 * screened stocks are returned, so every row carries a market cap.
 */
export async function searchStocks(
  opts: {
    q?: string | null
    sectors?: string[] | null
    industries?: string[] | null
    inSp500?: boolean | null
    inNasdaq100?: boolean | null
    marketCaps?: MarketCapTier[] | null
    country?: string | null
    sort?: StockSearchSort
    order?: SortOrder
    limit?: number
    offset?: number
    signal?: AbortSignal
  } = {},
): Promise<StockSearchResponse> {
  const qs = new URLSearchParams()
  if (opts.q) qs.set('q', opts.q)
  for (const s of opts.sectors ?? []) qs.append('sector', s)
  for (const i of opts.industries ?? []) qs.append('industry', i)
  if (opts.inSp500) qs.set('in_sp500', 'true')
  if (opts.inNasdaq100) qs.set('in_nasdaq100', 'true')
  for (const t of opts.marketCaps ?? []) qs.append('market_cap', t)
  if (opts.country) qs.set('country', opts.country)
  if (opts.sort) qs.set('sort', opts.sort)
  if (opts.order) qs.set('order', opts.order)
  if (opts.limit != null) qs.set('limit', String(opts.limit))
  if (opts.offset != null) qs.set('offset', String(opts.offset))
  const res = await fetch(`${API_BASE}/stocks/ticker?${qs}`, {
    signal: opts.signal,
  })
  if (!res.ok) throw await toApiError(res)
  const data = (await res.json()) as StockSearchResponse
  if (!Array.isArray(data?.results)) {
    throw new ApiError(res.status, 'Malformed search response')
  }
  return data
}

/**
 * The filters an AI screen resolved a plain-English request into
 * (`GET /stocks/ai-search`) — echoed back so the UI can show what was applied and
 * let the user tweak it in the manual controls. Every field maps one-to-one onto a
 * manual screener control: `sectors`/`industries` are stored slugs, `market_cap_tiers`
 * the same tier strings, `sort`/`direction` the same sort keys. All optional/empty
 * when the request didn't call for them (an all-unset interpretation is a neutral
 * browse). Typed with the raw `string` unions the API can return; the caller validates
 * them against the known control values before applying.
 */
export interface AiScreenInterpretation {
  query: string | null
  sectors: string[]
  industries: string[]
  in_sp500: boolean | null
  in_nasdaq100: boolean | null
  market_cap_tiers: string[]
  sort: string | null
  direction: string
  limit: number | null
}

/**
 * The response to an AI screen (`GET /stocks/ai-search`): the AI's reading of the
 * request as a set of filters, for the UI to surface and apply to the manual controls
 * (which then run the ordinary universe search). The endpoint returns only this — it
 * doesn't run the search itself, so there is no result page here.
 */
export interface AiScreenResponse {
  interpreted: AiScreenInterpretation
}

/**
 * Screen the ≥$1B US universe from a plain-English request (`GET /stocks/ai-search`).
 * An AI translates `query` ("mega-cap technology stocks", "top S&P 500 names by
 * revenue growth") into the same filters `searchStocks` accepts. Returns just the
 * interpreted filters — apply them to the manual controls so the user sees and can edit
 * what was applied, and the ordinary search then fetches the rows. A blank query is a
 * 400; a translation failure (the model couldn't parse it) a 502.
 */
export async function aiSearchStocks(
  query: string,
  opts: { signal?: AbortSignal } = {},
): Promise<AiScreenResponse> {
  const qs = new URLSearchParams({ q: query })
  const res = await fetch(`${API_BASE}/stocks/ai-search?${qs}`, {
    signal: opts.signal,
  })
  if (!res.ok) throw await toApiError(res)
  const data = (await res.json()) as AiScreenResponse
  if (!data?.interpreted) {
    throw new ApiError(res.status, 'Malformed AI screen response')
  }
  return data
}

/**
 * The distinct sector and industry slugs present in the universe — the screener's
 * filter menus (`GET /stocks/classifications`). Two flat, sorted lists; feed a
 * chosen slug back to `searchStocks`, and humanize it for display with
 * `humanizeClassification`.
 */
export interface Classifications {
  sectors: string[]
  industries: string[]
}

/** Fetch the universe's distinct sector + industry slugs (the filter menus). */
export async function getClassifications(
  signal?: AbortSignal,
): Promise<Classifications> {
  const res = await fetch(`${API_BASE}/stocks/classifications`, { signal })
  if (!res.ok) throw await toApiError(res)
  const data = (await res.json()) as Classifications
  if (!Array.isArray(data?.sectors) || !Array.isArray(data?.industries)) {
    throw new ApiError(res.status, 'Malformed classifications response')
  }
  return data
}

/**
 * A sort key for the ETF universe search. Three columns rank a fund on a number:
 * `net_assets` (assets under management — the "top ETFs" default), `expense_ratio`
 * (the annual fee — pair with an ascending order for the cheapest first), and
 * `dividend_yield` (the trailing distribution yield — descending surfaces the
 * highest-income funds). Category is a filter, not a sort — it's a label, not a
 * magnitude.
 */
export type EtfSearchSort = 'net_assets' | 'expense_ratio' | 'dividend_yield'

/**
 * One row of an ETF universe search (`GET /stocks/etfs`) — the screened fund's
 * stored facts, with no live price (the search is a single DB read; open the row
 * for a live quote). `net_assets` is raw USD (assets under management, the ETF
 * analogue of a stock's market cap); `expense_ratio` is the annual fee as a
 * percent (`0.03` = 0.03%); `dividend_yield` is the trailing distribution yield
 * as a percent (`1.03` = 1.03%). `category` is the fund's snake_case Yahoo
 * category slug (e.g. `large_growth`). Everything but `ticker` may be null until
 * the sync enriches the fund (a non-distributing fund keeps a null yield).
 */
export interface EtfSearchResult {
  ticker: string
  name: string | null
  exchange: string | null
  net_assets: number | null
  expense_ratio: number | null
  category: string | null
  dividend_yield: number | null
}

/**
 * A page of ETF-search results plus the pagination envelope — the same shape as
 * the stock search (`total` is the full match count before the window, `count`
 * this page's row count, `limit`/`offset` echo the window the page was cut with).
 */
export interface EtfSearchResponse {
  total: number
  limit: number
  offset: number
  count: number
  results: EtfSearchResult[]
}

/**
 * Search/filter/sort the screened top US ETF universe (`GET /stocks/etfs`). `q`
 * matches (case-insensitive substring) the fund name OR ticker, so "gold"
 * surfaces gold-miner funds and "SPY" matches by ticker; `categories` takes one
 * or more category slugs (or raw labels — the API slugifies them) and matches ANY
 * of them (an OR set), each sent as a repeated `category` param. `sort` (default
 * net assets) and `order` (default desc) order the page; `limit`/`offset` window
 * it.
 */
export async function searchEtfs(
  opts: {
    q?: string | null
    categories?: string[] | null
    sort?: EtfSearchSort
    order?: SortOrder
    limit?: number
    offset?: number
    signal?: AbortSignal
  } = {},
): Promise<EtfSearchResponse> {
  const qs = new URLSearchParams()
  if (opts.q) qs.set('q', opts.q)
  for (const c of opts.categories ?? []) qs.append('category', c)
  if (opts.sort) qs.set('sort', opts.sort)
  if (opts.order) qs.set('order', opts.order)
  if (opts.limit != null) qs.set('limit', String(opts.limit))
  if (opts.offset != null) qs.set('offset', String(opts.offset))
  const res = await fetch(`${API_BASE}/stocks/etfs?${qs}`, {
    signal: opts.signal,
  })
  if (!res.ok) throw await toApiError(res)
  const data = (await res.json()) as EtfSearchResponse
  if (!Array.isArray(data?.results)) {
    throw new ApiError(res.status, 'Malformed ETF search response')
  }
  return data
}

/**
 * The distinct ETF category slugs present in the universe — the ETF screener's
 * category filter menu (`GET /stocks/etfs/categories`). One flat, sorted list;
 * feed a chosen slug back to `searchEtfs`, and humanize it for display with
 * `humanizeClassification`.
 */
export interface EtfCategories {
  categories: string[]
}

/** Fetch the ETF universe's distinct category slugs (the filter menu). */
export async function getEtfCategories(
  signal?: AbortSignal,
): Promise<EtfCategories> {
  const res = await fetch(`${API_BASE}/stocks/etfs/categories`, { signal })
  if (!res.ok) throw await toApiError(res)
  const data = (await res.json()) as EtfCategories
  if (!Array.isArray(data?.categories)) {
    throw new ApiError(res.status, 'Malformed ETF categories response')
  }
  return data
}

/**
 * The filters an AI ETF screen resolved a plain-English request into
 * (`GET /stocks/etfs/ai-search`) — the ETF sibling of {@link AiScreenInterpretation},
 * echoed back so the UI can show what was applied and let the user tweak it. Every field
 * maps one-to-one onto a manual ETF-screener control: `categories` are stored category
 * slugs, `sort`/`direction` the same sort keys. All optional/empty when the request didn't
 * call for them (an all-unset interpretation is a neutral browse). Typed with the raw
 * `string` unions the API can return; the caller validates them against the known control
 * values before applying.
 */
export interface AiEtfScreenInterpretation {
  query: string | null
  categories: string[]
  sort: string | null
  direction: string
  limit: number | null
}

/**
 * The response to an AI ETF screen (`GET /stocks/etfs/ai-search`): the AI's reading of the
 * request as a set of filters, for the UI to surface and apply to the manual controls
 * (which then run the ordinary ETF search). The endpoint returns only this — it doesn't run
 * the search itself, so there is no result page here.
 */
export interface AiEtfScreenResponse {
  interpreted: AiEtfScreenInterpretation
}

/**
 * Screen the top US ETF universe from a plain-English request (`GET /stocks/etfs/ai-search`).
 * An AI translates `query` ("cheap S&P 500 index funds", "high-yield dividend ETFs") into the
 * same filters `searchEtfs` accepts. Returns just the interpreted filters — apply them to the
 * manual controls so the user sees and can edit what was applied, and the ordinary search then
 * fetches the rows. A blank query is a 400; a translation failure (the model couldn't parse it)
 * a 502.
 */
export async function aiSearchEtfs(
  query: string,
  opts: { signal?: AbortSignal } = {},
): Promise<AiEtfScreenResponse> {
  const qs = new URLSearchParams({ q: query })
  const res = await fetch(`${API_BASE}/stocks/etfs/ai-search?${qs}`, {
    signal: opts.signal,
  })
  if (!res.ok) throw await toApiError(res)
  const data = (await res.json()) as AiEtfScreenResponse
  if (!data?.interpreted) {
    throw new ApiError(res.status, 'Malformed AI ETF screen response')
  }
  return data
}

/**
 * One line of a fund's portfolio: the held company's `ticker` and `name`, and
 * its `weight` as a percent of net assets (`7.89` = 7.89%). Any field is null
 * when the vendor omits it (an odd row can lack a `ticker`); link the ticker to
 * its own stock page when present.
 */
export interface EtfHolding {
  ticker: string | null
  name: string | null
  weight: number | null
}

/**
 * A fund's exposure to one GICS sector, as a percent of net assets (`39.13` =
 * 39.13%). `sector` is a snake_case slug (e.g. `technology`,
 * `financial_services`) — humanize it with `humanizeClassification`.
 */
export interface EtfSectorWeight {
  sector: string
  weight: number
}

/** Opt-in enrichment blocks the ETF detail endpoint can attach via `include`. */
export type EtfDetailInclude = 'metrics' | 'dividends' | 'performance'

/**
 * An ETF's size/cost metrics — the opt-in `metrics` block. `expense_ratio` is
 * the annual fee as a human percent (`0.03` = 0.03%); `nav` is the net asset
 * value per share; `net_assets` is assets under management in raw USD (the ETF
 * analogue of a stock's market cap). Any field the vendor/table doesn't carry is
 * null.
 */
export interface EtfMetrics {
  expense_ratio: number | null
  nav: number | null
  net_assets: number | null
}

/**
 * An ETF's distribution yield — the opt-in `dividends` block. `yield_percentage`
 * is the trailing distribution yield as a human percent (`1.03` = 1.03%); null
 * for a non-distributing fund or an uncovered field.
 */
export interface EtfDividends {
  yield_percentage: number | null
}

/**
 * An ETF's trailing returns — the opt-in `performance` block. The shared
 * `1w`–`1y` price-return windows (the same gains a stock shows) plus the two
 * longer horizons funds are judged on: `3y` / `5y`,
 * annualized average returns. Every figure is a human percent; a window or
 * horizon the vendor doesn't cover is null.
 */
export interface EtfPerformance extends StockPerformance {
  '3y': number | null
  '5y': number | null
}

/**
 * The per-fund detail from `GET /stocks/etf/{ticker}` — an ETF's live quote and
 * always-on fund profile (the stored `category`, plus best-effort `fund_family`,
 * `description`, `top_holdings` and `sector_weightings`), with the size/cost,
 * yield and trailing-return figures split into opt-in blocks requested via
 * `include`. Each block is null unless requested — and the best-effort ones stay
 * null when the vendor is down: `metrics` (expense ratio, NAV, net assets),
 * `dividends` (yield), and `performance` (the trailing returns). Every percent is
 * a human percent (`0.03` = 0.03%); the breakdowns are `[]` when unavailable. The
 * endpoint 404s for a ticker that isn't in the ETF universe.
 */
export interface EtfDetail {
  ticker: string
  name: string | null
  exchange: string | null
  asset_type: AssetType
  price: number
  change: number | null
  change_percent: number | null
  previous_close: number | null
  as_of: string | null
  category: string | null
  fund_family: string | null
  description: string | null
  top_holdings: EtfHolding[]
  sector_weightings: EtfSectorWeight[]
  metrics: EtfMetrics | null
  dividends: EtfDividends | null
  performance: EtfPerformance | null
}

/**
 * Fetch one fund's live detail (`GET /stocks/etf/{ticker}`). Pass `include` to
 * attach the opt-in blocks (`metrics` / `dividends` / `performance`) — an
 * unrequested block comes back null. Throws an `ApiError` with status 404 when
 * the ticker isn't a screened ETF — Search only hits this once a ticker is
 * classified as a fund, so it normally resolves.
 */
export async function getEtfDetail(
  ticker: string,
  opts: { include?: EtfDetailInclude[]; signal?: AbortSignal } = {},
): Promise<EtfDetail> {
  const include = opts.include?.length
    ? `?include=${opts.include.join(',')}`
    : ''
  const res = await fetch(
    `${API_BASE}/stocks/etf/${encodeURIComponent(ticker)}${include}`,
    { signal: opts.signal },
  )
  if (!res.ok) throw await toApiError(res)
  return (await res.json()) as EtfDetail
}

/**
 * Fetch several ETF detail cards concurrently, preserving the order of
 * `tickers` — the ETF analogue of `getTickerCards`. These back the price tiles,
 * which read only the quote fields, so no `include` blocks are requested (a tile
 * costs the backend no extra upstream call). A ticker that fails (not a screened
 * ETF, network blip) resolves to `null` instead of rejecting the whole batch, so
 * one dud never blanks the rest of the row.
 */
export async function getEtfCards(
  tickers: string[],
  opts: { signal?: AbortSignal } = {},
): Promise<(EtfDetail | null)[]> {
  return Promise.all(
    tickers.map((t) =>
      getEtfDetail(t, { signal: opts.signal }).catch(() => null),
    ),
  )
}

/** True for minute/hour bars — the granularities where extended-hours windows appear. */
const isIntradayTimeframe = (timeframe: string) => /Min|Hour/.test(timeframe)

/** Length of one intraday bar in minutes (e.g. `4Hour` → 240); 0 if not intraday. */
const intradayBarMinutes = (timeframe: string) => {
  const m = /^(\d+)(Min|Hour)$/.exec(timeframe)
  return m ? Number(m[1]) * (m[2] === 'Hour' ? 60 : 1) : 0
}

// One reusable ET wall-clock formatter (construction is the expensive part).
// h23 keeps midnight as "00"; the IANA zone tracks EST/EDT automatically.
const ET_CLOCK = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hourCycle: 'h23',
  hour: '2-digit',
  minute: '2-digit',
})

// The regular NYSE/Nasdaq session, in minutes-of-day ET.
const RTH_OPEN = 9 * 60 + 30 // 9:30 AM
const RTH_CLOSE = 16 * 60 // 4:00 PM

/**
 * Drop extended-hours bars from an intraday series; non-intraday series pass
 * through untouched. The API's bars come from Alpaca's IEX feed, which only
 * prints a bar for a window that saw an IEX trade — outside the regular
 * session that's sparse and ends at a different time per symbol (the 4 PM
 * closing auction never trades on IEX), so overlaid charts would trail off
 * raggedly. Clamping to the 9:30–4:00 ET session makes every intraday line
 * start and stop together.
 *
 * A bar is kept when its `[start, start + step)` window overlaps the session,
 * not merely when it *starts* inside it. That distinction only bites the coarse
 * bars: Alpaca grids 4-hour bars to 8:00 / 12:00 / 16:00 ET, so a start-only
 * test would drop the 8:00 bar — which opens pre-market yet still covers
 * 9:30–noon — and collapse the whole day to a lone afternoon candle. For the
 * 5/15/30-minute bars that sit flush inside the session the two tests agree, so
 * the last kept 5-minute bar is still the 3:55 PM one.
 */
export function clampToRegularHours(series: CandleSeries): CandleSeries {
  if (!isIntradayTimeframe(series.timeframe)) return series
  const step = intradayBarMinutes(series.timeframe)
  const candles = series.candles.filter((c) => {
    const [h, m] = ET_CLOCK.format(new Date(c.time * 1000)).split(':')
    const start = Number(h) * 60 + Number(m)
    return start < RTH_CLOSE && start + step > RTH_OPEN
  })
  return { ...series, candles, count: candles.length }
}

/**
 * Slice an intraday series down to its final session's bars. The regular
 * 9:30–4:00 ET session always sits inside a single UTC calendar day, so after
 * the regular-hours clamp a bar's UTC date identifies its session.
 */
export function lastSessionOnly(series: CandleSeries): CandleSeries {
  const last = series.candles[series.candles.length - 1]
  if (!last) return series
  const utcDay = (t: number) => Math.floor(t / 86_400)
  const candles = series.candles.filter(
    (c) => utcDay(c.time) === utcDay(last.time),
  )
  return { ...series, candles, count: candles.length }
}

/**
 * The `range=1D` fallback: on days with no session (market holidays, weekends,
 * pre-open mornings) the API has no bars for "today" and 404s. Pull the past
 * week of bars instead and keep only the most recent session's, so the chart
 * shows the last close rather than an error.
 */
async function getLastSessionCandles(
  symbol: string,
  timeframe: Timeframe,
  signal?: AbortSignal,
): Promise<CandleSeries> {
  const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const qs = new URLSearchParams({ timeframe, start })
  const res = await fetch(
    `${API_BASE}/stocks/ticker/${encodeURIComponent(symbol)}/candles?${qs}`,
    { signal },
  )
  if (!res.ok) throw await toApiError(res)
  const data = (await res.json()) as CandleSeries
  if (!Array.isArray(data?.candles)) {
    throw new ApiError(res.status, 'Malformed candle response')
  }
  const series = lastSessionOnly(clampToRegularHours(data))
  if (series.candles.length === 0) {
    throw new ApiError(404, `No recent candle data for '${symbol}'.`)
  }
  return series
}

/** Fetch the candlestick series for a ticker over a range/timeframe. */
export async function getCandles(
  symbol: string,
  opts: {
    range?: ChartRange
    timeframe?: Timeframe
    signal?: AbortSignal
  } = {},
): Promise<CandleSeries> {
  const range = opts.range ?? '6M'
  const timeframe = opts.timeframe ?? defaultTimeframe(range)
  const qs = new URLSearchParams({ timeframe })
  if (range === 'MAX') {
    // The API's `range=MAX` is degenerate (it returns a single candle, and 404s
    // outright for weekly/monthly bars). An explicit far-past `start` gets the
    // real series instead — the server clamps it to the earliest data it has.
    qs.set('start', '2000-01-01T00:00:00Z')
  } else if (range === '10Y') {
    // The API's `range` enum stops at 5Y, so a 10-year window comes from an
    // explicit start ten years back (the same trick as MAX; the server clamps
    // it to the earliest data it has).
    const start = new Date()
    start.setFullYear(start.getFullYear() - 10)
    qs.set('start', start.toISOString())
  } else {
    qs.set('range', range)
  }
  const res = await fetch(
    `${API_BASE}/stocks/ticker/${encodeURIComponent(symbol)}/candles?${qs}`,
    { signal: opts.signal },
  )
  if (!res.ok) {
    // `range=1D` means "today's session", which doesn't exist on closed days —
    // fall back to the most recent session instead of surfacing the 404.
    if (range === '1D' && res.status === 404) {
      return getLastSessionCandles(symbol, timeframe, opts.signal)
    }
    throw await toApiError(res)
  }
  const data = (await res.json()) as CandleSeries
  if (!Array.isArray(data?.candles)) {
    throw new ApiError(res.status, 'Malformed candle response')
  }
  return clampToRegularHours(data)
}

/**
 * Fetch the RSI series for a ticker. Defaults to the textbook setup — a 14-bar
 * window on daily candles over the last month — which is enough history to land
 * a current reading plus a short trend.
 */
export async function getRsi(
  symbol: string,
  opts: {
    range?: ChartRange
    timeframe?: Timeframe
    period?: number
    signal?: AbortSignal
  } = {},
): Promise<RsiSeries> {
  const timeframe = opts.timeframe ?? '1Day'
  const range = opts.range ?? '1M'
  const period = opts.period ?? 14
  const qs = new URLSearchParams({ timeframe, range, period: String(period) })
  const res = await fetch(
    `${API_BASE}/stocks/${encodeURIComponent(symbol)}/rsi?${qs}`,
    { signal: opts.signal },
  )
  if (!res.ok) throw await toApiError(res)
  const data = (await res.json()) as RsiSeries
  if (!Array.isArray(data?.points)) {
    throw new ApiError(res.status, 'Malformed RSI response')
  }
  return data
}

/**
 * Fetch detected support levels for a ticker. Defaults to a 1-year daily scan —
 * a fixed window independent of the chart's range, so the levels stay stable as
 * the user zooms and only the ones inside the visible price range get drawn.
 */
export async function getSupportLevels(
  symbol: string,
  opts: {
    range?: ChartRange
    timeframe?: Timeframe
    signal?: AbortSignal
  } = {},
): Promise<SupportLevels> {
  const timeframe = opts.timeframe ?? '1Day'
  const range = opts.range ?? '1Y'
  const qs = new URLSearchParams({ timeframe, range })
  const res = await fetch(
    `${API_BASE}/stocks/ticker/${encodeURIComponent(symbol)}/support-levels?${qs}`,
    { signal: opts.signal },
  )
  if (!res.ok) throw await toApiError(res)
  const data = (await res.json()) as SupportLevels
  if (!Array.isArray(data?.levels)) {
    throw new ApiError(res.status, 'Malformed support-levels response')
  }
  return data
}

/**
 * Fetch a ticker's short/long-term trend read (the direction at two EMA
 * horizons plus their combined reading). Defaults to a 1-year daily read with
 * the 20-period short vs 50-period long horizons; pass 50/200 for the classic
 * long-term read. Like support levels it's a fixed window independent of the
 * chart's range. Best-effort context: a caller treats a failure as "no read".
 */
export async function getStockTrend(
  symbol: string,
  opts: {
    range?: ChartRange
    timeframe?: Timeframe
    shortPeriod?: number
    longPeriod?: number
    signal?: AbortSignal
  } = {},
): Promise<StockTrend> {
  const timeframe = opts.timeframe ?? '1Day'
  const range = opts.range ?? '1Y'
  const qs = new URLSearchParams({ timeframe, range })
  if (opts.shortPeriod) qs.set('short_period', String(opts.shortPeriod))
  if (opts.longPeriod) qs.set('long_period', String(opts.longPeriod))
  const res = await fetch(
    `${API_BASE}/stocks/ticker/${encodeURIComponent(symbol)}/trend?${qs}`,
    { signal: opts.signal },
  )
  if (!res.ok) throw await toApiError(res)
  const data = (await res.json()) as StockTrend
  if (typeof data?.reading !== 'string') {
    throw new ApiError(res.status, 'Malformed trend response')
  }
  return data
}

/**
 * The default EMA overlay: the 9 / 21 / 50 fast/intermediate moving averages plus
 * the 200-period long-term line (drawn as the neutral trend baseline). The backend
 * warms the 200 from history before the visible window, so it appears on any range.
 */
export const DEFAULT_EMA_PERIODS = [9, 21, 50, 200] as const

/**
 * Fetch the EMA overlay for a ticker. Mirrors `getCandles`' window handling
 * (same `range` → same `timeframe` → same bars), so every EMA point shares a
 * `time` with a candle and the lines register exactly under the price. One or
 * more `periods` come back as their own lines; a deep period (200) only appears
 * once the range carries enough history to warm it up. Best-effort on the chart:
 * a caller treats a failure as "no overlay", never a broken price chart.
 */
export async function getEma(
  symbol: string,
  opts: {
    range?: ChartRange
    timeframe?: Timeframe
    periods?: readonly number[]
    signal?: AbortSignal
  } = {},
): Promise<EmaSeries> {
  const range = opts.range ?? '6M'
  const timeframe = opts.timeframe ?? defaultTimeframe(range)
  const periods = opts.periods ?? DEFAULT_EMA_PERIODS
  const qs = new URLSearchParams({ timeframe })
  for (const p of periods) qs.append('period', String(p))
  // Match getCandles' window handling so the EMA points share the candles' bars.
  if (range === 'MAX') {
    qs.set('start', '2000-01-01T00:00:00Z')
  } else if (range === '10Y') {
    const start = new Date()
    start.setFullYear(start.getFullYear() - 10)
    qs.set('start', start.toISOString())
  } else {
    qs.set('range', range)
  }
  const res = await fetch(
    `${API_BASE}/stocks/ticker/${encodeURIComponent(symbol)}/ema?${qs}`,
    { signal: opts.signal },
  )
  if (!res.ok) throw await toApiError(res)
  const data = (await res.json()) as EmaSeries
  if (!Array.isArray(data?.lines)) {
    throw new ApiError(res.status, 'Malformed EMA response')
  }
  return data
}

/**
 * One quarter's reported EPS versus the consensus estimate going in. `beat` is
 * the met-or-beat flag (`actual >= estimate`), null when either side is
 * missing; `surprise` is the EPS gap and `surprise_percent` that gap as a
 * percent of the estimate. `fiscal_year`/`fiscal_quarter` name the period.
 */
export interface EarningsSurprise {
  period: string | null
  fiscal_year: number | null
  fiscal_quarter: number | null
  actual: number | null
  estimate: number | null
  surprise: number | null
  surprise_percent: number | null
  beat: boolean | null
  // Revenue actually reported for the quarter (raw, e.g. USD), from SEC EDGAR;
  // best-effort, so null when the filing isn't covered. There's no consensus
  // revenue *estimate* — that's licensed analyst data the API doesn't source.
  revenue_actual?: number | null
}

/**
 * The next scheduled earnings report and the consensus going into it — the
 * forward complement to the past-only beat history. `report_date` is the
 * expected announcement date (ISO); `session` is when in the trading day it's
 * expected (`bmo` before open, `amc` after close, `dmh` during hours, or null).
 * Estimates are null when no consensus is published yet.
 */
export interface NextEarnings {
  report_date: string | null
  fiscal_year: number | null
  fiscal_quarter: number | null
  eps_estimate: number | null
  revenue_estimate: number | null
  session: string | null
}

/**
 * The earnings card's view-model: recent quarterly earnings surprises (newest
 * first) plus a beat summary. Assembled by `quarterlyToEarningsHistory` from
 * `/earnings/quarterly` and the stock snapshot — no longer fetched from an
 * endpoint of its own. `beat_rate` is the percent of *scored* quarters (those
 * with both an actual and an estimate) that met or beat; `scored` is how many
 * of `count` quarters could be scored, `beats` how many of those cleared the
 * bar. `next_report` is the next scheduled report's consensus.
 */
export interface EarningsHistory {
  symbol: string
  count: number
  beats: number
  scored: number
  beat_rate: number | null
  quarters: EarningsSurprise[]
  next_report?: NextEarnings | null
}

/**
 * A plain-language read on how dependable a company's results are, from the
 * share of recent quarters that met or beat consensus (`beat_rate`, 0–100):
 * `reliable` clears the bar most quarters, `mixed` is hit-or-miss, `shaky`
 * falls short more often than not. Drives the earnings summary's wording and
 * colour so the track record reads at a glance. Broad rule of thumb over a
 * short run of quarters, not a forecast. Null when no quarter could be scored.
 */
export type BeatConsistency = 'reliable' | 'mixed' | 'shaky'

/** Map a beat rate (percent of scored quarters that met/beat) to a consistency
 *  call. ≥ 60% reads reliable, 40–60% mixed, below 40% shaky; null passes
 *  through (no scored quarters to judge). */
export function beatConsistency(
  beatRate: number | null,
): BeatConsistency | null {
  if (beatRate == null) return null
  if (beatRate >= 60) return 'reliable'
  if (beatRate >= 40) return 'mixed'
  return 'shaky'
}

/**
 * One quarter from the consolidated quarterly-earnings series — reported and
 * upcoming quarters in a single list. A reported quarter (`is_reported`) carries
 * the actual EPS/revenue and the surprise vs. the consensus going in; an
 * upcoming one carries the forward estimates (`eps_estimate`/`revenue_estimate`)
 * with actuals null. `period_end` is the fiscal period's last day, `report_date`
 * the (expected) announcement date; `beat` is the met-or-beat flag, null until
 * the quarter reports. Unlike the older beat history, this DOES serve a forward
 * `revenue_estimate` for the scheduled quarters.
 */
export interface QuarterlyEarningsQuarter {
  fiscal_year: number | null
  fiscal_quarter: number | null
  period_end: string | null
  report_date: string | null
  eps_actual: number | null
  eps_estimate: number | null
  eps_surprise: number | null
  eps_surprise_percent: number | null
  revenue_estimate: number | null
  revenue_actual: number | null
  beat: boolean | null
  is_reported: boolean
  /** When in the trading day it's expected: `bmo`/`amc`/`during`/`unknown`.
   *  Optional so a stale backend (pre-`report_session`) still parses. */
  report_session?: string | null
}

/**
 * The consolidated quarterly earnings series for a ticker, oldest → newest:
 * reported quarters followed by the upcoming scheduled ones, split by
 * `reported_count`/`upcoming_count` (summing to `count`). The successor to the
 * `/earnings` beat history — richer, since it carries every scheduled quarter
 * (not just the next one) and a forward revenue estimate for each.
 */
export interface QuarterlyEarnings {
  symbol: string
  count: number
  reported_count: number
  upcoming_count: number
  quarters: QuarterlyEarningsQuarter[]
}

/**
 * Fetch the consolidated quarterly earnings series (reported + upcoming) for a
 * ticker. Oldest → newest, so consumers that read newest-first reverse it.
 */
export async function getQuarterlyEarnings(
  symbol: string,
  opts: { signal?: AbortSignal } = {},
): Promise<QuarterlyEarnings> {
  const res = await fetch(
    `${API_BASE}/stocks/${encodeURIComponent(symbol)}/earnings/quarterly`,
    { signal: opts.signal },
  )
  if (!res.ok) throw await toApiError(res)
  const data = (await res.json()) as QuarterlyEarnings
  if (!Array.isArray(data?.quarters)) {
    throw new ApiError(res.status, 'Malformed quarterly earnings response')
  }
  return data
}

/**
 * Every upcoming (scheduled, not-yet-reported) quarter from the series, mapped
 * to the `NextEarnings` shape the earnings card draws its forward "expected"
 * columns from — oldest → newest, so they append to the right of the reported
 * bars in order. The trading `session` (before open / after close) now rides the
 * quarterly series' `report_session`; `unknown` (no time published) maps to null so
 * the chip falls back to showing the date alone.
 */
export function quarterlyUpcoming(
  quarterly: QuarterlyEarnings,
): NextEarnings[] {
  return quarterly.quarters
    .filter((q) => !q.is_reported)
    .map((q) => ({
      report_date: q.report_date,
      fiscal_year: q.fiscal_year,
      fiscal_quarter: q.fiscal_quarter,
      eps_estimate: q.eps_estimate,
      revenue_estimate: q.revenue_estimate,
      session:
        q.report_session && q.report_session !== 'unknown'
          ? q.report_session
          : null,
    }))
}

/**
 * Adapt the quarterly series into the `EarningsHistory` shape the earnings
 * card renders, so the EPS/revenue charts and the next-report chip all run off
 * `/earnings/quarterly`. Reported quarters become the (newest-first)
 * `quarters` history and the beat summary is scored from their `beat` flags;
 * the first upcoming quarter becomes `next_report`.
 */
export function quarterlyToEarningsHistory(
  quarterly: QuarterlyEarnings,
): EarningsHistory {
  const reported = quarterly.quarters.filter((q) => q.is_reported)
  // The card reads newest-first; the endpoint serves oldest-first.
  const quarters: EarningsSurprise[] = reported
    .slice()
    .reverse()
    .map((q) => ({
      period: q.period_end,
      fiscal_year: q.fiscal_year,
      fiscal_quarter: q.fiscal_quarter,
      actual: q.eps_actual,
      estimate: q.eps_estimate,
      surprise: q.eps_surprise,
      surprise_percent: q.eps_surprise_percent,
      beat: q.beat,
      revenue_actual: q.revenue_actual,
    }))
  const scoreable = reported.filter((q) => q.beat != null)
  const beats = scoreable.filter((q) => q.beat).length
  // The chip names the single *next* report — the first upcoming quarter; the
  // charts draw every upcoming quarter via the card's `upcoming` prop.
  const next_report: NextEarnings | null =
    quarterlyUpcoming(quarterly)[0] ?? null
  return {
    symbol: quarterly.symbol,
    count: quarterly.reported_count,
    beats,
    scored: scoreable.length,
    beat_rate: scoreable.length
      ? Math.round((beats / scoreable.length) * 1000) / 10
      : null,
    quarters,
    next_report,
  }
}

/**
 * One fiscal year from the annual earnings series — reported and upcoming years
 * in a single list, the yearly counterpart of `QuarterlyEarningsQuarter`. A
 * reported year (`is_reported`) carries the actual EPS, revenue and net income;
 * an upcoming one carries the forward consensus (`eps_estimate`/
 * `revenue_estimate`) with actuals null. The API serves no consensus for years
 * already reported, so there's no surprise or beat to score. `period_end` is
 * the fiscal year's last day — which can sit in the next calendar year (NVDA's
 * FY2026 ended January 2026).
 *
 * `eps_actual` is GAAP diluted EPS while `eps_estimate` is analyst consensus —
 * an adjusted basis that can sit well above GAAP. A reported year may also
 * carry `eps_actual_consensus`, the year's actual on that same consensus basis
 * (best-effort — null when the backend couldn't assemble it), so an actual can
 * be compared with the forward estimates without mixing bases.
 */
export interface AnnualEarningsYear {
  fiscal_year: number | null
  period_end: string | null
  eps_actual: number | null
  eps_estimate: number | null
  revenue_actual: number | null
  revenue_estimate: number | null
  net_income: number | null
  eps_actual_consensus: number | null
  is_reported: boolean
}

/**
 * The annual earnings series for a ticker, oldest → newest: reported fiscal
 * years followed by the upcoming estimated ones, split by
 * `reported_count`/`upcoming_count` (summing to `count`).
 */
export interface AnnualEarnings {
  symbol: string
  count: number
  reported_count: number
  upcoming_count: number
  years: AnnualEarningsYear[]
}

/** Fetch the annual earnings series (reported + upcoming fiscal years). */
export async function getAnnualEarnings(
  symbol: string,
  opts: { signal?: AbortSignal } = {},
): Promise<AnnualEarnings> {
  const res = await fetch(
    `${API_BASE}/stocks/${encodeURIComponent(symbol)}/earnings/annual`,
    { signal: opts.signal },
  )
  if (!res.ok) throw await toApiError(res)
  const data = (await res.json()) as AnnualEarnings
  if (!Array.isArray(data?.years)) {
    throw new ApiError(res.status, 'Malformed annual earnings response')
  }
  return data
}

/**
 * Reported fiscal years mapped to the per-quarter shape the earnings card's
 * charts consume, newest-first (the order the card reads). A null
 * `fiscal_quarter` is what labels a row "FY26" rather than "Q2 '26"; with no
 * consensus served for reported years there's no surprise or beat to carry.
 */
export function annualReported(annual: AnnualEarnings): EarningsSurprise[] {
  return annual.years
    .filter((y) => y.is_reported)
    .reverse()
    .map((y) => ({
      period: y.period_end,
      fiscal_year: y.fiscal_year,
      fiscal_quarter: null,
      actual: y.eps_actual,
      estimate: y.eps_estimate,
      surprise: null,
      surprise_percent: null,
      beat: null,
      revenue_actual: y.revenue_actual,
    }))
}

/**
 * Upcoming (estimated, not-yet-reported) fiscal years mapped to the
 * `NextEarnings` shape the card's forecast columns read, oldest → newest.
 * Annual rows carry no announcement date or session — only the fiscal year the
 * consensus is for.
 */
export function annualUpcoming(annual: AnnualEarnings): NextEarnings[] {
  return annual.years
    .filter((y) => !y.is_reported)
    .map((y) => ({
      report_date: null,
      fiscal_year: y.fiscal_year,
      fiscal_quarter: null,
      eps_estimate: y.eps_estimate,
      revenue_estimate: y.revenue_estimate,
      session: null,
    }))
}

/**
 * A five-step analyst rating, most to least bullish. Deliberately the same
 * vocabulary as the RSI verdict (`RsiAction`) so the analyst and technical reads
 * can share a colour language on the page.
 */
export type Recommendation =
  | 'Strong Buy'
  | 'Buy'
  | 'Hold'
  | 'Sell'
  | 'Strong Sell'

/** How the consensus moved from the prior monthly snapshot to the latest. */
export type RecommendationDirection = 'upgraded' | 'downgraded' | 'unchanged'

/**
 * Analysts' buy/hold/sell split for one monthly snapshot. The five buckets are
 * the analyst counts per stance; `total` sums them, `score` is the consensus
 * mean on the 1 (Strong Buy) … 5 (Strong Sell) scale (null with no coverage),
 * and `consensus` that mean as a five-step label.
 */
export interface RecommendationTrend {
  period: string // first day of the month the snapshot covers (ISO date)
  strong_buy: number
  buy: number
  hold: number
  sell: number
  strong_sell: number
  total: number
  score: number | null
  consensus: Recommendation | null
}

/**
 * The sell-side's consensus 12-month price target — the `mean`/`median` view and
 * the `high`/`low` range across analysts. Every field is null when the source
 * serves none, and the whole block is null with no coverage. There's no upside
 * figure here: pair `mean` with a live quote to compute one (see
 * `priceTargetUpside`).
 */
export interface AnalystPriceTargets {
  mean: number | null
  high: number | null
  low: number | null
  median: number | null
}

/**
 * The recommendation-trend block of `AnalystInfo`, newest snapshot first.
 * `latest` is the current month's split and `direction` how the consensus
 * shifted from the prior month (null until there are two snapshots to compare) —
 * the forward-looking part. `price_targets` is the current consensus 12-month
 * target block (null when the source serves none). An empty `trends` means no
 * analyst covers the symbol.
 */
export interface AnalystRecommendations {
  direction: RecommendationDirection | null
  latest: RecommendationTrend | null
  price_targets: AnalystPriceTargets | null
  trends: RecommendationTrend[]
}

/**
 * Percent upside (or downside) from `price` to the consensus `mean` target —
 * `(mean - price) / price * 100`, the headline read of a price target. Null
 * without a mean target or a positive price to anchor on.
 */
export function priceTargetUpside(
  targets: AnalystPriceTargets | null,
  price: number | null,
): number | null {
  if (!targets || targets.mean == null || price == null || price <= 0)
    return null
  return ((targets.mean - price) / price) * 100
}

/**
 * One published sell-side rating action — the discrete event behind the trend.
 * `firm` and `published_at` identify it; `action` is the vendor's grade action
 * (`up`/`down`/`init`/`main`/`reit`), `from_grade`→`to_grade` the move, and
 * `target_current`/`target_prior` the price target it set vs. the one it replaced
 * (any null when the source omits it). `is_upgrade`/`is_downgrade` surface the
 * direction so the UI doesn't re-derive it from `action`.
 */
export interface RatingChange {
  firm: string
  published_at: string // ISO date the action was published
  action: string | null
  from_grade: string | null
  to_grade: string | null
  target_current: number | null
  target_prior: number | null
  is_upgrade: boolean
  is_downgrade: boolean
}

/**
 * One credible firm's current stance — a row of the card's "top firms" read.
 * `firm` is the research house and `rank` its position in the backend's curated
 * credibility ranking (0 = most credible, so the list arrives best-first).
 * `rating` is the grade it now holds, `action` the move that set it, `target`
 * its current price target (null when it published none), and `published_at`
 * when it last acted. Derived from the rating-change events, so it's empty when
 * none of the covering firms is ranked.
 */
export interface TopFirmRating {
  firm: string
  rank: number
  rating: string | null
  action: string | null
  target: number | null
  published_at: string // ISO date the firm last acted
}

/**
 * A stock's full analyst coverage in one payload — the response of
 * `GET /stocks/ticker/{ticker}/analyst-info`. `recommendations` is the
 * buy/hold/sell trend block (with consensus + price targets); `rating_changes`
 * is the discrete upgrade/downgrade event feed, newest first; `top_firms` is the
 * most credible covering firms and their current stance, best-first. All
 * best-effort: an uncovered stock carries an empty `trends`, `rating_changes`,
 * and `top_firms`.
 */
export interface AnalystInfo {
  ticker: string
  recommendations: AnalystRecommendations
  rating_changes: RatingChange[]
  top_firms: TopFirmRating[]
}

/**
 * Fetch a ticker's full analyst coverage — recommendation trends (+ price
 * targets) and the rating-change feed — in one read (newest first).
 */
export async function getAnalystInfo(
  symbol: string,
  opts: { signal?: AbortSignal } = {},
): Promise<AnalystInfo> {
  const res = await fetch(
    `${API_BASE}/stocks/ticker/${encodeURIComponent(symbol)}/analyst-info`,
    { signal: opts.signal },
  )
  if (!res.ok) throw await toApiError(res)
  const data = (await res.json()) as AnalystInfo
  if (
    !Array.isArray(data?.recommendations?.trends) ||
    !Array.isArray(data?.rating_changes)
  ) {
    throw new ApiError(res.status, 'Malformed analyst-info response')
  }
  // `top_firms` was added to this endpoint after the fields above; tolerate a
  // backend that predates it (deploy skew) by defaulting to an empty list rather
  // than failing the whole card.
  if (!Array.isArray(data.top_firms)) data.top_firms = []
  return data
}

/**
 * One insider (Form 4) transaction — a single reported buy or sell of the
 * company's stock by an officer, director, or 10% owner. `transaction_code` is
 * the raw Form 4 code and `code_label` its human rendering; the open-market
 * `P`/`S` conviction trades are flagged by `is_open_market_buy` /
 * `is_open_market_sale` (their union `is_open_market`), apart from the
 * grant/exercise/tax activity a Form 4 also reports. `value` is the trade's
 * dollar size (shares × price), null when a leg is missing (e.g. a footnote-only
 * price). `role` is the insider's title ("Chief Executive Officer", "Director").
 * Dates are ISO `yyyy-mm-dd` (`transaction_date` null when the filing omits it).
 */
export interface InsiderTransaction {
  filing_date: string
  transaction_date: string | null
  insider_name: string
  role: string
  security_title: string | null
  transaction_code: string
  code_label: string
  acquired_disposed: string | null // "A" (acquired) / "D" (disposed)
  is_open_market: boolean
  is_open_market_buy: boolean
  is_open_market_sale: boolean
  shares: number | null
  price_per_share: number | null
  value: number | null
  shares_owned_following: number | null
}

/**
 * The net buy-vs-sell rollup of the open-market (P/S) trades — counts and summed
 * dollar value of purchases vs. sales, and `net_value` (buy − sell; positive =
 * net buying). Always reflects the full open-market set, independent of any
 * client-side filter on the transaction list.
 */
export interface InsiderSummary {
  open_market_buy_count: number
  open_market_sell_count: number
  open_market_buy_value: number
  open_market_sell_value: number
  net_value: number
}

/**
 * A stock's recent insider transactions — the response of
 * `GET /stocks/ticker/{ticker}/insider-transactions`. `transactions` is the
 * newest-first Form 4 feed and `summary` the net buy-vs-sell rollup of its
 * open-market trades. Best-effort: a stock with no recent Form 4 activity carries
 * an empty `transactions` (and a zeroed `summary`), not an error.
 */
export interface InsiderTransactions {
  symbol: string
  count: number
  summary: InsiderSummary
  transactions: InsiderTransaction[]
}

/**
 * Fetch a stock's recent insider (Form 4) buys and sells — the full feed plus the
 * net buy-vs-sell summary, newest first.
 */
export async function getInsiderTransactions(
  symbol: string,
  opts: { signal?: AbortSignal } = {},
): Promise<InsiderTransactions> {
  const res = await fetch(
    `${API_BASE}/stocks/ticker/${encodeURIComponent(
      symbol,
    )}/insider-transactions`,
    { signal: opts.signal },
  )
  if (!res.ok) throw await toApiError(res)
  const data = (await res.json()) as InsiderTransactions
  if (!Array.isArray(data?.transactions) || data?.summary == null) {
    throw new ApiError(res.status, 'Malformed insider-transactions response')
  }
  return data
}

/**
 * One member's one disclosed stock trade — the buys and sells US Representatives
 * and Senators report under the STOCK Act. `chamber` is "House" or "Senate";
 * `party` is best-effort (usually null — the public feeds don't carry it).
 * `tx_type` is the normalized action ("Purchase" / "Sale" / "Exchange" / "Other")
 * with `is_buy` / `is_sell` the derived flags. Congress discloses a dollar *range*,
 * never an exact figure, so `amount_range` is that band verbatim and
 * `amount_midpoint` a best-effort estimate of the trade's size (the middle of the
 * band). `transaction_date` is when the trade happened; `disclosure_date` when it
 * was reported (up to 45 days later). Dates are ISO `yyyy-mm-dd` or null.
 */
export interface CongressTrade {
  member: string
  chamber: string
  party: string | null
  ticker: string
  name: string | null
  tx_type: string
  amount_range: string | null
  amount_midpoint: number | null
  transaction_date: string | null
  disclosure_date: string | null
  owner: string | null
  source_url: string | null
  is_buy: boolean
  is_sell: boolean
}

/**
 * A net buy-vs-sell rollup of a set of Congressional trades — counts and the
 * *estimated* dollar flow (summed band midpoints, since Congress discloses only
 * ranges), with `net_value` (buy − sell; positive = net buying). The dollar legs
 * are estimates, not reported totals.
 */
export interface CongressSummary {
  buy_count: number
  sell_count: number
  buy_value: number
  sell_value: number
  net_value: number
}

/**
 * A single stock's recent Congressional trades — the response of
 * `GET /stocks/ticker/{ticker}/congress-trades`. `items` is the newest-first feed
 * and `summary` the net rollup over the *full* stored set (not just the page).
 * `total` is the full count; `count` the number in this page. Best-effort: a stock
 * Congress hasn't traded carries an empty `items`, not an error.
 */
export interface CongressTrades {
  symbol: string
  total: number
  limit: number
  offset: number
  count: number
  summary: CongressSummary
  items: CongressTrade[]
}

/**
 * A window of the whole market's recent Congressional trades — the response of
 * `GET /market/congress-activity`. `window` echoes the requested token; `total`
 * is the full match count in the window before the page was cut. `summary` rolls
 * up the page's trades.
 */
export interface CongressActivity {
  window: string
  total: number
  limit: number
  offset: number
  count: number
  summary: CongressSummary
  items: CongressTrade[]
}

/** The market board's time windows (over the disclosure date). */
export const CONGRESS_WINDOWS = [
  { key: '7d', label: '7D' },
  { key: '30d', label: '30D' },
  { key: '90d', label: '90D' },
  { key: '1y', label: '1Y' },
  { key: 'all', label: 'All' },
] as const
export type CongressWindow = (typeof CONGRESS_WINDOWS)[number]['key']

/**
 * Fetch a stock's recent Congressional trades — the disclosed House/Senate buys
 * and sells plus the net buy-vs-sell summary, newest first.
 */
export async function getCongressTrades(
  symbol: string,
  opts: { limit?: number; offset?: number; signal?: AbortSignal } = {},
): Promise<CongressTrades> {
  const qs = new URLSearchParams()
  if (opts.limit != null) qs.set('limit', String(opts.limit))
  if (opts.offset != null) qs.set('offset', String(opts.offset))
  const suffix = qs.toString() ? `?${qs}` : ''
  const res = await fetch(
    `${API_BASE}/stocks/ticker/${encodeURIComponent(
      symbol,
    )}/congress-trades${suffix}`,
    { signal: opts.signal },
  )
  if (!res.ok) throw await toApiError(res)
  const data = (await res.json()) as CongressTrades
  if (!Array.isArray(data?.items) || data?.summary == null) {
    throw new ApiError(res.status, 'Malformed congress-trades response')
  }
  return data
}

/**
 * Fetch a window of the whole market's recent Congressional trades — the board.
 * `window` is one of `CONGRESS_WINDOWS` (default 30d); `limit`/`offset` page it.
 */
export async function getCongressActivity(
  opts: {
    window?: CongressWindow
    limit?: number
    offset?: number
    signal?: AbortSignal
  } = {},
): Promise<CongressActivity> {
  const qs = new URLSearchParams()
  if (opts.window) qs.set('window', opts.window)
  if (opts.limit != null) qs.set('limit', String(opts.limit))
  if (opts.offset != null) qs.set('offset', String(opts.offset))
  const res = await fetch(`${API_BASE}/market/congress-activity?${qs}`, {
    signal: opts.signal,
  })
  if (!res.ok) throw await toApiError(res)
  const data = (await res.json()) as CongressActivity
  if (!Array.isArray(data?.items)) {
    throw new ApiError(res.status, 'Malformed congress-activity response')
  }
  return data
}

/**
 * One stock's aggregated Congressional activity over a window — a row of the
 * attention board (`GET /market/congress-leaderboard`). A rollup across *every*
 * member who traded the stock, not a single disclosure: `trade_count` disclosures
 * from `member_count` distinct members (the breadth of attention), split into
 * buys and sells. The dollar legs sum best-effort band midpoints (Congress
 * discloses only ranges), so `net_value` / `total_value` are *estimates*, not
 * reported totals. `last_activity` is the freshest disclosure date (ISO or null).
 */
export interface CongressLeaderboardEntry {
  ticker: string
  name: string | null
  trade_count: number
  member_count: number
  buy_count: number
  sell_count: number
  buy_value: number
  sell_value: number
  net_value: number
  total_value: number
  last_activity: string | null
}

/**
 * The stocks getting the most Congressional attention over a window, ranked by
 * `metric` — the response of `GET /market/congress-leaderboard`. `total` is the
 * number of distinct stocks Congress traded in the window before the top-N cut.
 */
export interface CongressLeaderboard {
  window: string
  metric: string
  total: number
  count: number
  items: CongressLeaderboardEntry[]
}

/** How the attention leaderboard ranks stocks — the metric selector's options. */
export const CONGRESS_METRICS = [
  { key: 'members', label: 'Members' },
  { key: 'trades', label: 'Trades' },
  { key: 'value', label: '$ Volume' },
] as const
export type CongressMetric = (typeof CONGRESS_METRICS)[number]['key']

/**
 * Fetch the stocks getting the most Congressional attention — the ranked board.
 * `window` is one of `CONGRESS_WINDOWS` (default 30d); `metric` one of
 * `CONGRESS_METRICS` (default members); `limit` caps the rows (backend ≤ 100).
 */
export async function getCongressLeaderboard(
  opts: {
    window?: CongressWindow
    metric?: CongressMetric
    limit?: number
    signal?: AbortSignal
  } = {},
): Promise<CongressLeaderboard> {
  const qs = new URLSearchParams()
  if (opts.window) qs.set('window', opts.window)
  if (opts.metric) qs.set('metric', opts.metric)
  if (opts.limit != null) qs.set('limit', String(opts.limit))
  const res = await fetch(`${API_BASE}/market/congress-leaderboard?${qs}`, {
    signal: opts.signal,
  })
  if (!res.ok) throw await toApiError(res)
  const data = (await res.json()) as CongressLeaderboard
  if (!Array.isArray(data?.items)) {
    throw new ApiError(res.status, 'Malformed congress-leaderboard response')
  }
  return data
}

/**
 * One institutional (or mutual-fund) holder's stake in a stock as of a reported
 * 13F quarter. `holder_type` is `"institution"` / `"mutual_fund"`; `pct_held` /
 * `pct_change` are percent (`pct_change` the quarter-over-quarter change in the
 * position — the buy/sell signal), and `is_buyer` / `is_seller` flag its
 * direction. `value` is the position's market value in dollars; `share_change` /
 * `value_change` are the size of the quarterly move (positive = added), null when
 * the inputs are missing. `date_reported` is ISO `yyyy-mm-dd`.
 */
export interface InstitutionalHolder {
  holder: string
  holder_type: string // "institution" | "mutual_fund"
  date_reported: string
  shares: number | null
  value: number | null
  pct_held: number | null
  pct_change: number | null
  is_buyer: boolean
  is_seller: boolean
  share_change: number | null
  value_change: number | null
}

/**
 * The headline ownership summary — what fraction (percent) of the company
 * institutions and insiders hold, and how many institutions hold it. Every field
 * is best-effort (null when the source doesn't carry it).
 */
export interface OwnershipBreakdown {
  institutions_pct_held: number | null
  insiders_pct_held: number | null
  institutions_float_pct_held: number | null
  institutions_count: number | null
}

/**
 * A net buy-vs-sell rollup of the latest reported snapshot — counts of holders
 * that added vs. trimmed, the summed shares/value bought vs. sold (magnitudes),
 * and the nets (positive = net buying).
 */
export interface HolderFlow {
  buyers_count: number
  sellers_count: number
  shares_bought: number
  shares_sold: number
  value_bought: number
  value_sold: number
  net_share_change: number
  net_value_change: number
}

/**
 * A stock's institutional ownership — the response of
 * `GET /stocks/ticker/{ticker}/institutional-ownership`. `holders` is the
 * newest-quarter-first 13F feed, `breakdown` the "institutions own X%" summary
 * (null when the source omits it), and `flow` the net buy-vs-sell rollup of the
 * latest snapshot. `latest_report_date` is the most recent reported quarter (ISO
 * `yyyy-mm-dd`, null when empty). Best-effort: a stock with no institutional
 * coverage carries an empty `holders` (and a zeroed `flow`), not an error.
 */
export interface InstitutionalOwnership {
  symbol: string
  count: number
  latest_report_date: string | null
  breakdown: OwnershipBreakdown | null
  flow: HolderFlow
  holders: InstitutionalHolder[]
}

/**
 * Fetch a stock's institutional ownership — its top 13F holders, the ownership
 * breakdown, and the latest-snapshot buy-vs-sell flow.
 */
export async function getInstitutionalOwnership(
  symbol: string,
  opts: { signal?: AbortSignal } = {},
): Promise<InstitutionalOwnership> {
  const res = await fetch(
    `${API_BASE}/stocks/ticker/${encodeURIComponent(
      symbol,
    )}/institutional-ownership`,
    { signal: opts.signal },
  )
  if (!res.ok) throw await toApiError(res)
  const data = (await res.json()) as InstitutionalOwnership
  if (!Array.isArray(data?.holders) || data?.flow == null) {
    throw new ApiError(res.status, 'Malformed institutional-ownership response')
  }
  return data
}

/**
 * One published news item about a stock. `id` is the source's stable article id
 * (Yahoo's UUID) — the React key. `published_at` is when it went out (an ISO-8601
 * UTC timestamp). `is_video` flags a video (vs. a written story) so the feed can
 * badge it. Everything past `title` is best-effort and may be null: `publisher`
 * is the outlet, `link` the article URL, `summary` a short teaser, `thumbnail_url`
 * a preview image (which may 404 — treat it as decorative).
 */
export interface NewsArticle {
  id: string
  title: string
  published_at: string
  publisher: string | null
  link: string | null
  summary: string | null
  content_type: string | null
  thumbnail_url: string | null
  is_video: boolean
}

/**
 * A stock's recent news — the response of `GET /stocks/{symbol}/news`. `articles`
 * is the newest-first headline feed and `latest` its first item (null when the
 * feed is empty); `count` is how many were returned. Best-effort: a symbol the
 * source carries no news for comes back with an empty `articles` (a 200, not a
 * 404), so the card self-shows an empty state.
 */
export interface StockNews {
  symbol: string
  count: number
  latest: NewsArticle | null
  articles: NewsArticle[]
}

/** Fetch a stock's recent news headlines, newest article first. */
export async function getStockNews(
  symbol: string,
  opts: { signal?: AbortSignal } = {},
): Promise<StockNews> {
  const res = await fetch(
    `${API_BASE}/stocks/${encodeURIComponent(symbol)}/news`,
    { signal: opts.signal },
  )
  if (!res.ok) throw await toApiError(res)
  const data = (await res.json()) as StockNews
  if (!Array.isArray(data?.articles)) {
    throw new ApiError(res.status, 'Malformed news response')
  }
  return data
}

/** The overall read of a stock's analyst coverage — the AI ratings verdict. */
export type RatingsVerdict = 'bullish' | 'mixed' | 'cautious'

/**
 * An AI-generated, plain-language read of a stock's *analyst coverage*
 * (`GET /stocks/ticker/{ticker}/analyst-info/analysis`) — the analyst-ratings
 * sibling of `EarningsAnalysis`. `verdict` is the overall read (bullish / mixed /
 * cautious) and `confidence` how firmly it's held; `summary` is the everyday-
 * language headline and `findings` a few short, concrete takeaways. `disclaimer`
 * is a fixed not-financial-advice reminder authored by the service — render it as
 * a footnote — and `model`/`generated_at` record what produced the read. Reasoned
 * only over the consensus, targets, and top firms the card shows; descriptive,
 * not advice, and regenerated at most every few minutes (the endpoint caches).
 */
export interface RatingsAnalysis {
  symbol: string
  verdict: RatingsVerdict
  confidence: AnalysisConfidence
  summary: string
  findings: string[]
  disclaimer: string
  model: string
  generated_at: string
}

/**
 * Fetch the AI ratings review for a ticker
 * (`GET /stocks/ticker/{ticker}/analyst-info/analysis`). The backend runs a
 * language model over the stock's analyst coverage (consensus, targets, top
 * firms), so this is a slow read — seconds, not milliseconds — which is why the
 * Analysts tab fetches it on its own and shows the card once it lands. Throws an
 * `ApiError` when the read is unavailable (a symbol with no coverage on file, or
 * the backend isn't configured for AI analysis).
 */
export async function getRatingsAnalysis(
  symbol: string,
  opts: { signal?: AbortSignal } = {},
): Promise<RatingsAnalysis> {
  const res = await fetch(
    `${API_BASE}/stocks/ticker/${encodeURIComponent(symbol)}/analyst-info/analysis`,
    { signal: opts.signal },
  )
  if (!res.ok) throw await toApiError(res)
  const data = (await res.json()) as RatingsAnalysis
  if (typeof data?.summary !== 'string' || !Array.isArray(data?.findings)) {
    throw new ApiError(res.status, 'Malformed ratings analysis response')
  }
  return data
}

/**
 * The AI analysis's headline call — a five-point strong-buy … strong-sell verdict
 * (Hold the neutral middle), the same shape as the sell-side consensus scale but
 * authored by the model over the stock's own figures. Lowercase (snake_case for the
 * 'strong' calls) to match the API's JSON.
 */
export type AnalysisRecommendation =
  | 'strong_buy'
  | 'buy'
  | 'hold'
  | 'sell'
  | 'strong_sell'

/** How firmly the AI analysis holds its call, given how much clear data it had. */
export type AnalysisConfidence = 'low' | 'medium' | 'high'

/**
 * The fields the **bullet-style** AI analysis carries (currently the ETF read).
 * `recommendation` is the headline buy/hold/sell call and `confidence` how
 * firmly it's held; `thesis` is a few everyday-language sentences of reasoning,
 * with `strengths` (the bull case) and `risks` (the bear case) as short bullet
 * points. `disclaimer` is a fixed not-financial-advice reminder authored by the
 * service — render it as a footnote — and `model`/`generated_at` record what
 * produced the read and when. The stock read has moved to the sectioned
 * `StockAnalysis` scorecard below; `EtfAnalysis` still extends this.
 */
export interface AnalysisBase {
  recommendation: AnalysisRecommendation
  confidence: AnalysisConfidence
  thesis: string
  strengths: string[]
  risks: string[]
  disclaimer: string
  model: string
  generated_at: string
}

/**
 * How one scorecard section reads *for the stock* — the favourability signal the
 * card colours on (green for positive, amber for neutral, red for negative).
 */
export type AnalysisStance = 'positive' | 'neutral' | 'negative'

/**
 * One supporting figure under a scorecard section — a `label` and a pre-formatted
 * display `value` (e.g. `{ label: 'Net margin', value: '25.00%' }`). Attached by
 * the service from real data, never authored by the model.
 */
export interface AnalysisSectionMetric {
  label: string
  value: string
}

/**
 * One graded facet of the stock scorecard. `key` is a stable id the UI keys off
 * (`business_quality` / `valuation` / `earnings` / `analyst_view`) and `title` its
 * display name; `stance` is the favourability signal, `label` a short human tag
 * ("Exceptional", "Expensive"), `summary` a plain-language read, and `metrics` the
 * supporting chips.
 */
export interface AnalysisSection {
  key: string
  title: string
  stance: AnalysisStance
  label: string
  summary: string
  metrics: AnalysisSectionMetric[]
}

/**
 * An AI-generated, **sectioned** buy/hold/sell scorecard for a single stock
 * (`GET /stocks/{symbol}/analysis`): an overall verdict (`recommendation` /
 * `confidence` / `thesis`) over a handful of graded `sections` — business quality,
 * valuation, earnings, and the analyst view — each with its own stance, label,
 * plain-language summary, and supporting figures. Reasoned only over the figures
 * the other stock endpoints expose; descriptive, not advice, and regenerated at
 * most every few minutes (the endpoint caches).
 */
export interface StockAnalysis {
  symbol: string
  recommendation: AnalysisRecommendation
  confidence: AnalysisConfidence
  thesis: string
  sections: AnalysisSection[]
  disclaimer: string
  model: string
  generated_at: string
}

/**
 * Fetch the AI analysis for a ticker (`GET /stocks/{symbol}/analysis`). The
 * backend runs a language model over the stock's own figures, so this is the
 * slowest of the stock reads — seconds, not milliseconds — which is why the
 * detail view fetches it on its own and shows the card once it lands. Throws an
 * `ApiError` when the read is unavailable (a bad symbol, or the backend isn't
 * configured for AI analysis).
 */
export async function getStockAnalysis(
  symbol: string,
  opts: { signal?: AbortSignal } = {},
): Promise<StockAnalysis> {
  const res = await fetch(
    `${API_BASE}/stocks/${encodeURIComponent(symbol)}/analysis`,
    { signal: opts.signal },
  )
  if (!res.ok) throw await toApiError(res)
  const data = (await res.json()) as StockAnalysis
  if (!Array.isArray(data?.sections)) {
    throw new ApiError(res.status, 'Malformed analysis response')
  }
  return data
}

/**
 * Where a company's earnings story is heading: 'accelerating' when growth is
 * picking up (or its beats are getting bigger), 'slowing' when growth fades or it
 * starts to miss, 'steady' when it holds a consistent pace. Lowercase to match the
 * API's JSON.
 */
export type EarningsTrend = 'accelerating' | 'steady' | 'slowing'

/**
 * An AI-generated, plain-language read of a stock's earnings story
 * (`GET /stocks/{symbol}/earnings/analysis`) — the earnings-focused sibling of
 * `StockAnalysis`. `summary` is the everyday-language headline of how earnings
 * have gone and where they look headed; `trend` is the direction; `highlights`
 * are a few short takeaways. `disclaimer` is a fixed not-financial-advice reminder
 * authored by the service — render it as a footnote — and `model`/`generated_at`
 * record what produced the read and when. Reasoned only over the recent earnings
 * timelines; descriptive, not advice, and regenerated at most every few minutes
 * (the endpoint caches).
 */
export interface EarningsAnalysis {
  symbol: string
  summary: string
  trend: EarningsTrend
  highlights: string[]
  disclaimer: string
  model: string
  generated_at: string
}

/**
 * Fetch the AI earnings analysis for a ticker
 * (`GET /stocks/{symbol}/earnings/analysis`). The backend runs a language model
 * over the stock's recent earnings, so this is a slow read — seconds, not
 * milliseconds — which is why the earnings tab fetches it on its own and shows the
 * card once it lands. Throws an `ApiError` when the read is unavailable (a symbol
 * with no earnings on file, or the backend isn't configured for AI analysis).
 */
export async function getEarningsAnalysis(
  symbol: string,
  opts: { signal?: AbortSignal } = {},
): Promise<EarningsAnalysis> {
  const res = await fetch(
    `${API_BASE}/stocks/${encodeURIComponent(symbol)}/earnings/analysis`,
    { signal: opts.signal },
  )
  if (!res.ok) throw await toApiError(res)
  const data = (await res.json()) as EarningsAnalysis
  if (typeof data?.summary !== 'string' || !Array.isArray(data?.highlights)) {
    throw new ApiError(res.status, 'Malformed earnings analysis response')
  }
  return data
}

/**
 * The overall read of a company's fundamentals: 'strong' when they clearly hold up
 * (healthy margins and growth, a sound balance sheet, a fair price), 'weak' when they
 * clearly don't (thin or falling margins, shrinking growth, heavy debt, or a price the
 * business can't justify), 'mixed' when the picture is uneven or conflicting. Lowercase
 * to match the API's JSON.
 */
export type FundamentalsVerdict = 'strong' | 'mixed' | 'weak'

/**
 * An AI-generated, plain-language read of a stock's fundamentals
 * (`GET /stocks/{symbol}/fundamentals/analysis`) — the fundamentals-focused sibling of
 * `EarningsAnalysis` and `RatingsAnalysis`. `verdict` is the overall read (strong / mixed /
 * weak) of the company's profitability, growth, balance-sheet health and how its valuation
 * stacks up, and `confidence` how firmly it's held; `summary` is the everyday-language
 * headline and `findings` a few short, concrete takeaways. `disclaimer` is a fixed
 * not-financial-advice reminder authored by the service — render it as a footnote — and
 * `model`/`generated_at` record what produced the read. Reasoned only over the fundamentals
 * the ticker card exposes plus the industry-P/E peer benchmark; descriptive, not advice, and
 * regenerated at most every few minutes (the endpoint caches).
 */
export interface FundamentalsAnalysis {
  symbol: string
  verdict: FundamentalsVerdict
  confidence: AnalysisConfidence
  summary: string
  findings: string[]
  disclaimer: string
  model: string
  generated_at: string
}

/**
 * Fetch the AI fundamentals analysis for a ticker
 * (`GET /stocks/{symbol}/fundamentals/analysis`). The backend runs a language model over the
 * stock's valuation, profitability, growth and health metrics (plus its industry-P/E peer
 * benchmark), so this is a slow read — seconds, not milliseconds — which is why the
 * Fundamentals tab fetches it on its own and shows the card once it lands. Throws an
 * `ApiError` when the read is unavailable (a symbol with no fundamentals on file, or the
 * backend isn't configured for AI analysis).
 */
export async function getFundamentalsAnalysis(
  symbol: string,
  opts: { signal?: AbortSignal } = {},
): Promise<FundamentalsAnalysis> {
  const res = await fetch(
    `${API_BASE}/stocks/${encodeURIComponent(symbol)}/fundamentals/analysis`,
    { signal: opts.signal },
  )
  if (!res.ok) throw await toApiError(res)
  const data = (await res.json()) as FundamentalsAnalysis
  if (typeof data?.summary !== 'string' || !Array.isArray(data?.findings)) {
    throw new ApiError(res.status, 'Malformed fundamentals analysis response')
  }
  return data
}

/**
 * An AI-generated, plain-language read on a single fund
 * (`GET /stocks/etf/{ticker}/analysis`) — the ETF sibling of `StockAnalysis`,
 * the same shape but keyed on `ticker` with an `asset_type` marker. The backend
 * reasons only over the fund's own figures (size, cost, yield, returns,
 * holdings, sector mix). Descriptive, not advice.
 */
export interface EtfAnalysis extends AnalysisBase {
  ticker: string
  asset_type: AssetType
}

/**
 * Fetch the AI analysis for a fund (`GET /stocks/etf/{ticker}/analysis`). Like
 * the stock read this runs a live model call, so it's the slowest of the fund
 * reads — the detail view fetches it on its own and shows the card once it
 * lands. Throws an `ApiError` when the read is unavailable (not a screened ETF,
 * or the backend isn't configured for AI analysis).
 */
export async function getEtfAnalysis(
  ticker: string,
  opts: { signal?: AbortSignal } = {},
): Promise<EtfAnalysis> {
  const res = await fetch(
    `${API_BASE}/stocks/etf/${encodeURIComponent(ticker)}/analysis`,
    { signal: opts.signal },
  )
  if (!res.ok) throw await toApiError(res)
  const data = (await res.json()) as EtfAnalysis
  if (!Array.isArray(data?.strengths) || !Array.isArray(data?.risks)) {
    throw new ApiError(res.status, 'Malformed analysis response')
  }
  return data
}

/** The market's mood a daily brief reads off the day's moves — the same three-way
 *  posture the market summary uses. */
export type BriefTone = 'risk_on' | 'risk_off' | 'mixed'

/** One section of a daily market brief: a short heading and a plain-language body. */
export interface MarketBriefSection {
  heading: string
  body: string
}

/**
 * A single day's AI-written market brief (`GET /market/brief` or
 * `/market/brief/{date}`) — a plain-language read of how the whole US market moved
 * that day. `date` is the calendar day it covers; `tone` the headline posture;
 * `summary` the lede; `sections` the ordered body (an overview, the sector
 * rotation, the day's movers, what to watch). `generated_at` is when it was
 * written; `disclaimer` is informational, not financial advice.
 */
export interface MarketBrief {
  date: string
  generated_at: string
  tone: BriefTone
  summary: string
  sections: MarketBriefSection[]
  model: string | null
  disclaimer: string
}

/**
 * Fetch a daily market brief — the latest one when `date` is omitted, or a
 * specific day (`YYYY-MM-DD`). Best-effort on the backend: a day with no brief is
 * a 404 (surfaced as an `ApiError`), which the reader turns into an empty state
 * rather than a broken page.
 */
export async function getMarketBrief(
  date?: string | null,
  opts: { signal?: AbortSignal } = {},
): Promise<MarketBrief> {
  const path = date
    ? `/market/brief/${encodeURIComponent(date)}`
    : '/market/brief'
  const res = await fetch(`${API_BASE}${path}`, { signal: opts.signal })
  if (!res.ok) throw await toApiError(res)
  const data = (await res.json()) as MarketBrief
  if (typeof data?.summary !== 'string' || !Array.isArray(data?.sections)) {
    throw new ApiError(res.status, 'Malformed market brief response')
  }
  return data
}

/** One company scheduled to report on a calendar date. `when` is the scheduled
 *  report date; `session` is when in the trading day it's expected — `bmo` before
 *  open, `amc` after close, `during` intraday, `unknown` when no time is published.
 *  Optional so a stale backend (pre-`report_session`) still parses. */
export interface EarningsCalendarItem {
  ticker: string
  name: string | null
  sector: string | null
  when: string
  session?: string | null
}

/** The reports scheduled for one calendar date, alphabetical by ticker. */
export interface EarningsCalendarDay {
  date: string
  count: number
  items: EarningsCalendarItem[]
}

/**
 * Upcoming earnings grouped by day (`GET /market/earnings-calendar`). `from`/`to`
 * echo the (clamped) window actually read; `count` is the total reports across the
 * window; `days` are only the days with at least one scheduled report.
 */
export interface EarningsCalendarResponse {
  from: string
  to: string
  count: number
  days: EarningsCalendarDay[]
  disclaimer: string
}

/**
 * Fetch the market-wide earnings calendar over a window (`GET
 * /market/earnings-calendar?from=&to=`, `YYYY-MM-DD`). Both bounds are optional —
 * the backend defaults to a two-week look-ahead and clamps an over-wide window.
 * An inverted window (`to` before `from`) is a 400 (surfaced as an `ApiError`).
 */
export async function getEarningsCalendar(
  opts: { from?: string | null; to?: string | null; signal?: AbortSignal } = {},
): Promise<EarningsCalendarResponse> {
  const qs = new URLSearchParams()
  if (opts.from) qs.set('from', opts.from)
  if (opts.to) qs.set('to', opts.to)
  const query = qs.toString() ? `?${qs}` : ''
  const res = await fetch(`${API_BASE}/market/earnings-calendar${query}`, {
    signal: opts.signal,
  })
  if (!res.ok) throw await toApiError(res)
  const data = (await res.json()) as EarningsCalendarResponse
  if (!Array.isArray(data?.days)) {
    throw new ApiError(res.status, 'Malformed earnings calendar response')
  }
  return data
}
