import { ToggleButton, ToggleButtonGroup } from '@mui/material'
import type { ChartRange } from '@/lib/api'

// Curated subset of the API's ranges — the ones worth a one-tap button. Every
// price chart shares this row so they all present one mental model.
const RANGE_OPTIONS: ChartRange[] = [
  '1D',
  '7D',
  '1M',
  '3M',
  '6M',
  '1Y',
  '5Y',
  '10Y',
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
      // One connected row that scrolls sideways when it can't fit (a phone),
      // rather than wrapping into cramped, broken-bordered rows. minWidth:0 lets
      // the group shrink inside a flex parent so it scrolls instead of spilling.
      sx={{
        flexWrap: 'nowrap',
        minWidth: 0,
        maxWidth: '100%',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        '&::-webkit-scrollbar': { display: 'none' },
      }}
    >
      {RANGE_OPTIONS.map((r) => (
        <ToggleButton
          key={r}
          value={r}
          // flexShrink:0 keeps each button its natural size so the row scrolls;
          // a taller tap target on xs (the wrapped rows were only ~26px).
          sx={{
            px: 1.5,
            py: { xs: 0.75, sm: 0.25 },
            minHeight: { xs: 36, sm: 0 },
            flexShrink: 0,
          }}
        >
          {r}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  )
}
