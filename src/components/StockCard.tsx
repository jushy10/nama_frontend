import { useState } from 'react'
import { stockLogoUrl, type Stock } from '@/lib/api'

const fmt = (n: number | null) =>
  n == null
    ? '—'
    : n.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })

const fmtInt = (n: number | null) =>
  n == null ? '—' : n.toLocaleString('en-US')

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-800/60 px-3 py-2">
      <dt className="text-xs tracking-wide text-gray-500 uppercase">{label}</dt>
      <dd className="mt-0.5 font-medium text-gray-100 tabular-nums">{value}</dd>
    </div>
  )
}

export default function StockCard({ stock }: { stock: Stock }) {
  const up = (stock.change ?? 0) >= 0
  const changeColor = up ? 'text-emerald-400' : 'text-red-400'
  const sign = up ? '+' : ''
  const asOf = stock.as_of ? new Date(stock.as_of).toLocaleString() : '—'
  const [logoFailed, setLogoFailed] = useState(false)

  return (
    <div className="rounded-2xl border border-gray-700 bg-gray-900/60 p-6 shadow-lg">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          {!logoFailed && (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-1.5">
              <img
                src={stockLogoUrl(stock.symbol)}
                alt={`${stock.symbol} logo`}
                className="h-full w-full object-contain"
                loading="lazy"
                onError={() => setLogoFailed(true)}
              />
            </div>
          )}
          <div>
            <h2 className="text-2xl font-bold text-white">{stock.symbol}</h2>
            {stock.name && (
              <p className="text-sm text-gray-400">{stock.name}</p>
            )}
            {stock.exchange && (
              <span className="mt-1 inline-block rounded bg-gray-700 px-2 py-0.5 text-xs text-gray-300">
                {stock.exchange}
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-white tabular-nums">
            ${fmt(stock.price)}
          </div>
          <div className={`text-sm font-medium tabular-nums ${changeColor}`}>
            {sign}
            {fmt(stock.change)} ({sign}
            {fmt(stock.change_percent)}%)
          </div>
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Open" value={fmt(stock.open)} />
        <Stat label="High" value={fmt(stock.high)} />
        <Stat label="Low" value={fmt(stock.low)} />
        <Stat label="Prev Close" value={fmt(stock.previous_close)} />
        <Stat label="Bid" value={fmt(stock.bid)} />
        <Stat label="Ask" value={fmt(stock.ask)} />
        <Stat label="Spread" value={fmt(stock.spread)} />
        <Stat label="Volume" value={fmtInt(stock.volume)} />
      </dl>

      <p className="mt-4 text-right text-xs text-gray-500">As of {asOf}</p>
    </div>
  )
}
