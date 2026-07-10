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
  useMutation,
  useQueries,
  useQuery,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import {
  ApiError,
  aiSearchStocks,
  getAnnualEarnings,
  getCandles,
  getClassifications,
  getEma,
  getEtfAnalysis,
  getEtfCards,
  getEtfCategories,
  getEtfDetail,
  getIndustryValuation,
  getPeHistory,
  getQuarterlyEarnings,
  getHeatMap,
  getMarketSummary,
  getAnalystInfo,
  getRsi,
  getEarningsAnalysis,
  getRatingsAnalysis,
  getScreener,
  getSectorAnalysis,
  getSectors,
  getStockAnalysis,
  getSupportLevels,
  getTickerCard,
  getTickerCards,
  getTickerType,
  searchEtfs,
  searchStocks,
  type AiScreenResponse,
  type AnalystInfo,
  type AnnualEarnings,
  type CandleSeries,
  type ChartRange,
  type Classifications,
  type EarningsAnalysis,
  type RatingsAnalysis,
  type EmaSeries,
  type EtfAnalysis,
  type EtfCategories,
  type EtfDetail,
  type EtfSearchResponse,
  type EtfSearchSort,
  type IndustryValuation,
  type PeHistory,
  type MarketCapTier,
  type HeatMap,
  type MarketSummary,
  type QuarterlyEarnings,
  type Quote,
  type RsiSeries,
  type ScreenerResult,
  type Sector,
  type SectorAnalysis,
  type SortOrder,
  type StockAnalysis,
  type StockIndex,
  type StockSearchResponse,
  type StockSearchSort,
  type SupportLevels,
  type TickerCard,
  type TickerCardInclude,
  type TickerType,
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
 * The lightweight ETF/equity classification for one ticker (`GET
 * /stocks/type/{ticker}`) — quote-free, so it's what the Search page keys off to
 * pick which detail to render. Idle until `ticker` is set; membership rarely
 * changes, so hold it fresh for an hour (matching the endpoint's own cache).
 */
export function useTickerType(
  ticker: string | null | undefined,
): UseQueryResult<TickerType> {
  return useQuery({
    queryKey: ['ticker-type', ticker],
    queryFn: ({ signal }) => getTickerType(ticker as string, signal),
    enabled: !!ticker,
    staleTime: 60 * 60 * 1000,
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

/**
 * Lean quote cards for several tickers at once, order preserved — the data
 * behind a `QuoteGrid` price strip. `source` picks the endpoint each card is
 * quoted from: `'stock'` (default) reads the `/stocks/ticker/{ticker}` card,
 * `'etf'` the `/stocks/etf/{ticker}` fund detail — so an index-ETF strip quotes
 * through the proper ETF endpoint rather than the stock one. Either way a ticker
 * that fails resolves to `null` rather than failing the batch, so the query
 * effectively never errors. Pass `refetchInterval` for a self-refreshing strip.
 */
export function useQuoteCards(
  tickers: string[],
  opts: {
    refetchInterval?: number
    enabled?: boolean
    source?: 'stock' | 'etf'
  } = {},
): UseQueryResult<(Quote | null)[]> {
  const source = opts.source ?? 'stock'
  return useQuery({
    queryKey: ['quote-cards', source, tickers],
    queryFn: ({ signal }): Promise<(Quote | null)[]> =>
      source === 'etf'
        ? getEtfCards(tickers, { signal })
        : getTickerCards(tickers, { signal }),
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
 * Detected support levels for a ticker (a fixed 1-year daily scan). Keyed by
 * symbol only, so changing the chart's range never refetches it — the levels are
 * a property of the stock, and the chart just draws the ones in view. Idle until
 * `symbol` is set.
 */
export function useSupportLevels(
  symbol: string | null | undefined,
): UseQueryResult<SupportLevels> {
  return useQuery({
    queryKey: ['support-levels', symbol],
    queryFn: ({ signal }) => getSupportLevels(symbol as string, { signal }),
    enabled: !!symbol,
  })
}

/**
 * EMA overlay (the 20/50/200 lines) for a ticker over the chart's range. Keyed
 * by symbol *and* range so the lines are fetched on the same window as the
 * candles they sit under (unlike support levels, which are range-independent).
 * `enabled` lets the caller pay for it only while the overlay is switched on.
 */
export function useEma(
  symbol: string | null | undefined,
  range: ChartRange,
  enabled = true,
): UseQueryResult<EmaSeries> {
  return useQuery({
    queryKey: ['ema', symbol, range],
    queryFn: ({ signal }) => getEma(symbol as string, { range, signal }),
    enabled: !!symbol && enabled,
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
 * A ticker's full analyst coverage — the buy/hold/sell trends, the consensus
 * price target, and the upgrade/downgrade event feed — in one read. Idle until
 * `symbol` is set.
 */
export function useAnalystInfo(
  symbol: string | null | undefined,
): UseQueryResult<AnalystInfo> {
  return useQuery({
    queryKey: ['analyst-info', symbol],
    queryFn: ({ signal }) => getAnalystInfo(symbol as string, { signal }),
    enabled: !!symbol,
  })
}

/**
 * The AI analysis for a ticker (`GET /stocks/{symbol}/analysis`) — a
 * plain-language buy/hold/sell read the detail view shows in a card. It's the
 * slowest of the stock reads (a live model call), so it loads on its own; the
 * backend caches it briefly, so revisits paint from cache. Idle until `symbol`
 * is set.
 */
export function useStockAnalysis(
  symbol: string | null | undefined,
): UseQueryResult<StockAnalysis> {
  return useQuery({
    queryKey: ['stock-analysis', symbol],
    queryFn: ({ signal }) => getStockAnalysis(symbol as string, { signal }),
    enabled: !!symbol,
  })
}

/**
 * The AI earnings analysis for a ticker
 * (`GET /stocks/{symbol}/earnings/analysis`) — a plain-language read of the
 * company's earnings story the earnings tab shows in a card above the charts.
 * Like `useStockAnalysis` it's a live model call, so it loads on its own and the
 * backend caches it briefly. Idle until `symbol` is set *and* `enabled` is true —
 * the detail view passes whether the earnings tab is open, so this (slow, paid)
 * call only fires once the user visits that tab, not on every detail-page load.
 * The result stays cached across tab switches, so returning to the tab is instant.
 */
export function useEarningsAnalysis(
  symbol: string | null | undefined,
  enabled = true,
): UseQueryResult<EarningsAnalysis> {
  return useQuery({
    queryKey: ['earnings-analysis', symbol],
    queryFn: ({ signal }) => getEarningsAnalysis(symbol as string, { signal }),
    enabled: !!symbol && enabled,
    // Held fresh for five minutes — matches the endpoint's own Cache-Control,
    // so toggling away from the Earnings tab and back doesn't re-fire this slow,
    // paid model call (a disabled-then-re-enabled query would otherwise refetch
    // the moment it's stale, which with the default staleTime is immediately).
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * The AI ratings review for a ticker
 * (`GET /stocks/ticker/{ticker}/analyst-info/analysis`) — a plain-language read
 * of what Wall Street thinks (an overall verdict + a few findings) the Analysts
 * tab shows in a card above the ratings. Like `useEarningsAnalysis` it's a live
 * (slow, paid) model call gated on the tab being open, held fresh for five
 * minutes so toggling away and back doesn't re-fire it. Idle until `symbol` is
 * set *and* `enabled` is true.
 */
export function useRatingsAnalysis(
  symbol: string | null | undefined,
  enabled = true,
): UseQueryResult<RatingsAnalysis> {
  return useQuery({
    queryKey: ['ratings-analysis', symbol],
    queryFn: ({ signal }) => getRatingsAnalysis(symbol as string, { signal }),
    enabled: !!symbol && enabled,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * The industry P/E benchmark for a stock's own industry (`GET
 * /stocks/industries/{industry}/pe`) — the median multiple its peers trade on
 * plus the interquartile range, the anchor the detail view compares the stock's
 * own P/E against. Idle until `industry` is set (the caller passes the loaded
 * card's `industry` slug, so an unclassified stock never fires it). The benchmark
 * moves slowly (a daily universe sweep), so it's held fresh for ten minutes.
 */
export function useIndustryValuation(
  industry: string | null | undefined,
): UseQueryResult<IndustryValuation> {
  return useQuery({
    queryKey: ['industry-valuation', industry],
    queryFn: ({ signal }) => getIndustryValuation(industry as string, signal),
    enabled: !!industry,
    staleTime: 10 * 60 * 1000,
  })
}

/**
 * A stock's trailing-P/E history (`GET /stocks/ticker/{ticker}/pe-history`) — one
 * P/E per past earnings release, the backward-looking companion to the detail
 * card's live multiple. Idle until `symbol` is set (rides the loaded ticker).
 * Best-effort: an uncovered symbol resolves to an empty series and the card
 * self-hides. Held fresh for ten minutes — the series only extends when a new
 * quarter reports.
 */
export function usePeHistory(
  symbol: string | null | undefined,
): UseQueryResult<PeHistory> {
  return useQuery({
    queryKey: ['pe-history', symbol],
    queryFn: ({ signal }) => getPeHistory(symbol as string, signal),
    enabled: !!symbol,
    staleTime: 10 * 60 * 1000,
  })
}

/** The day's snapshot for every tracked market sector. */
export function useSectors(): UseQueryResult<Sector[]> {
  return useQuery({
    queryKey: ['sectors'],
    queryFn: ({ signal }) => getSectors(signal),
  })
}

/**
 * The AI read of today's sector board (which sectors lead/lag + the market's
 * tone). The backend regenerates it at most every ~15 min and the call is
 * metered, so keep it stale-tolerant and don't retry — a 502/503 (model briefly
 * unavailable or not configured) just leaves the widget hidden.
 */
export function useSectorAnalysis(): UseQueryResult<SectorAnalysis> {
  return useQuery({
    queryKey: ['sector-analysis'],
    queryFn: ({ signal }) => getSectorAnalysis(signal),
    staleTime: 15 * 60 * 1000,
    retry: false,
  })
}

/**
 * The AI overview of how the US market has moved over the past year, month and
 * week. Regenerated at most every ~15 min and metered, so — like the sector read
 * — keep it stale-tolerant and don't retry: a 502/503 (model briefly unavailable
 * or not configured) just leaves the widget hidden.
 */
export function useMarketSummary(): UseQueryResult<MarketSummary> {
  return useQuery({
    queryKey: ['market-summary'],
    queryFn: ({ signal }) => getMarketSummary(signal),
    staleTime: 15 * 60 * 1000,
    retry: false,
  })
}

/**
 * The market heat map for an index (S&P 500 / Nasdaq-100) — the sector →
 * industry → stock treemap. Structure and tile sizes come from the stored
 * universe; the colours are live quotes, and the backend caches the board ~1 min,
 * so keep it briefly stale-tolerant. `keepPreviousData` holds the old board on
 * screen while flipping the index toggle, so it doesn't blank between fetches.
 */
export function useHeatMap(index: StockIndex): UseQueryResult<HeatMap> {
  return useQuery({
    queryKey: ['heat-map', index],
    queryFn: ({ signal }) => getHeatMap(index, signal),
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
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
  sectors: string[]
  industries: string[]
  inSp500: boolean
  inNasdaq100: boolean
  marketCaps: MarketCapTier[]
  sort: StockSearchSort | null
  order: SortOrder
  limit: number
  offset: number
  /** Skip the request while false — e.g. a typeahead with an empty box, so no
   *  default page loads to fall back on. Defaults to on. */
  enabled?: boolean
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
        sectors: params.sectors,
        industries: params.industries,
        inSp500: params.inSp500 || null,
        inNasdaq100: params.inNasdaq100 || null,
        marketCaps: params.marketCaps,
        // No sort → send neither param, so the backend uses its default order.
        sort: params.sort ?? undefined,
        order: params.sort ? params.order : undefined,
        limit: params.limit,
        offset: params.offset,
        signal,
      }),
    placeholderData: keepPreviousData,
    enabled: params.enabled ?? true,
  })
}

/**
 * The AI-driven screen (`GET /stocks/ai-search`) as a mutation — it's an imperative
 * action (fired when the user submits a plain-English request), not a reactive query,
 * so a `useMutation` fits: call `.mutate(query)` (or `.mutateAsync`) and read
 * `.isPending` / `.error` for the button state. The result carries the interpreted
 * filters, which the page applies to its manual controls (so the ordinary
 * `useStockSearch` then renders the results and the user can tweak the filters). A
 * blank query is a 400 and a translation failure a 502 — both surface via `.error`.
 */
export function useAiStockScreen(): UseMutationResult<
  AiScreenResponse,
  Error,
  string
> {
  return useMutation({
    mutationFn: (query: string) => aiSearchStocks(query),
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
  categories: string[]
  sort: EtfSearchSort
  order: SortOrder
  limit: number
  offset: number
  /** Skip the request while false — e.g. a typeahead with an empty box, so no
   *  default page loads to fall back on. Defaults to on. */
  enabled?: boolean
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
        categories: params.categories,
        sort: params.sort,
        order: params.order,
        limit: params.limit,
        offset: params.offset,
        signal,
      }),
    placeholderData: keepPreviousData,
    enabled: params.enabled ?? true,
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
 * One fund's live detail (quote + fund profile) with every opt-in block
 * attached — the detail page shows the size/cost stats, yield and trailing
 * returns, so it requests `metrics`, `dividends` and `performance`. Idle until
 * `ticker` is set. Errors with an `ApiError` 404 when the ticker isn't a
 * screened ETF (Search only renders the fund detail once a ticker classifies as
 * one).
 */
export function useEtfDetail(
  ticker: string | null | undefined,
): UseQueryResult<EtfDetail> {
  return useQuery({
    queryKey: ['etf-detail', ticker],
    queryFn: ({ signal }) =>
      getEtfDetail(ticker as string, {
        include: ['metrics', 'dividends', 'performance'],
        signal,
      }),
    enabled: !!ticker,
  })
}

/**
 * The AI analysis for a fund (`GET /stocks/etf/{ticker}/analysis`) — the ETF
 * sibling of `useStockAnalysis`, a plain-language buy/hold/sell read the fund
 * detail view shows in a card. It's the slowest of the fund reads (a live model
 * call), so it loads on its own; the backend caches it briefly, so revisits
 * paint from cache. Idle until `ticker` is set.
 */
export function useEtfAnalysis(
  ticker: string | null | undefined,
): UseQueryResult<EtfAnalysis> {
  return useQuery({
    queryKey: ['etf-analysis', ticker],
    queryFn: ({ signal }) => getEtfAnalysis(ticker as string, { signal }),
    enabled: !!ticker,
  })
}
