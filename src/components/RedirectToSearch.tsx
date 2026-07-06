import { Navigate, useSearchParams } from 'react-router-dom'

/**
 * The stock and fund detail views used to live at `/stocks` and `/etfs`; they
 * now share the unified `/search`. This keeps those old URLs (bookmarks, shared
 * links, the deployed ETF pages) working by forwarding to `/search`, carrying
 * any `?symbol=` through and replacing history so Back skips the dead URL.
 */
export default function RedirectToSearch() {
  const [params] = useSearchParams()
  const symbol = params.get('symbol')
  const to = symbol ? `/search?symbol=${encodeURIComponent(symbol)}` : '/search'
  return <Navigate to={to} replace />
}
