import { Box, Button, Chip, Stack, Typography } from '@mui/material'

/** One active filter: a stable `key`, its display `label`, and how to remove it. */
export type ActiveChip = { key: string; label: string; onDelete: () => void }

/**
 * The active-filter summary row that sits under the screener's filter bar: one
 * removable chip per applied filter (the specifics the compact multi-select
 * fields only show as a count), plus a single "Clear all" that resets everything.
 * Renders nothing when no filter is active, so the row appears only when it has
 * something to say.
 */
export default function ActiveFilters({
  chips,
  onClearAll,
}: {
  chips: ActiveChip[]
  onClearAll: () => void
}) {
  if (chips.length === 0) return null
  return (
    <Stack
      direction="row"
      sx={{ mt: 2, flexWrap: 'wrap', gap: 0.75, alignItems: 'center' }}
    >
      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary',
          mr: 0.5,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          fontWeight: 700,
        }}
      >
        Filters
      </Typography>
      {chips.map((c) => (
        <Chip
          key={c.key}
          label={c.label}
          onDelete={c.onDelete}
          size="small"
          variant="outlined"
          sx={{
            borderColor: 'divider',
            bgcolor: 'action.hover',
            fontWeight: 500,
            '& .MuiChip-deleteIcon': {
              color: 'text.secondary',
              '&:hover': { color: 'error.main' },
            },
          }}
        />
      ))}
      <Box sx={{ flex: 1 }} />
      <Button
        onClick={onClearAll}
        size="small"
        sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
      >
        Clear all
      </Button>
    </Stack>
  )
}
