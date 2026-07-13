import { describe, expect, it } from 'vitest'
import {
  readBool,
  readEnum,
  readInt,
  readList,
  readString,
  writeBool,
  writeEnum,
  writeInt,
  writeList,
  writeString,
} from '@/lib/urlState'

const params = (init: string) => new URLSearchParams(init)

describe('urlState read helpers', () => {
  it('reads a trimmed string, empty when absent', () => {
    expect(readString(params('q=%20nvda%20'), 'q')).toBe('nvda')
    expect(readString(params(''), 'q')).toBe('')
  })

  it('reads an enum, falling back for absent or off-vocabulary values', () => {
    const allowed = ['asc', 'desc'] as const
    expect(readEnum(params('order=asc'), 'order', allowed, 'desc')).toBe('asc')
    expect(readEnum(params('order=sideways'), 'order', allowed, 'desc')).toBe(
      'desc',
    )
    expect(readEnum(params(''), 'order', allowed, 'desc')).toBe('desc')
  })

  it('reads a comma list, dropping blanks and duplicates', () => {
    expect(
      readList(params('sectors=technology,,energy,technology'), 'sectors'),
    ).toEqual(['technology', 'energy'])
    expect(readList(params(''), 'sectors')).toEqual([])
  })

  it('filters a comma list to an allowed set', () => {
    expect(
      readList(params('caps=mega,bogus,small'), 'caps', [
        'mega',
        'large',
        'small',
      ]),
    ).toEqual(['mega', 'small'])
  })

  it('reads a boolean flag from 1/true only', () => {
    expect(readBool(params('sp500=1'), 'sp500')).toBe(true)
    expect(readBool(params('sp500=true'), 'sp500')).toBe(true)
    expect(readBool(params('sp500=0'), 'sp500')).toBe(false)
    expect(readBool(params(''), 'sp500')).toBe(false)
  })

  it('reads an int, falling back when absent or unparseable', () => {
    expect(readInt(params('page=3'), 'page', 1)).toBe(3)
    expect(readInt(params('page=abc'), 'page', 1)).toBe(1)
    expect(readInt(params(''), 'page', 1)).toBe(1)
  })
})

describe('urlState write helpers', () => {
  it('writes a string, deleting when empty or equal to the default', () => {
    const p = params('q=old')
    writeString(p, 'q', '  nvda ')
    expect(p.get('q')).toBe('nvda')
    writeString(p, 'q', '')
    expect(p.has('q')).toBe(false)
  })

  it('writes an enum, deleting when it equals the default', () => {
    const p = params('')
    writeEnum(p, 'order', 'asc', 'desc')
    expect(p.get('order')).toBe('asc')
    writeEnum(p, 'order', 'desc', 'desc')
    expect(p.has('order')).toBe(false)
  })

  it('writes a comma list, deleting when empty', () => {
    const p = params('')
    writeList(p, 'sectors', ['technology', 'energy'])
    expect(p.get('sectors')).toBe('technology,energy')
    writeList(p, 'sectors', [])
    expect(p.has('sectors')).toBe(false)
  })

  it('writes a boolean, deleting when false', () => {
    const p = params('')
    writeBool(p, 'sp500', true)
    expect(p.get('sp500')).toBe('1')
    writeBool(p, 'sp500', false)
    expect(p.has('sp500')).toBe(false)
  })

  it('writes an int, deleting when it equals the default', () => {
    const p = params('')
    writeInt(p, 'page', 2, 1)
    expect(p.get('page')).toBe('2')
    writeInt(p, 'page', 1, 1)
    expect(p.has('page')).toBe(false)
  })

  it('leaves untouched keys alone (a partial update)', () => {
    const p = params('symbol=NVDA&tab=overview')
    writeEnum(p, 'tab', 'fundamentals', 'overview')
    expect(p.get('symbol')).toBe('NVDA')
    expect(p.get('tab')).toBe('fundamentals')
  })
})
