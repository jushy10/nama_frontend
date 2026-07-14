import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen } from '@/test/test-utils'
import NewsCard from '@/components/NewsCard'
import type { NewsArticle, StockNews } from '@/lib/api'

const article = (overrides: Partial<NewsArticle> = {}): NewsArticle => ({
  id: 'a1',
  title: 'Apple unveils a new chip',
  published_at: '2026-07-13T12:00:00Z',
  publisher: 'Reuters',
  link: 'https://example.com/apple-chip',
  summary: 'The company announced its latest silicon at an event today.',
  content_type: 'STORY',
  thumbnail_url: null,
  is_video: false,
  ...overrides,
})

const data = (overrides: Partial<StockNews> = {}): StockNews => {
  const articles = overrides.articles ?? [article()]
  return {
    symbol: 'AAPL',
    count: articles.length,
    latest: articles[0] ?? null,
    articles,
    ...overrides,
  }
}

describe('NewsCard', () => {
  it('renders the lead headline, publisher, and its summary', () => {
    renderWithProviders(<NewsCard data={data()} />)
    expect(screen.getByText('Apple unveils a new chip')).toBeInTheDocument()
    expect(screen.getByText('Reuters')).toBeInTheDocument()
    expect(screen.getByText(/latest silicon/i)).toBeInTheDocument()
    // The header's freshness pill reflects the newest story's recency.
    expect(screen.getByText(/^Latest/)).toBeInTheDocument()
  })

  it('links the lead story out to its source in a new tab', () => {
    renderWithProviders(<NewsCard data={data()} />)
    const link = screen.getByText('Apple unveils a new chip').closest('a')
    expect(link).toHaveAttribute('href', 'https://example.com/apple-chip')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })

  it('badges a video item', () => {
    renderWithProviders(
      <NewsCard data={data({ articles: [article({ is_video: true })] })} />,
    )
    expect(screen.getByText('Video')).toBeInTheDocument()
  })

  it('collapses past the first several and reveals the rest on "show all"', async () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      article({ id: `a${i}`, title: `Story number ${i}`, link: null }),
    )
    const { user } = renderWithProviders(
      <NewsCard data={data({ articles: many })} />,
    )
    // The 10th story is hidden under the collapsed feed…
    expect(screen.queryByText('Story number 9')).not.toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: /show all 10 headlines/i }),
    )
    // …and appears once expanded.
    expect(screen.getByText('Story number 9')).toBeInTheDocument()
  })

  it('renders an empty state when there is no news', () => {
    renderWithProviders(
      <NewsCard data={data({ articles: [], latest: null })} />,
    )
    expect(screen.getByText('No recent news')).toBeInTheDocument()
    expect(screen.getByText(/recent headlines for AAPL/i)).toBeInTheDocument()
  })
})
