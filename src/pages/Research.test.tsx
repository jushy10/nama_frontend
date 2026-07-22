import { afterEach, describe, expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import { renderWithProviders, screen } from '@/test/test-utils'
import Research from '@/pages/Research'

const resultSample = {
  question: 'Compare NVDA and AMD on growth and valuation',
  answer:
    'NVDA trades at a **higher multiple** than AMD, but its revenue growth is also faster.',
  steps: [
    {
      tool: 'search_stocks',
      arguments: { query: 'NVDA' },
      output: '{"results": [{"ticker": "NVDA"}]}',
      is_error: false,
    },
    {
      tool: 'search_stocks',
      arguments: { query: 'AMD' },
      output: '{"results": [{"ticker": "AMD"}]}',
      is_error: false,
    },
  ],
  disclaimer:
    'AI-generated for informational and educational purposes only. Not financial advice.',
  model: 'us.anthropic.claude-sonnet-5',
  generated_at: '2026-07-22T14:30:00Z',
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Research', () => {
  it('renders the ask box with example prompts and no answer yet', () => {
    renderWithProviders(<Research />)

    expect(
      screen.getByRole('heading', { name: /ask the market a question/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ask/i })).toBeInTheDocument()
    // One-tap starters render as chips.
    expect(
      screen.getByText('How is the market feeling today?'),
    ).toBeInTheDocument()
    // No answer card before the first question.
    expect(screen.queryByText(/you asked/i)).not.toBeInTheDocument()
  })

  it('submits a question and renders the answer with the agent trace', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(resultSample),
    })
    vi.stubGlobal('fetch', fetchMock)

    const { user } = renderWithProviders(<Research />)
    await user.type(
      screen.getByRole('textbox', { name: /ask a market research question/i }),
      'Compare NVDA and AMD on growth and valuation',
    )
    await user.click(screen.getByRole('button', { name: /^ask$/i }))

    // The POST goes to the agent endpoint with the question as the body.
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('/agents/research')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(init?.body as string)).toEqual({
      question: 'Compare NVDA and AMD on growth and valuation',
    })

    // Answer (with the model's **bold** rendered as emphasis, not literal
    // asterisks), trace summary, and the service-authored disclaimer.
    expect(await screen.findByText('higher multiple')).toBeInTheDocument()
    expect(screen.queryByText(/\*\*/)).not.toBeInTheDocument()
    expect(
      screen.getByText(/show the agent's work \(2 tool calls\)/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/not financial advice/i)).toBeInTheDocument()
  })

  it('surfaces the API error inline when the agent call fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: () => Promise.resolve({ detail: 'Rate limit exceeded' }),
      }),
    )

    const { user } = renderWithProviders(<Research />)
    await user.click(screen.getByText('How is the market feeling today?'))

    expect(await screen.findByText(/rate limit exceeded/i)).toBeInTheDocument()
    // No answer card on a failure.
    expect(screen.queryByText(/you asked/i)).not.toBeInTheDocument()
  })
})
