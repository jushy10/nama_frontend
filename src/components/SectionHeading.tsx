import { Box, Stack, Typography } from '@mui/material'
import type { ReactNode } from 'react'

interface Props {
  /** A small leading glyph, tinted blue to match the home-page section heads. */
  icon?: ReactNode
  title: string
  /** Muted line beneath the title. */
  subtitle?: ReactNode
  /** Trailing content pinned to the right of the row (a toggle, a chip, …). */
  action?: ReactNode
  component?: 'h2' | 'h3'
}

/**
 * A section head in the home-page idiom: a small blue icon, a bold title, and
 * an optional muted subtitle — with room for a right-aligned action. Keeps the
 * stock-detail cards reading like the "Markets today" band on the landing page.
 */
export default function SectionHeading({
  icon,
  title,
  subtitle,
  action,
  component = 'h2',
}: Props) {
  return (
    <Stack
      direction="row"
      spacing={2}
      sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          {icon && (
            <Box
              sx={{ display: 'inline-flex', color: 'primary.main', flexShrink: 0 }}
            >
              {icon}
            </Box>
          )}
          <Typography variant="h6" component={component} sx={{ fontWeight: 600 }}>
            {title}
          </Typography>
        </Stack>
        {subtitle && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {action}
    </Stack>
  )
}
