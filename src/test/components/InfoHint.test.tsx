import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen } from '@/test/test-utils'
import InfoHint from '@/components/InfoHint'

describe('InfoHint', () => {
  it('keeps its detail out of the DOM until the hint is hovered', async () => {
    const { user } = renderWithProviders(
      <InfoHint title="A rough guide that varies by sector." />,
    )
    const icon = screen.getByLabelText('More information')
    expect(icon).toBeInTheDocument()
    // The fine-print lives in the tooltip, so it stays out of the layout until
    // the reader asks for it.
    expect(
      screen.queryByText(/rough guide that varies by sector/i),
    ).not.toBeInTheDocument()

    await user.hover(icon)
    expect(
      await screen.findByText(/rough guide that varies by sector/i),
    ).toBeInTheDocument()
  })
})
