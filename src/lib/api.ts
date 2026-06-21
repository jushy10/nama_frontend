/** Client for the nama backend API. */

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

// Baked in at build time (see VITE_API_URL); falls back to the public API so
// `npm run dev` works without extra setup.
const API_BASE = import.meta.env.VITE_API_URL || 'https://api.namainsights.com'

/** Fetch a single stock snapshot by ticker symbol. */
export async function getStock(symbol: string): Promise<Stock> {
  const res = await fetch(`${API_BASE}/stocks/${encodeURIComponent(symbol)}`)
  if (!res.ok) {
    let detail = `Request failed (${res.status})`
    try {
      const body = (await res.json()) as { detail?: string }
      if (body?.detail) detail = body.detail
    } catch {
      // Non-JSON error body — keep the default message.
    }
    throw new ApiError(res.status, detail)
  }
  return (await res.json()) as Stock
}
