import { beforeEach, describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePageMeta } from '@/hooks/usePageMeta'

// jsdom's document persists across tests in a file, so reset the bits the hook touches.
beforeEach(() => {
  document.head
    .querySelectorAll('meta[name="description"]')
    .forEach((meta) => meta.remove())
  document.title = ''
})

describe('usePageMeta', () => {
  it('sets the document title', () => {
    renderHook(() => usePageMeta('Test Page Title'))
    expect(document.title).toBe('Test Page Title')
  })

  it('creates a meta description when none exists', () => {
    renderHook(() => usePageMeta('T', 'A concise description.'))
    const meta = document.head.querySelector('meta[name="description"]')
    expect(meta?.getAttribute('content')).toBe('A concise description.')
  })

  it('updates an existing description in place rather than duplicating it', () => {
    const seed = document.createElement('meta')
    seed.setAttribute('name', 'description')
    seed.setAttribute('content', 'old')
    document.head.appendChild(seed)

    renderHook(() => usePageMeta('T', 'new'))

    const metas = document.head.querySelectorAll('meta[name="description"]')
    expect(metas).toHaveLength(1)
    expect(metas[0].getAttribute('content')).toBe('new')
  })

  it('leaves the description untouched when none is passed', () => {
    renderHook(() => usePageMeta('Title only'))
    expect(document.head.querySelector('meta[name="description"]')).toBeNull()
  })
})
