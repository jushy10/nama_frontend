/**
 * React Query hooks over the nama API client. These are the app's data layer:
 * components call a hook and get `{ data, isLoading, isError, ... }`, with
 * caching, request dedup, abort-on-unmount, and background refresh handled by
 * React Query — no more hand-rolled `useEffect` + `AbortController` per screen.
 *
 * Every hook forwards React Query's `signal` to the fetcher, so an in-flight
 * request is aborted when its inputs change or the component unmounts.
 */
import {
  keepPreviousData,
  useQueries,
  useQuery,
  type UseQueryResult,
} from '@tanstack/react-query'
import {
  ApiError,
  getAnnualEarnings,
  getCandles,
  getClassifications,
  getEtfCategories,
  getEtfDetail,
  getQuarterlyEarnings,
  getRecommendations,
  getRsi,
  getScreener,
  getSectors,
  getTickerCard,
  getTickerCards,
  searchEtfs,
  searchStocks,
  type AnalystRecommendations,
  type AnnualEarnings,
  type CandleSeries,
  type ChartRange,
  type Classifications,
  type EtfCategories,
  type EtfDetail,
  type EtfSearchResponse,
  type EtfSearchSort,
  type MarketCapTier,
  type QuarterlyEarnings,
  type RsiSeries,
  type ScreenerResult,
  type Sector,
  type SortOrder,
  type StockIndex,
  type StockSearchResponse,
  type StockSearchSort,
  type TickerCard,
  type TickerCardInclude,
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

/**
 * The quote card for one ticker, with the requested opt-in blocks attached.
 * Idle (no request) until `ticker` is set. The include list is part of the
 * query key, so a card with different blocks is cached apart.
 */
export function useTickerCard(
  ticker: string | null | undefined,
  include: TickerCardInclude[] = [],
): UseQueryResult<TickerCard> {
  return useQuery({
    queryKey: ['ticker-card', ticker, include],
    queryFn: ({ signal }) =>
      getTickerCard(ticker as string, { include, signal }),
    enabled: !!ticker,
  })
}

/**
 * Lean quote cards for several tickers at once, order preserved. A ticker that
 * fails resolves to `null` rather than failing the batch (see
 * `getTickerCards`), so this query effectively never errors. Pass
 * `refetchInterval` for a self-refreshing strip; pass `enabled: false` to hold
 * the request.
 */
export function useTickerCards(
  tickers: string[],
  opts: { refetchInterval?: number; enabled?: boolean } = {},
): UseQueryResult<(TickerCard | null)[]> {
  return useQuery({
    queryKey: ['ticker-cards', tickers],
    queryFn: ({ signal }) => getTickerCards(tickers, { signal }),
    enabled: opts.enabled ?? tickers.length > 0,
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
 * Candlestick series for several tickers over one range, results in input order.
 * Each entry is its own query keyed the same as `useCandles`, so a symbol shared
 * with a single-ticker chart reuses the cache. A failed symbol surfaces on its
 * own result (`isError`) without sinking the others, which lets a comparison
 * overlay plot the lines that did load. Idle for any empty symbol.
 */
export function useManyCandles(
  symbols: string[],
  range: ChartRange,
): UseQueryResult<CandleSeries>[] {
  return useQueries({
    queries: symbols.map((symbol) => ({
      queryKey: ['candles', symbol, range],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        getCandles(symbol, { range, signal }),
      enabled: !!symbol,
    })),
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

/**
 * The consolidated quarterly earnings series (reported + upcoming quarters in
 * one call) for a ticker — what the earnings card's beat charts run on.
 * Idle until `symbol` is set.
 */
export function useQuarterlyEarnings(
  symbol: string | null | undefined,
): UseQueryResult<QuarterlyEarnings> {
  return useQuery({
    queryKey: ['earnings-quarterly', symbol],
    queryFn: ({ signal }) => getQuarterlyEarnings(symbol as string, { signal }),
    enabled: !!symbol,
  })
}

/**
 * The annual earnings series (reported + upcoming fiscal years in one call) for
 * a ticker — the yearly counterpart of `useQuarterlyEarnings`. Idle until
 * `symbol` is set.
 */
export function useAnnualEarnings(
  symbol: string | null | undefined,
): UseQueryResult<AnnualEarnings> {
  return useQuery({
    queryKey: ['earnings-annual', symbol],
    queryFn: ({ signal }) => getAnnualEarnings(symbol as string, { signal }),
    enabled: !!symbol,
  })
}

/**
 * Analyst recommendation trends for a ticker (the buy/hold/sell split by month).
 * Idle until `symbol` is set.
 */
export function useRecommendations(
  symbol: string | null | undefined,
): UseQueryResult<AnalystRecommendations> {
  return useQuery({
    queryKey: ['recommendations', symbol],
    queryFn: ({ signal }) => getRecommendations(symbol as string, { signal }),
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

/** A universe-search request: the text query, filters, sort, and page window.
 *  A null `sort` means "no sort" — the request omits `sort`/`order` and the
 *  backend returns rows in its own default order. */
export interface StockSearchParams {
  q: string | null
  sector: string | null
  industry: string | null
  inSp500: boolean
  inNasdaq100: boolean
  marketCap: MarketCapTier | null
  sort: StockSearchSort | null
  order: SortOrder
  limit: number
  offset: number
}

/**
 * A page of the screened universe for the given filters/sort/window
 * (`GET /stocks/ticker`). Keeps the previous page's rows on screen while the next
 * loads (`keepPreviousData`), so paging and re-sorting don't flash empty. The
 * index toggles go out only when on — a false toggle means "don't narrow on this
 * axis", not "exclude members".
 */
export function useStockSearch(
  params: StockSearchParams,
): UseQueryResult<StockSearchResponse> {
  return useQuery({
    queryKey: ['stock-search', params],
    queryFn: ({ signal }) =>
      searchStocks({
        q: params.q,
        sector: params.sector,
        industry: params.industry,
        inSp500: params.inSp500 || null,
        inNasdaq100: params.inNasdaq100 || null,
        marketCap: params.marketCap,
        // No sort → send neither param, so the backend uses its default order.
        sort: params.sort ?? undefined,
        order: params.sort ? params.order : undefined,
        limit: params.limit,
        offset: params.offset,
        signal,
      }),
    placeholderData: keepPreviousData,
  })
}

/**
 * The universe's distinct sector + industry slugs for the screener's filter
 * menus. They barely change, so hold them fresh for an hour rather than
 * refetching on every visit.
 */
export function useClassifications(): UseQueryResult<Classifications> {
  return useQuery({
    queryKey: ['classifications'],
    queryFn: ({ signal }) => getClassifications(signal),
    staleTime: 60 * 60 * 1000,
  })
}

/** An ETF universe-search request: the text query, category filter, sort, and page window. */
export interface EtfSearchParams {
  q: string | null
  category: string | null
  sort: EtfSearchSort
  order: SortOrder
  limit: number
  offset: number
}

/**
 * A page of the screened ETF universe for the given filter/sort/window
 * (`GET /stocks/etfs`). Like `useStockSearch`, keeps the previous page's rows on
 * screen while the next loads (`keepPreviousData`), so paging and re-sorting
 * don't flash empty.
 */
export function useEtfSearch(
  params: EtfSearchParams,
): UseQueryResult<EtfSearchResponse> {
  return useQuery({
    queryKey: ['etf-search', params],
    queryFn: ({ signal }) =>
      searchEtfs({
        q: params.q,
        category: params.category,
        sort: params.sort,
        order: params.order,
        limit: params.limit,
        offset: params.offset,
        signal,
      }),
    placeholderData: keepPreviousData,
  })
}

/**
 * The ETF universe's distinct category slugs for the screener's filter menu.
 * They barely change, so hold them fresh for an hour rather than refetching on
 * every visit (the same policy as `useClassifications`).
 */
export function useEtfCategories(): UseQueryResult<EtfCategories> {
  return useQuery({
    queryKey: ['etf-categories'],
    queryFn: ({ signal }) => getEtfCategories(signal),
    staleTime: 60 * 60 * 1000,
  })
}

/**
 * One fund's live detail (quote + fund profile). Idle until `ticker` is set.
 * Errors with an `ApiError` 404 when the ticker isn't a screened ETF, which the
 * fund page reads to redirect a stock symbol back to `/stocks`.
 */
export function useEtfDetail(
  ticker: string | null | undefined,
): UseQueryResult<EtfDetail> {
  return useQuery({
    queryKey: ['etf-detail', ticker],
    queryFn: ({ signal }) => getEtfDetail(ticker as string, signal),
    enabled: !!ticker,
  })
}
