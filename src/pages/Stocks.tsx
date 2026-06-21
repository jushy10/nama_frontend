import { useState, type FormEvent } from 'react'
import { ApiError, getStock, type Stock } from '@/lib/api'
import StockCard from '@/components/StockCard'

type Status =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'success'; stock: Stock }

export default function Stocks() {
  const [symbol, setSymbol] = useState('')
  const [status, setStatus] = useState<Status>({ state: 'idle' })

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const query = symbol.trim().toUpperCase()
    if (!query) return

    setStatus({ state: 'loading' })
    try {
      const stock = await getStock(query)
      setStatus({ state: 'success', stock })
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Could not reach the server. Please try again.'
      setStatus({ state: 'error', message })
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="mb-2 text-3xl font-bold text-indigo-500">Stock Search</h1>
      <p className="mb-6 text-gray-400">
        Enter a ticker symbol to see a live snapshot from Alpaca.
      </p>

      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          type="text"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          placeholder="e.g. AAPL"
          aria-label="Ticker symbol"
          autoFocus
          className="flex-1 rounded-md border border-gray-700 bg-gray-800 px-4 py-2 text-white uppercase placeholder:text-gray-500 placeholder:normal-case focus:border-indigo-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={status.state === 'loading' || !symbol.trim()}
          className="rounded-md bg-indigo-600 px-5 py-2 font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status.state === 'loading' ? 'Searching…' : 'Search'}
        </button>
      </form>

      <div className="mt-8">
        {status.state === 'loading' && (
          <p className="text-center text-gray-400">Loading…</p>
        )}
        {status.state === 'error' && (
          <div
            role="alert"
            className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-300"
          >
            {status.message}
          </div>
        )}
        {status.state === 'success' && <StockCard stock={status.stock} />}
      </div>
    </div>
  )
}
