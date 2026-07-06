import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen } from '@/test/test-utils'
import TopHoldingsCard from '@/components/TopHoldingsCard'
import type { EtfHolding } from '@/lib/api'

const holdings: EtfHolding[] = [
  { ticker: 'NVDA', name: 'NVIDIA Corp', weight: 7.89 },
  { ticker: 'AAPL', name: 'Apple Inc', weight: 7.04 },
  { ticker: 'MSFT', name: 'Microsoft Corp', weight: 5.14 },
]

describe('TopHoldingsCard', () => {
  it('lists holdings with their weights', () => {
    renderWithProviders(<TopHoldingsCard holdings={holdings} />)
    expect(
      screen.getByRole('heading', { name: 'Top Holdings' }),
    ).toBeInTheDocument()
    expect(screen.getByText('NVIDIA Corp')).toBeInTheDocument()
    expect(screen.getByText('7.89%')).toBeInTheDocument()
    expect(screen.getByText('5.14%')).toBeInTheDocument()
  })

  it('links each holding to its own stock page', () => {
    renderWithProviders(<TopHoldingsCard holdings={holdings} />)
    expect(screen.getByRole('link', { name: 'NVDA' })).toHaveAttribute(
      'href',
      '/search?symbol=NVDA',
    )
    expect(screen.getByRole('link', { name: 'AAPL' })).toHaveAttribute(
      'href',
      '/search?symbol=AAPL',
    )
  })

  it('renders nothing when holdings are unavailable', () => {
    const { container } = renderWithProviders(<TopHoldingsCard holdings={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
