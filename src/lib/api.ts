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
 * A ticker card's valuation and profitability metrics. `pe` is the trailing
 * price-to-earnings multiple (price over the last twelve months of reported
 * EPS) — the figure quotes report today. `peg` is the trailing PEG (that same
 * trailing P/E over already-reported EPS growth) and `forward_peg` its forward
 * cousin (forward P/E over the FY1→FY2 growth analysts expect) — either is null
 * on losses, non-positive growth, or no stored consensus. The margins are
 * trailing percentages. `revenue_growth_yoy`/`eps_growth_yoy` are the trailing
 * year-over-year growth rates (percent) for the top and bottom line — the pace
 * behind the multiples above. Any field a vendor doesn't cover is null.
 */
export interface TickerMetrics {
  pe: number | null
  peg: number | null
  forward_peg: number | null
  gross_margin: number | null
  operating_margin: number | null
  net_margin: number | null
  revenue_growth_yoy: number | null
  eps_growth_yoy: number | null
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
 * A plain-language call on the PEG ratio — is the P/E multiple justified by
 * the earnings growth behind it? The bands follow Lynch's read: under 1 the
 * growth outruns the multiple, 1–2 is the unremarkable middle, above 2 the
 * price has run well ahead. `Not Meaningful` covers a non-positive ratio
 * (losses or shrinking EPS) — the backend normally nulls those, but a served
 * value still gets a sane label. Deliberately a broad, NOT sector-aware rule
 * of thumb, so the card frames it as a rough guide, not advice.
 */
export type PegVerdict =
  | 'Cheap for Its Growth'
  | 'Fairly Priced'
  | 'Pricey for Its Growth'
  | 'Not Meaningful'

/**
 * Map a trailing PEG ratio to its verdict. Returns null when there's no ratio
 * to judge (the backend nulls PEG on losses or non-positive EPS growth).
 */
export function pegVerdict(peg: number | null): PegVerdict | null {
  if (peg == null) return null
  if (peg <= 0) return 'Not Meaningful'
  if (peg < 1) return 'Cheap for Its Growth'
  if (peg <= 2) return 'Fairly Priced'
  return 'Pricey for Its Growth'
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
  '5D',
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
    case '5D':
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

/** Index universe the screener can narrow to. */
export type StockIndex = 'sp500' | 'nasdaq100'

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

/**
 * Turn a backend snake_case classification slug into a display label —
 * `"consumer_electronics"` → `"Consumer Electronics"`. Words split on
 * underscores and title-cased; anything already spaced passes through. Used for
 * the universe screener's sector/industry menus and rows, and the stock card.
 */
export function humanizeClassification(slug: string): string {
  return slug
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/** A sortable column of the universe search. */
export type StockSearchSort = 'market_cap' | 'revenue_growth' | 'eps_growth'
/** Sort direction, shared by any sortable list. */
export type SortOrder = 'asc' | 'desc'

/**
 * One row of a universe search (`GET /stocks/ticker`) — the screened stock's
 * stored facts, with no live price (the search is a single DB read; open the row
 * for a live quote). `market_cap` is raw USD; the two `*_growth_yoy` are the
 * latest trailing year-over-year growth (percent, EPS on the analyst-consensus
 * basis). `in_sp500`/`in_nasdaq100` are definite booleans; everything else may be
 * null until the enriching sync reaches the stock.
 */
export interface StockSearchResult {
  ticker: string
  name: string | null
  sector: string | null
  industry: string | null
  market_cap: number | null
  revenue_growth_yoy: number | null
  eps_growth_yoy: number | null
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
 * Search/filter/sort the screened ≥$1B US universe (`GET /stocks/ticker`). `q`
 * matches (case-insensitive substring) the company name OR ticker, so "NV"
 * surfaces Nvidia and NVDA; `sector`/`industry` take a classification slug (or a
 * raw label — the API slugifies it); `inSp500`/`inNasdaq100` narrow to index
 * members. `sort` (default market cap) and `order` (default desc) order the page;
 * `limit`/`offset` window it. Only screened stocks are returned, so every row
 * carries a market cap.
 */
export async function searchStocks(
  opts: {
    q?: string | null
    sector?: string | null
    industry?: string | null
    inSp500?: boolean | null
    inNasdaq100?: boolean | null
    sort?: StockSearchSort
    order?: SortOrder
    limit?: number
    offset?: number
    signal?: AbortSignal
  } = {},
): Promise<StockSearchResponse> {
  const qs = new URLSearchParams()
  if (opts.q) qs.set('q', opts.q)
  if (opts.sector) qs.set('sector', opts.sector)
  if (opts.industry) qs.set('industry', opts.industry)
  if (opts.inSp500) qs.set('in_sp500', 'true')
  if (opts.inNasdaq100) qs.set('in_nasdaq100', 'true')
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
    `${API_BASE}/stocks/${encodeURIComponent(symbol)}/candles?${qs}`,
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
    `${API_BASE}/stocks/${encodeURIComponent(symbol)}/candles?${qs}`,
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
 * bars in order. The trading `session` (before/after close) came from the
 * retired `/earnings` endpoint's calendar and is no longer sourced, so it's
 * always null (the chip simply shows the date alone).
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
      session: null,
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
 * Analyst recommendation trends for a symbol, newest snapshot first. `latest`
 * is the current month's split and `direction` how the consensus shifted from
 * the prior month (null until there are two snapshots to compare) — the
 * forward-looking part. An empty `trends` means no analyst covers the symbol.
 */
export interface AnalystRecommendations {
  symbol: string
  count: number
  direction: RecommendationDirection | null
  latest: RecommendationTrend | null
  trends: RecommendationTrend[]
}

/** Fetch analyst recommendation trends for a ticker (newest snapshot first). */
export async function getRecommendations(
  symbol: string,
  opts: { signal?: AbortSignal } = {},
): Promise<AnalystRecommendations> {
  const res = await fetch(
    `${API_BASE}/stocks/${encodeURIComponent(symbol)}/recommendations`,
    { signal: opts.signal },
  )
  if (!res.ok) throw await toApiError(res)
  const data = (await res.json()) as AnalystRecommendations
  if (!Array.isArray(data?.trends)) {
    throw new ApiError(res.status, 'Malformed recommendations response')
  }
  return data
}
