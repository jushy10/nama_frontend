import {
  Box,
  Card,
  CardContent,
  Divider,
  Stack,
  Typography,
} from '@mui/material'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat'
import type { AnalystRatingChanges, RatingChange } from '@/lib/api'

// How many events to list — the feed can carry up to ~50, far more than a card
// should show, so it lists the most recent and notes the rest.
const MAX_ROWS = 8

/** The action label, direction colour, and icon for one event — keyed off the
 *  derived up/down flags first, then Yahoo's action code for the neutral cases. */
function actionMeta(change: RatingChange): {
  label: string
  color: string
  Icon: typeof TrendingFlatIcon
} {
  if (change.is_upgrade)
    return { label: 'Upgraded', color: 'success.main', Icon: TrendingUpIcon }
  if (change.is_downgrade)
    return { label: 'Downgraded', color: 'error.main', Icon: TrendingDownIcon }
  const action = (change.action ?? '').toLowerCase()
  const label =
    action === 'init'
      ? 'Initiated'
      : action === 'reit'
        ? 'Reiterated'
        : action === 'main'
          ? 'Maintained'
          : 'Updated'
  return { label, color: 'text.secondary', Icon: TrendingFlatIcon }
}

/** A whole-dollar price target, e.g. `$350`; empty string when absent. */
function fmtTarget(n: number | null): string {
  return n == null
    ? ''
    : `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

/** "Jun 9" from an ISO date, parsed as a *local* date so a UTC-midnight string
 *  doesn't format a day early in negative offsets (same care as the other cards). */
function dayLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

/** The grade move "Hold → Buy", or just the single grade when there's no distinct
 *  prior (an initiation), or null when the source gave no grade at all. */
function gradeMove(change: RatingChange): string | null {
  if (
    change.to_grade &&
    change.from_grade &&
    change.from_grade !== change.to_grade
  ) {
    return `${change.from_grade} → ${change.to_grade}`
  }
  return change.to_grade ?? change.from_grade ?? null
}

/** The target move "$335 → $350", or just "$350", or null when there's no target. */
function targetMove(change: RatingChange): string | null {
  const current = fmtTarget(change.target_current)
  if (!current) return null
  const prior = fmtTarget(change.target_prior)
  if (prior && change.target_prior !== change.target_current) {
    return `${prior} → ${current}`
  }
  return current
}

/** One event row: a direction icon, the firm + a "Upgraded · Hold → Buy · $335 → $350"
 *  detail line, and the date. */
function Row({ change }: { change: RatingChange }) {
  const { label, color, Icon } = actionMeta(change)
  const rest = [gradeMove(change), targetMove(change)]
    .filter(Boolean)
    .join(' · ')
  return (
    <Stack
      direction="row"
      spacing={1.5}
      sx={{ py: 1.25, alignItems: 'flex-start' }}
    >
      <Box sx={{ color, display: 'flex', mt: '2px' }}>
        <Icon fontSize="small" />
      </Box>
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
          {change.firm}
        </Typography>
        <Typography variant="caption">
          <Box component="span" sx={{ color, fontWeight: 600 }}>
            {label}
          </Box>
          {rest && (
            <Box component="span" sx={{ color: 'text.secondary' }}>
              {' · '}
              {rest}
            </Box>
          )}
        </Typography>
      </Box>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ whiteSpace: 'nowrap', mt: '2px' }}
      >
        {dayLabel(change.published_at)}
      </Typography>
    </Stack>
  )
}

/**
 * The upgrade/downgrade feed — the sell-side's individual rating actions behind the
 * monthly consensus, newest first: firm, the grade move, the price-target move, and
 * the date, colour-coded by direction. Lists the most recent `MAX_ROWS` and notes how
 * many more there are. Renders nothing when there are no events, so the stock page
 * self-hides the section rather than showing an empty card.
 */
export default function RatingChangesCard({
  ratingChanges,
}: {
  ratingChanges: AnalystRatingChanges
}) {
  const changes = ratingChanges.changes
  if (changes.length === 0) return null
  const shown = changes.slice(0, MAX_ROWS)

  return (
    <Card variant="outlined" sx={{ borderColor: 'divider' }}>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
          Recent Analyst Activity
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {`${changes.length} rating ${
            changes.length === 1 ? 'action' : 'actions'
          }`}
        </Typography>

        <Stack sx={{ mt: 1.5 }} divider={<Divider flexItem />}>
          {shown.map((change, i) => (
            <Row
              key={`${change.firm}-${change.published_at}-${i}`}
              change={change}
            />
          ))}
        </Stack>

        {changes.length > MAX_ROWS && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mt: 1.5, display: 'block' }}
          >
            Showing the {MAX_ROWS} most recent of {changes.length}.
          </Typography>
        )}
      </CardContent>
    </Card>
  )
}
