import type { ReactNode } from 'react'
import { Box, Stack, Typography } from '@mui/material'
import type { SvgIconComponent } from '@mui/icons-material'
import { heroWash } from '@/components/heroWash'
import { fontFamilyMono } from '@/theme'

interface Props {
  /** Small glyph beside the eyebrow, tinted gold like the home-hero markers. */
  eyebrowIcon: SvgIconComponent
  /** Mono, uppercase kicker naming the tool (e.g. "Stock screener"). */
  eyebrow: string
  /** The page's h1 — kept a step smaller than the home hero so the site's
   *  headline hierarchy still reads home > section. */
  title: ReactNode
  /** One muted line under the headline, held to a comfortable measure. */
  subtitle: ReactNode
  /** Optional control pinned to the band's top-right (e.g. a refresh button). */
  action?: ReactNode
  /** Primary-action slot: the plain-English screen box sits here, so a visitor's
   *  first move is to ask rather than read. */
  children?: ReactNode
}

/**
 * A rounded header band in the home-hero idiom: the soft blue→gold `heroWash`
 * over paper plus a masked grid for depth, a mono eyebrow, a confident headline,
 * a muted subline, and a slot for the page's primary action. Shared by the stock
 * and ETF screeners so both read as one product with the landing page, instead of
 * each opening on a bare title. Sized as a card so it sits in the same contained
 * column (and shares the same shape) as the filter and results panels below it;
 * the stack eases in once on load (reduced-motion safe).
 */
export default function PageHero({
  eyebrowIcon: EyebrowIcon,
  eyebrow,
  title,
  subtitle,
  action,
  children,
}: Props) {
  return (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 4,
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        // Assign the wash to backgroundImage so the paper base still reads beneath.
        backgroundImage: (theme) => heroWash(theme),
        px: { xs: 2.5, sm: 4, md: 5 },
        py: { xs: 4, sm: 5, md: 6 },
      }}
    >
      {/* A faint grid, masked to fade toward the edges — texture behind the copy
          without competing with it. Mirrors the landing-page hero. */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          backgroundImage: (theme) =>
            `linear-gradient(${theme.palette.divider} 1px, transparent 1px), linear-gradient(90deg, ${theme.palette.divider} 1px, transparent 1px)`,
          backgroundSize: '44px 44px',
          maskImage:
            'radial-gradient(circle at 20% 0%, rgba(0,0,0,0.45), transparent 72%)',
          WebkitMaskImage:
            'radial-gradient(circle at 20% 0%, rgba(0,0,0,0.45), transparent 72%)',
        }}
      />

      {action && (
        <Box
          sx={{
            position: 'absolute',
            top: { xs: 12, sm: 16 },
            right: { xs: 12, sm: 20 },
            zIndex: 1,
            color: 'text.secondary',
          }}
        >
          {action}
        </Box>
      )}

      <Stack
        spacing={{ xs: 2, sm: 2.5 }}
        sx={{
          position: 'relative',
          maxWidth: { xs: '100%', md: 920 },
          '@keyframes pageHeroIn': {
            from: { opacity: 0, transform: 'translateY(14px)' },
            to: { opacity: 1, transform: 'none' },
          },
          animation: 'pageHeroIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) both',
          '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
        }}
      >
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: 'center', color: 'text.secondary' }}
        >
          <EyebrowIcon sx={{ fontSize: 17, color: 'secondary.main' }} />
          <Typography
            variant="caption"
            sx={{
              fontFamily: fontFamilyMono,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.14em',
              fontSize: '0.72rem',
            }}
          >
            {eyebrow}
          </Typography>
        </Stack>

        <Typography
          variant="h1"
          component="h1"
          sx={{
            fontWeight: 700,
            letterSpacing: '-0.03em',
            lineHeight: 1.04,
            fontSize: { xs: '2rem', sm: '2.6rem', md: '3rem' },
          }}
        >
          {title}
        </Typography>

        <Typography
          sx={{
            color: 'text.secondary',
            fontSize: { xs: '1rem', sm: '1.1rem' },
            lineHeight: 1.6,
            maxWidth: 660,
          }}
        >
          {subtitle}
        </Typography>

        {children && <Box sx={{ pt: 1 }}>{children}</Box>}
      </Stack>
    </Box>
  )
}
