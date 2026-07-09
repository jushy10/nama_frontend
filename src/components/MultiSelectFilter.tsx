import { Autocomplete, Box, Checkbox, Chip, TextField } from '@mui/material'
import CheckBoxIcon from '@mui/icons-material/CheckBox'
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank'

/** One choice in a multi-select: the API `value` (a slug/tier) and its display `label`. */
export type FilterOption = { value: string; label: string }

/**
 * A compact, searchable multi-select for the screener filter bar. Built on
 * Autocomplete so a long list (the ~100 industries) is filtered by typing, with
 * a checkbox per row and close-on-select disabled so several picks land in one
 * open. The field itself stays compact — the per-value chips are rendered by the
 * page's active-filter row below the bar, not crammed inside — so here the input
 * shows just a small count badge, or a muted "Any" placeholder when empty.
 * `value` is the array of selected option values; `onChange` hands back the next.
 */
export default function MultiSelectFilter({
  label,
  options,
  value,
  onChange,
  minWidth = 200,
}: {
  label: string
  options: FilterOption[]
  value: string[]
  onChange: (next: string[]) => void
  // A fixed width or a responsive object (e.g. `{ xs: '100%', md: 180 }`) so the
  // field can go full-width and stack on a phone while staying compact on desktop.
  minWidth?:
    | number
    | string
    | Partial<Record<'xs' | 'sm' | 'md' | 'lg' | 'xl', number | string>>
}) {
  // Autocomplete works in option objects, the page in bare values — map between
  // them at the edge; an unknown value is simply dropped.
  const selected = options.filter((o) => value.includes(o.value))
  return (
    <Autocomplete
      multiple
      size="small"
      options={options}
      value={selected}
      onChange={(_, next) => onChange(next.map((o) => o.value))}
      getOptionLabel={(o) => o.label}
      isOptionEqualToValue={(o, v) => o.value === v.value}
      disableCloseOnSelect
      sx={{ minWidth }}
      slotProps={{ paper: { sx: { borderRadius: 2 } } }}
      renderOption={(props, option, { selected: isSelected }) => {
        const { key, ...liProps } = props
        return (
          <Box component="li" key={key} {...liProps} sx={{ py: 0.25 }}>
            <Checkbox
              icon={<CheckBoxOutlineBlankIcon fontSize="small" />}
              checkedIcon={<CheckBoxIcon fontSize="small" />}
              checked={isSelected}
              size="small"
              sx={{ mr: 1, p: 0.5 }}
            />
            {option.label}
          </Box>
        )
      }}
      // Keep the field compact: a single count badge in place of the usual chips
      // (the per-value chips live in the page's active-filter row below the bar).
      renderValue={(vals) =>
        vals.length ? (
          <Chip
            label={vals.length}
            size="small"
            color="primary"
            sx={{
              height: 20,
              '& .MuiChip-label': {
                px: 0.75,
                fontSize: '0.72rem',
                fontWeight: 700,
              },
            }}
          />
        ) : null
      }
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={value.length ? undefined : 'Any'}
          slotProps={{
            ...params.slotProps,
            // Float the label always, so the "Any" placeholder is never hidden
            // behind a centered label.
            inputLabel: { shrink: true },
          }}
        />
      )}
    />
  )
}
