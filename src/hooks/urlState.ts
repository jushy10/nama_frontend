import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * Small typed helpers for reading and writing the URL query string, so a page's
 * view — the stock detail's active tab, a screener's filters and sort — lives in
 * the address bar. That makes every such view shareable, bookmarkable, and
 * restorable on refresh or Back/Forward, instead of trapped in component state.
 *
 * The read helpers turn a raw `?key=` into a typed value (validating against an
 * allowed set where one exists, so an off-vocabulary or hand-edited param can
 * never drive a control). The write helpers mutate a `URLSearchParams` in place
 * and *delete* the key when the value equals its default, so a pristine view
 * keeps a clean URL and only the knobs you actually turned show up.
 */

/** Read a single string param, trimmed; `''` when absent. */
export function readString(params: URLSearchParams, key: string): string {
  return (params.get(key) ?? '').trim()
}

/**
 * Read a param constrained to a known set — the fallback stands in when the key
 * is absent or carries a value outside `allowed` (a stale or hand-edited URL).
 */
export function readEnum<T extends string>(
  params: URLSearchParams,
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const raw = params.get(key)
  return raw && (allowed as readonly string[]).includes(raw)
    ? (raw as T)
    : fallback
}

/**
 * Read a comma-separated list, dropping blanks and duplicates; `[]` when absent.
 * With `allowed`, values outside the set are filtered out (so a bad slug in the
 * URL can't reach a typed control).
 */
export function readList(
  params: URLSearchParams,
  key: string,
  allowed?: readonly string[],
): string[] {
  const raw = params.get(key)
  if (!raw) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of raw.split(',')) {
    const v = part.trim()
    if (!v || seen.has(v)) continue
    if (allowed && !(allowed as readonly string[]).includes(v)) continue
    seen.add(v)
    out.push(v)
  }
  return out
}

/** Read a boolean flag — `1`/`true` is true, anything else (incl. absent) false. */
export function readBool(params: URLSearchParams, key: string): boolean {
  const raw = params.get(key)
  return raw === '1' || raw === 'true'
}

/** Read a base-10 integer; the fallback stands in when absent or unparseable. */
export function readInt(
  params: URLSearchParams,
  key: string,
  fallback: number,
): number {
  const raw = params.get(key)
  if (raw == null) return fallback
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) ? n : fallback
}

/** Set `key` to the trimmed string, or delete it when empty / equal to `fallback`. */
export function writeString(
  params: URLSearchParams,
  key: string,
  value: string,
  fallback = '',
): void {
  const v = value.trim()
  if (v && v !== fallback) params.set(key, v)
  else params.delete(key)
}

/** Set `key` to `value`, or delete it when it equals `fallback` (the default). */
export function writeEnum<T extends string>(
  params: URLSearchParams,
  key: string,
  value: T,
  fallback: T,
): void {
  if (value !== fallback) params.set(key, value)
  else params.delete(key)
}

/** Set `key` to a comma-joined list, or delete it when the list is empty. */
export function writeList(
  params: URLSearchParams,
  key: string,
  values: readonly string[],
): void {
  if (values.length) params.set(key, values.join(','))
  else params.delete(key)
}

/** Set `key` to `1` when true, else delete it (an off flag is the default). */
export function writeBool(
  params: URLSearchParams,
  key: string,
  value: boolean,
): void {
  if (value) params.set(key, '1')
  else params.delete(key)
}

/** Set `key` to the integer, or delete it when it equals `fallback` (the default). */
export function writeInt(
  params: URLSearchParams,
  key: string,
  value: number,
  fallback: number,
): void {
  if (value !== fallback) params.set(key, String(value))
  else params.delete(key)
}

/**
 * The current search params plus an `update` that mutates them without clobbering
 * the keys it doesn't touch. `update` takes a mutator run against a *copy* of the
 * live params (via the functional form of `setSearchParams`, so several updates in
 * one tick compose instead of racing) and navigates with `replace` — a filter
 * tweak or a tab switch shouldn't pile a new entry onto the Back stack, it should
 * just keep the address bar honest so Back leaves the page you're on.
 */
export function useUrlState() {
  const [searchParams, setSearchParams] = useSearchParams()
  const update = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          mutate(next)
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )
  return { searchParams, update }
}
