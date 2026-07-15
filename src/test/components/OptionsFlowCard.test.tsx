import { describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, screen } from '@/test/test-utils'
import OptionsFlowCard from '@/components/OptionsFlowCard'
import type { OptionContract, OptionsFlow } from '@/lib/api'

function contract(
  type: 'call' | 'put',
  strike: number,
  extra: Partial<OptionContract> = {},
): OptionContract {
  return {
    expiration: '2026-07-31',
    strike,
    type,
    bid: 2.9,
    ask: 3.1,
    last_price: 3.0,
    mid: 3.0,
    volume: 100,
    open_interest: 500,
    implied_volatility: 28.4,
    in_the_money: false,
    premium: 30000,
    volume_oi_ratio: 0.2,
    unusual: false,
    ...extra,
  }
}

const HOT_CALL = contract('call', 100, {
  volume: 500,
  open_interest: 100,
  volume_oi_ratio: 5,
  unusual: true,
  premium: 150000,
})

const FLOW: OptionsFlow = {
  ticker: 'AAPL',
  spot: 101.5,
  expiration: '2026-07-31',
  expirations: ['2026-07-31', '2026-09-18'],
  summary: {
    call_volume: 500,
    put_volume: 300,
    total_volume: 800,
    call_open_interest: 100,
    put_open_interest: 900,
    put_call_volume_ratio: 0.6,
    put_call_oi_ratio: 9,
    call_premium: 150000,
    put_premium: 90000,
    net_premium: 60000,
  },
  calls: [HOT_CALL],
  puts: [contract('put', 95)],
  unusual: [HOT_CALL],
}

const noop = () => {}

describe('OptionsFlowCard', () => {
  it('renders the flow summary — volumes, put/call, and net premium into calls', () => {
    renderWithProviders(
      <OptionsFlowCard
        data={FLOW}
        expiration={null}
        onExpirationChange={noop}
      />,
    )
    expect(screen.getByText('Options flow')).toBeInTheDocument()
    expect(screen.getByText('0.60')).toBeInTheDocument() // put/call by volume
    expect(screen.getByText(/800 contracts/)).toBeInTheDocument() // total volume
    expect(screen.getByText(/into calls/i)).toBeInTheDocument()
    expect(screen.getByText(/\+\$60K/)).toBeInTheDocument() // net premium, positive
  })

  it('lists the unusual-activity standouts', () => {
    renderWithProviders(
      <OptionsFlowCard
        data={FLOW}
        expiration={null}
        onExpirationChange={noop}
      />,
    )
    expect(screen.getByText('Unusual activity')).toBeInTheDocument()
    // The volume-vs-OI that flagged it (500 traded against 100 outstanding).
    expect(screen.getByText(/500 vol vs 100 OI/)).toBeInTheDocument()
  })

  it('shows the calls chain by default and switches to puts on the toggle', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <OptionsFlowCard
        data={FLOW}
        expiration={null}
        onExpirationChange={noop}
      />,
    )
    // Calls side first: the call strike is in the ladder, the put's isn't.
    expect(screen.getByText('$100.00')).toBeInTheDocument()
    expect(screen.queryByText('$95.00')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Puts' }))
    expect(screen.getByText('$95.00')).toBeInTheDocument()
  })

  it('renders a single empty card when the symbol lists no options', () => {
    const empty: OptionsFlow = {
      ticker: 'ZZZZ',
      spot: null,
      expiration: null,
      expirations: [],
      summary: null,
      calls: [],
      puts: [],
      unusual: [],
    }
    renderWithProviders(
      <OptionsFlowCard
        data={empty}
        expiration={null}
        onExpirationChange={noop}
      />,
    )
    expect(screen.getByText('No options chain')).toBeInTheDocument()
    expect(screen.getByText(/No listed options for ZZZZ/)).toBeInTheDocument()
  })

  it('reports the chosen expiry when the selector changes', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(
      <OptionsFlowCard
        data={FLOW}
        expiration={null}
        onExpirationChange={onChange}
      />,
    )
    // Open the MUI select and pick the far expiry.
    await user.click(screen.getByRole('combobox'))
    await user.click(screen.getByRole('option', { name: 'Sep 18, 2026' }))
    expect(onChange).toHaveBeenCalledWith('2026-09-18')
  })
})
