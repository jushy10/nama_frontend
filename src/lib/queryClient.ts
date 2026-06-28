import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/api'

/**
 * The app's shared React Query client. Defaults are tuned for live market data:
 *
 * - `staleTime` of 30s so revisiting a screen paints instantly from cache and
 *   refreshes in the background, instead of refetching on every mount.
 * - `refetchOnWindowFocus` off — the live views drive their own freshness via an
 *   explicit `refetchInterval`, so we don't also want a refetch on every focus.
 * - `retry` that backs off transient failures once but never retries a 4xx: a
 *   bad ticker is a bad ticker, and retrying only delays the error message.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (
            error instanceof ApiError &&
            error.status >= 400 &&
            error.status < 500
          ) {
            return false
          }
          return failureCount < 1
        },
      },
    },
  })
}
