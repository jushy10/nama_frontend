import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'

interface Props {
  /** Panel heading, e.g. "Ask AI to build a screen". */
  heading: string
  /** Controlled request text. */
  value: string
  onChange: (next: string) => void
  /** Fire the screen (Enter or the Screen button). */
  onSubmit: () => void
  /** In-flight state — disables the field and swaps the button label. */
  pending: boolean
  /** Translation error to surface inline under the box, if any. */
  error?: string | null
  placeholder: string
  /** Accessible name for the (label-less) request field. */
  inputAriaLabel: string
  /** One-tap starter prompts. */
  examples: readonly string[]
  onExample: (example: string) => void
  /** Submit-button label; defaults to the screeners' "Screen". */
  submitLabel?: string
  /** In-flight button label; defaults to "Screening…". */
  pendingLabel?: string
}

/**
 * The plain-English screen box, promoted to each screener's primary action and
 * set as a frosted-glass panel over the hero wash: a sparkle-marked heading, a
 * roomy request field with a Screen button, one-tap example prompts, and an
 * inline error slot. Purely presentational — the page owns the request text and
 * the mutation, so the stock and ETF screeners share one look while keeping their
 * own vocabulary. The glass falls back to a solid surface under
 * `prefers-reduced-transparency`.
 */
export default function AiScreenBox({
  heading,
  value,
  onChange,
  onSubmit,
  pending,
  error,
  placeholder,
  inputAriaLabel,
  examples,
  onExample,
  submitLabel = 'Screen',
  pendingLabel = 'Screening…',
}: Props) {
  return (
    <Box
      sx={{
        p: { xs: 2, sm: 2.5 },
        borderRadius: 3,
        border: 1,
        borderColor: (theme) =>
          theme.palette.mode === 'dark'
            ? 'rgba(255,255,255,0.12)'
            : 'rgba(255,255,255,0.85)',
        // Frosted glass over the wash; a legible tint in each mode.
        bgcolor: (theme) =>
          theme.palette.mode === 'dark'
            ? 'rgba(19,21,32,0.55)'
            : 'rgba(255,255,255,0.62)',
        backdropFilter: 'blur(16px) saturate(150%)',
        WebkitBackdropFilter: 'blur(16px) saturate(150%)',
        boxShadow: (theme) =>
          theme.palette.mode === 'dark'
            ? '0 20px 48px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.06)'
            : '0 20px 48px rgba(15,40,90,0.10), inset 0 1px 0 rgba(255,255,255,0.7)',
        // Reduced-transparency users get a plain solid surface, no blur.
        '@media (prefers-reduced-transparency: reduce)': {
          backdropFilter: 'none',
          WebkitBackdropFilter: 'none',
          bgcolor: 'background.paper',
        },
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5 }}>
        <AutoAwesomeIcon fontSize="small" sx={{ color: 'secondary.main' }} />
        <Typography sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}>
          {heading}
        </Typography>
      </Stack>

      <Box
        component="form"
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit()
        }}
        sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}
      >
        <TextField
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={pending}
          sx={{
            flex: '1 1 340px',
            minWidth: { xs: '100%', sm: 340 },
            '& .MuiOutlinedInput-root': { bgcolor: 'background.paper' },
          }}
          slotProps={{
            // aria-label on the native input (a label-less field) so it has an
            // accessible name; the sparkle rides the input adornment.
            htmlInput: { 'aria-label': inputAriaLabel },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <AutoAwesomeIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={!value.trim() || pending}
          startIcon={
            pending ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <AutoAwesomeIcon />
            )
          }
          sx={{ whiteSpace: 'nowrap', px: 3 }}
        >
          {pending ? pendingLabel : submitLabel}
        </Button>
      </Box>

      {/* One-tap example prompts. `useFlexGap` so chips that wrap to a new line
          stay aligned with the first (margin spacing doesn't reset on wrap). */}
      <Stack
        direction="row"
        spacing={1}
        useFlexGap
        sx={{ mt: 1.75, flexWrap: 'wrap', alignItems: 'center' }}
      >
        <Typography
          variant="caption"
          sx={{ color: 'text.secondary', fontWeight: 600, mr: 0.25 }}
        >
          Try
        </Typography>
        {examples.map((ex) => (
          <Chip
            key={ex}
            label={ex}
            size="small"
            variant="outlined"
            onClick={() => onExample(ex)}
            disabled={pending}
            sx={{
              cursor: 'pointer',
              bgcolor: 'background.paper',
              borderColor: 'divider',
              fontWeight: 500,
              '&:hover': {
                borderColor: 'primary.main',
                bgcolor: 'action.hover',
              },
            }}
          />
        ))}
      </Stack>

      {error && (
        <Alert severity="error" variant="outlined" sx={{ mt: 1.75 }}>
          {error}
        </Alert>
      )}
    </Box>
  )
}
