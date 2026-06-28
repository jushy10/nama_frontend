/**
 * React Query hooks over the nama API client. These are the app's data layer:
 * components call a hook and get `{ data, isLoading, isError, ... }`, with
 * caching, request dedup, abort-on-unmount, and background refresh handled by
 * React Query — no more hand-rolled `useEffect` + `AbortController` per screen.
 *
 * Every hook forwards React Query's `signal` to the fetcher, so an in-flight
 * request is aborted when its inputs change or the component unmounts.
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import {
  ApiError,
  getCandles,
  getEarnings,
  getRsi,
  getScreener,
  getSectors,
  getStock,
  getStocks,
  type CandleSeries,
  type ChartRange,
  type EarningsHistory,
  type RsiSeries,
  type ScreenerResult,
  type Sector,
  type Stock,
  type StockIndex,
} from '@/lib/api'

/**
 * A user-facing message for a failed query: the API's `detail` when the failure
 * was an `ApiError`, otherwise a generic fallback (network blip, offline, …).
 */
export function errorMessage(
  error: unknown,
  fallback = 'Could not reach the server. Please try again.',
): string {
  return error instanceof ApiError ? error.message : fallback
}

/** Live snapshot for one ticker. Idle (no request) until `symbol` is set. */
export function useStock(
  symbol: string | null | undefined,
): UseQueryResult<Stock> {
  return useQuery({
    queryKey: ['stock', symbol],
    queryFn: ({ signal }) => getStock(symbol as string, { signal }),
    enabled: !!symbol,
  })
}

/**
 * Snapshots for several tickers at once, order preserved. A symbol that fails
 * resolves to `null` rather than failing the batch (see `getStocks`), so this
 * query effectively never errors. Pass `refetchInterval` for a self-refreshing
 * strip; pass `enabled: false` to hold the request.
 */
export function useStocks(
  symbols: string[],
  opts: { refetchInterval?: number; enabled?: boolean } = {},
): UseQueryResult<(Stock | null)[]> {
  return useQuery({
    queryKey: ['stocks', symbols],
    queryFn: ({ signal }) => getStocks(symbols, { signal }),
    enabled: opts.enabled ?? symbols.length > 0,
    refetchInterval: opts.refetchInterval,
  })
}

/** Candlestick series for a ticker over a range. Idle until `symbol` is set. */
export function useCandles(
  symbol: string | null | undefined,
  range: ChartRange,
): UseQueryResult<CandleSeries> {
  return useQuery({
    queryKey: ['candles', symbol, range],
    queryFn: ({ signal }) => getCandles(symbol as string, { range, signal }),
    enabled: !!symbol,
  })
}

/**
 * Trailing 5-year price return (percent), derived from the first vs. last close
 * of a ticker's 5Y daily candles — the snapshot's `performance` object stops at
 * 1Y. Rides the symbol only, independent of the chart's range selector; returns
 * `null` while loading or when the series is too short to measure.
 */
export function useFiveYearReturn(
  symbol: string | null | undefined,
): number | null {
  const { data } = useQuery({
    queryKey: ['candles', symbol, '5Y'],
    queryFn: ({ signal }) =>
      getCandles(symbol as string, { range: '5Y', signal }),
    enabled: !!symbol,
    select: (series): number | null => {
      const c = series.candles
      const first = c[0]?.close
      const last = c[c.length - 1]?.close
      if (c.length >= 2 && first) return ((last - first) / first) * 100
      return null
    },
  })
  return data ?? null
}

/** RSI series for a ticker (fixed 14-period daily). Idle until `symbol` is set. */
export function useRsi(
  symbol: string | null | undefined,
): UseQueryResult<RsiSeries> {
  return useQuery({
    queryKey: ['rsi', symbol],
    queryFn: ({ signal }) => getRsi(symbol as string, { signal }),
    enabled: !!symbol,
  })
}

/** Recent quarterly earnings for a ticker. Idle until `symbol` is set. */
export function useEarnings(
  symbol: string | null | undefined,
  limit = 8,
): UseQueryResult<EarningsHistory> {
  return useQuery({
    queryKey: ['earnings', symbol, limit],
    queryFn: ({ signal }) => getEarnings(symbol as string, { limit, signal }),
    enabled: !!symbol,
  })
}

/** The day's snapshot for every tracked market sector. */
export function useSectors(): UseQueryResult<Sector[]> {
  return useQuery({
    queryKey: ['sectors'],
    queryFn: ({ signal }) => getSectors(signal),
  })
}

/** Filters for the screener query; `null` means "don't narrow on this axis". */
export interface ScreenerParams {
  index: StockIndex | null
  sector: string | null
  limit: number
}

/**
 * Top gainers/losers for the chosen filters. Pass `refetchInterval` to re-poll;
 * a failed background poll keeps the last good result (React Query retains
 * `data` and only flags `isError`), so callers can show the stale table.
 */
export function useScreener(
  params: ScreenerParams,
  opts: { refetchInterval?: number } = {},
): UseQueryResult<ScreenerResult> {
  return useQuery({
    queryKey: ['screener', params.index, params.sector, params.limit],
    queryFn: ({ signal }) => getScreener({ ...params, signal }),
    refetchInterval: opts.refetchInterval,
  })
}
