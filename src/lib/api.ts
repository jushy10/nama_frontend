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

export interface Stock {
  symbol: string
  name: string | null
  exchange: string | null
  price: number
  change: number | null
  change_percent: number | null
  open: number | null
  high: number | null
  low: number | null
  previous_close: number | null
  volume: number | null
  bid: number | null
  ask: number | null
  spread: number | null
  as_of: string | null
  market_cap: number | null
  dividend_per_share: number | null
  dividend_yield: number | null
  performance: StockPerformance | null
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

/** A trading suggestion derived from RSI: one of three plain calls. */
export type RsiAction = 'Buy' | 'Sell' | 'Hold'

/**
 * Map an RSI series to a Buy/Sell/Hold call: oversold (cheap, may rebound) →
 * Buy, overbought (hot, may cool) → Sell, anything between → Hold. Returns null
 * when there's no reading to judge.
 */
export function rsiVerdict(rsi: RsiSeries): RsiAction | null {
  if (rsi.latest == null) return null
  if (rsi.latest <= rsi.oversold) return 'Buy'
  if (rsi.latest >= rsi.overbought) return 'Sell'
  return 'Hold'
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
 * roughly 30–250 candles — dense enough to read, sparse enough to stay legible.
 */
export function defaultTimeframe(range: ChartRange): Timeframe {
  switch (range) {
    case '1D':
      return '5Min'
    case '5D':
      return '30Min'
    case '1M':
    case '3M':
    case '6M':
    case '1Y':
    case 'YTD':
      return '1Day'
    case '2Y':
    case '5Y':
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

/** Fetch a single stock snapshot by ticker symbol. */
export async function getStock(
  symbol: string,
  opts: { signal?: AbortSignal } = {},
): Promise<Stock> {
  const res = await fetch(`${API_BASE}/stocks/${encodeURIComponent(symbol)}`, {
    signal: opts.signal,
  })
  if (!res.ok) throw await toApiError(res)
  return (await res.json()) as Stock
}

/**
 * Fetch several snapshots concurrently, preserving the order of `symbols`. A
 * symbol that fails (bad ticker, network blip) resolves to `null` instead of
 * rejecting the whole batch, so one dud never blanks the rest of the row.
 */
export async function getStocks(
  symbols: string[],
  opts: { signal?: AbortSignal } = {},
): Promise<(Stock | null)[]> {
  return Promise.all(symbols.map((s) => getStock(s, opts).catch(() => null)))
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
  } else {
    qs.set('range', range)
  }
  const res = await fetch(
    `${API_BASE}/stocks/${encodeURIComponent(symbol)}/candles?${qs}`,
    { signal: opts.signal },
  )
  if (!res.ok) throw await toApiError(res)
  const data = (await res.json()) as CandleSeries
  if (!Array.isArray(data?.candles)) {
    throw new ApiError(res.status, 'Malformed candle response')
  }
  return data
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
