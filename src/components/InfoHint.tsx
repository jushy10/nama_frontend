import { Tooltip } from '@mui/material'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'

/**
 * A subtle ⓘ beside a card's title that tucks the methodology fine-print into a
 * hover/tap tooltip — so the header stays clean without dropping the
 * explanation. Touch opens it on tap (no long-press) and holds it long enough
 * to read. Used by the valuation cards, whose "a rough guide…" footnotes are
 * secondary to the headline verdict.
 */
export default function InfoHint({ title }: { title: string }) {
  return (
    <Tooltip
      title={title}
      arrow
      enterTouchDelay={0}
      leaveTouchDelay={4000}
      slotProps={{ tooltip: { sx: { maxWidth: 280 } } }}
    >
      <InfoOutlinedIcon
        role="img"
        aria-label="More information"
        tabIndex={0}
        sx={{
          fontSize: '1rem',
          color: 'text.disabled',
          cursor: 'help',
          outline: 'none',
          '&:hover, &:focus-visible': { color: 'text.secondary' },
        }}
      />
    </Tooltip>
  )
}
