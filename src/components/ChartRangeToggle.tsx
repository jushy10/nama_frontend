import { ToggleButton, ToggleButtonGroup } from '@mui/material'
import type { ChartRange } from '@/lib/api'

// Curated subset of the API's ranges — the ones worth a one-tap button. Every
// price chart shares this row so they all present one mental model.
const RANGE_OPTIONS: ChartRange[] = [
  '1D',
  '5D',
  '1M',
  '3M',
  '6M',
  '1Y',
  '5Y',
  'YTD',
]

/** The shared row of one-tap chart-range buttons. */
export default function ChartRangeToggle({
  value,
  onChange,
  ariaLabel = 'Chart range',
}: {
  value: ChartRange
  onChange: (range: ChartRange) => void
  ariaLabel?: string
}) {
  return (
    <ToggleButtonGroup
      size="small"
      exclusive
      value={value}
      onChange={(_, next: ChartRange | null) => next && onChange(next)}
      aria-label={ariaLabel}
      sx={{ flexWrap: 'wrap' }}
    >
      {RANGE_OPTIONS.map((r) => (
        <ToggleButton key={r} value={r} sx={{ px: 1.5, py: 0.25 }}>
          {r}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  )
}
