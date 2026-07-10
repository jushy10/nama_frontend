import type { ReactNode } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Box, Container, Stack, Typography } from '@mui/material'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import GridViewIcon from '@mui/icons-material/GridView'
import TableRowsIcon from '@mui/icons-material/TableRows'
import AccountBalanceIcon from '@mui/icons-material/AccountBalance'
import DonutLargeIcon from '@mui/icons-material/DonutLarge'
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import SectionHeading from '@/components/SectionHeading'
import { heroWash } from '@/components/heroWash'

/** One feature tile: where it goes, its glyph, copy, and its grid footprint at
 *  the md breakpoint (columns × rows of the 6-wide bento). Smaller breakpoints
 *  collapse to a simple 1/2-up stack, so only the md span is configured here. */
interface Tile {
  to: string
  icon: ReactNode
  title: string
  body: string
  /** md column span (of 6) and row span. */
  cols: number
  rows?: number
  /** The featured tile carries the brand wash instead of plain paper. */
  featured?: boolean
}

const TILES: Tile[] = [
  {
    to: '/search',
    icon: <AutoAwesomeIcon />,
    title: 'AI deep-dive on any name',
    body: 'Search a stock or ETF and get an AI read in plain English — a fair-value verdict woven from fundamentals, earnings, analyst coverage and the options market.',
    cols: 3,
    rows: 2,
    featured: true,
  },
  {
    to: '/heatmap',
    icon: <GridViewIcon />,
    title: 'Market heat map',
    body: 'The whole market on one screen — every sector and industry, sized by market cap and coloured by the day’s move.',
    cols: 3,
  },
  {
    to: '/screener',
    icon: <TableRowsIcon />,
    title: 'Stock screener',
    body: 'Filter 1,000+ US stocks by growth, valuation, sector and index — sorted your way.',
    cols: 3,
  },
  {
    to: '/etf-screener',
    icon: <AccountBalanceIcon />,
    title: 'ETF screener',
    body: 'Rank the top US funds by assets, cost and category.',
    cols: 2,
  },
  {
    to: '/sectors',
    icon: <DonutLargeIcon />,
    title: 'Sector pulse',
    body: 'See which sectors lead and lag, today and over time.',
    cols: 2,
  },
  {
    to: '/mag7',
    icon: <WorkspacePremiumIcon />,
    title: 'The Magnificent 7',
    body: 'The megacaps that move the market, compared side by side.',
    cols: 2,
  },
]

/** A single clickable bento tile — icon, title, body, and a quiet "arrow"
 *  affordance that slides on hover, with the whole card lifting. */
function FeatureTile({ tile }: { tile: Tile }) {
  return (
    <Box
      component={RouterLink}
      to={tile.to}
      sx={{
        gridColumn: { xs: '1 / -1', sm: 'span 1', md: `span ${tile.cols}` },
        gridRow: { md: tile.rows ? `span ${tile.rows}` : 'span 1' },
        display: 'flex',
        flexDirection: 'column',
        textDecoration: 'none',
        color: 'text.primary',
        p: { xs: 2.5, md: 3 },
        borderRadius: 3,
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        backgroundImage: tile.featured ? (theme) => heroWash(theme) : 'none',
        transition: (theme) =>
          theme.transitions.create(
            ['transform', 'box-shadow', 'border-color'],
            {
              duration: theme.transitions.duration.shorter,
            },
          ),
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 6,
          borderColor: 'primary.main',
        },
        '&:hover .bento-arrow': { transform: 'translateX(4px)', opacity: 1 },
      }}
    >
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 40,
          height: 40,
          borderRadius: 2,
          color: tile.featured ? 'secondary.main' : 'primary.main',
          bgcolor: 'action.hover',
          mb: 1.5,
        }}
      >
        {tile.icon}
      </Box>
      <Typography
        variant={tile.featured ? 'h5' : 'h6'}
        sx={{ fontWeight: 700, mb: 0.75 }}
      >
        {tile.title}
      </Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ lineHeight: 1.6, flexGrow: 1 }}
      >
        {tile.body}
      </Typography>
      <Stack
        direction="row"
        spacing={0.5}
        sx={{
          mt: 2,
          alignItems: 'center',
          color: 'primary.main',
          fontWeight: 600,
          fontSize: '0.8125rem',
        }}
      >
        <span>Explore</span>
        <ArrowForwardIcon
          className="bento-arrow"
          sx={{
            fontSize: 16,
            opacity: 0.7,
            transition: (theme) =>
              theme.transitions.create(['transform', 'opacity'], {
                duration: theme.transitions.duration.shorter,
              }),
          }}
        />
      </Stack>
    </Box>
  )
}

/**
 * A bento grid of what the app can do — the screener, heat map, sector reads,
 * ETF screen, Mag-7 comparison, and (featured, in the brand wash) the AI
 * deep-dive. Mixed tile sizes on desktop for a modern, magazine-y feel; a clean
 * two-up on tablets and a single stack on phones. Every tile is a link into the
 * matching page, lifting on hover so the whole band reads as interactive.
 */
export default function FeatureBento() {
  return (
    <Box sx={{ borderTop: 1, borderColor: 'divider' }}>
      <Container maxWidth="xl" sx={{ py: { xs: 5, sm: 7 } }}>
        <Box sx={{ mb: { xs: 3, sm: 4 } }}>
          <SectionHeading
            icon={<AutoAwesomeIcon fontSize="small" />}
            title="Everything in one place"
            subtitle="Screen, compare and dig in — the whole US market, read by AI."
          />
        </Box>
        <Box
          sx={{
            display: 'grid',
            gap: { xs: 2, md: 2.5 },
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, 1fr)',
              md: 'repeat(6, 1fr)',
            },
            gridAutoRows: { md: 'minmax(160px, auto)' },
          }}
        >
          {TILES.map((tile) => (
            <FeatureTile key={tile.to} tile={tile} />
          ))}
        </Box>
      </Container>
    </Box>
  )
}
