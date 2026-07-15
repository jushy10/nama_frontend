import type { ReactNode } from 'react'
import { Box, Stack, Typography } from '@mui/material'

interface Props {
  /** The band's glyph, shown in a tinted rounded chip (sized by the chip, so
   *  pass a plain icon — no `fontSize` needed). */
  icon: ReactNode
  title: string
  /** Muted line beneath the title, held to a readable measure. */
  subtitle?: ReactNode
  /** Optional trailing control pinned to the right of the title row. */
  action?: ReactNode
  /** Heading level for the title element (default h2). */
  component?: 'h2' | 'h3'
}

/**
 * The section header shared by the home page's full-width bands: an icon in a
 * tinted chip, a confident title, and a muted subtitle. One component so every
 * band reads at the same scale and rhythm — the differing icon + title per band
 * give variety without breaking the system. Sub-cards inside a band (e.g. the
 * two side-by-side AI reads) keep their own lighter headers a level down, which
 * is what makes the page's hierarchy read rather than flatten.
 */
export default function BandHeader({
  icon,
  title,
  subtitle,
  action,
  component = 'h2',
}: Props) {
  return (
    <Box sx={{ mb: { xs: 3.5, sm: 4.5 } }}>
      <Stack direction="row" spacing={1.75} sx={{ alignItems: 'center' }}>
        <Box
          aria-hidden
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 44,
            height: 44,
            borderRadius: 2.5,
            flexShrink: 0,
            color: 'primary.main',
            bgcolor: 'action.hover',
            border: 1,
            borderColor: 'divider',
            '& svg': { fontSize: 24 },
          }}
        >
          {icon}
        </Box>
        <Typography
          variant="h4"
          component={component}
          sx={{
            fontWeight: 700,
            letterSpacing: '-0.02em',
            fontSize: { xs: '1.5rem', sm: '1.85rem' },
          }}
        >
          {title}
        </Typography>
        {action && <Box sx={{ ml: 'auto', pl: 2 }}>{action}</Box>}
      </Stack>
      {subtitle && (
        <Typography
          variant="body1"
          color="text.secondary"
          sx={{
            mt: 1.25,
            maxWidth: '64ch',
            fontSize: { xs: '0.95rem', sm: '1.02rem' },
          }}
        >
          {subtitle}
        </Typography>
      )}
    </Box>
  )
}
