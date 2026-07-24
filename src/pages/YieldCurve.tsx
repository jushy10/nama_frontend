import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Stack,
  Typography,
} from '@mui/material'
import TimelineOutlined from '@mui/icons-material/TimelineOutlined'
import { curveShape, type CurveShape } from '@/lib/api'
import { errorMessage, useYieldCurve, useYieldHistory } from '@/hooks/queries'
import { usePageMeta } from '@/hooks/usePageMeta'
import YieldCurveChart from '@/components/YieldCurveChart'
import YieldHistoryChart from '@/components/YieldHistoryChart'
import PageHero from '@/components/PageHero'

// The dynamic reading for each shape — the "what does it mean" the page keys on
// the live spread. Kept beside the page since it's presentation copy, not data.
const SHAPE_COPY: Record<
  CurveShape,
  { label: string; color: 'success' | 'warning' | 'error'; blurb: string }
> = {
  normal: {
    label: 'Normal (upward) curve',
    color: 'success',
    blurb:
      'The 10-year yields more than the 2-year, so the curve slopes up. Investors are paid more to lend for longer — the market’s normal, healthy state. No recession signal here.',
  },
  flat: {
    label: 'Flat curve',
    color: 'warning',
    blurb:
      'The 2-year and 10-year yields are nearly level — a flat curve. It often marks a transition between a normal and an inverted shape, with the market unsure about the path of rates.',
  },
  inverted: {
    label: 'Inverted curve',
    color: 'error',
    blurb:
      'The 2-year yields more than the 10-year — the curve is inverted. The market expects the Fed to cut rates, usually because it sees a slowdown ahead. An inversion has preceded every US recession since the 1950s.',
  },
}

const fmtPct = (n: number | null | undefined) =>
  n == null ? '—' : `${n.toFixed(2)}%`

const fmtSpread = (n: number | null | undefined) =>
  n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(2)}`

/** A labelled stat tile (2Y / 10Y / spread). */
function Stat({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color?: string
}) {
  return (
    <Box
      sx={{ bgcolor: 'action.hover', borderRadius: 2, px: 2, py: 1.5, flex: 1 }}
    >
      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          mt: 0.25,
          fontSize: '1.5rem',
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          color: color ?? 'text.primary',
        }}
      >
        {value}
      </Typography>
    </Box>
  )
}

export default function YieldCurve() {
  usePageMeta(
    'US Treasury Yield Curve — 2Y, 10Y & the 2s10s Spread | Nama Insights',
    'The live US Treasury yield curve across every maturity, the 2Y and 10Y yields over time, and a plain-English read of what a normal vs inverted curve means.',
  )

  const curveQuery = useYieldCurve()
  const historyQuery = useYieldHistory()

  const curve = curveQuery.data
  const shape = curveShape(curve?.spread_2s10s)
  const copy = SHAPE_COPY[shape]
  const spreadColor =
    curve?.spread_2s10s == null
      ? undefined
      : curve.spread_2s10s < 0
        ? 'error.main'
        : 'success.main'

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, sm: 5 } }}>
      <PageHero
        eyebrowIcon={TimelineOutlined}
        eyebrow="Treasury yields"
        title="The Treasury yield curve"
        subtitle="What the US government pays to borrow across every maturity, from 1 month to 30 years, plus the 2Y/10Y gap the market watches as a recession signal."
      />

      {curveQuery.isLoading && (
        <Stack sx={{ alignItems: 'center', py: 8 }}>
          <CircularProgress />
        </Stack>
      )}

      {curveQuery.isError && (
        <Alert severity="error" variant="outlined" sx={{ mt: 4 }}>
          {errorMessage(curveQuery.error)}
        </Alert>
      )}

      {curveQuery.isSuccess && curve && (
        <>
          {/* Live reading: the shape chip + the three headline numbers. */}
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            sx={{ mt: 3, alignItems: { sm: 'center' } }}
          >
            <Chip
              label={copy.label}
              color={copy.color}
              variant="outlined"
              sx={{ fontWeight: 600, fontSize: '0.9rem', py: 2, px: 0.5 }}
            />
            <Typography variant="body2" color="text.secondary">
              As of {new Date(curve.as_of).toLocaleDateString()}
            </Typography>
          </Stack>

          <Stack
            direction="row"
            spacing={1.5}
            sx={{ mt: 2, flexWrap: 'wrap', rowGap: 1.5 }}
          >
            <Stat label="2-year" value={fmtPct(curve.two_year)} />
            <Stat label="10-year" value={fmtPct(curve.ten_year)} />
            <Stat
              label="2s10s spread"
              value={fmtSpread(curve.spread_2s10s)}
              color={spreadColor}
            />
          </Stack>

          {/* The curve snapshot. */}
          <Card variant="outlined" sx={{ mt: 4, borderColor: 'divider' }}>
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
                Today’s curve
              </Typography>
              <Typography color="text.secondary" variant="body2" sx={{ mb: 2 }}>
                Yield by maturity, shortest to longest. An upward slope is
                normal; a downward one is inverted.
              </Typography>
              <YieldCurveChart curve={curve} />
            </CardContent>
          </Card>

          {/* The 2Y/10Y history. */}
          <Card variant="outlined" sx={{ mt: 3, borderColor: 'divider' }}>
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
                2Y vs 10Y over time
              </Typography>
              <Typography color="text.secondary" variant="body2" sx={{ mb: 2 }}>
                When the blue 2Y line rises above the gold 10Y line, the curve
                is inverted — those stretches are shaded.
              </Typography>
              {historyQuery.isLoading && (
                <Stack sx={{ alignItems: 'center', py: 6 }}>
                  <CircularProgress />
                </Stack>
              )}
              {historyQuery.isError && (
                <Alert severity="error" variant="outlined">
                  {errorMessage(historyQuery.error)}
                </Alert>
              )}
              {historyQuery.isSuccess && historyQuery.data && (
                <YieldHistoryChart history={historyQuery.data} />
              )}
            </CardContent>
          </Card>

          {/* The explainer, keyed on the live shape. */}
          <Card variant="outlined" sx={{ mt: 3, borderColor: 'divider' }}>
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
                What does it mean?
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 1 }}>
                The yield curve compares what the government pays to borrow for
                a short time versus a long time. Its slope is a live read on
                where the market thinks the economy — and interest rates — are
                headed.
              </Typography>

              <Alert
                severity={copy.color}
                variant="outlined"
                sx={{ mt: 2, '& .MuiAlert-message': { fontWeight: 500 } }}
              >
                Right now: {copy.label.toLowerCase()}. {copy.blurb}
              </Alert>

              <Stack spacing={1.5} sx={{ mt: 3 }}>
                {(['normal', 'flat', 'inverted'] as CurveShape[]).map((s) => {
                  const c = SHAPE_COPY[s]
                  const isCurrent = s === shape
                  return (
                    <Box
                      key={s}
                      sx={{
                        borderLeft: 3,
                        borderColor: `${c.color}.main`,
                        pl: 2,
                        py: 0.5,
                        opacity: isCurrent ? 1 : 0.72,
                      }}
                    >
                      <Typography sx={{ fontWeight: 600 }}>
                        {c.label}
                        {isCurrent && (
                          <Box
                            component="span"
                            sx={{ color: 'text.secondary', fontWeight: 400 }}
                          >
                            {' '}
                            · now
                          </Box>
                        )}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {c.blurb}
                      </Typography>
                    </Box>
                  )
                })}
              </Stack>

              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mt: 3 }}
              >
                Data: US Treasury (par-yield curve) and FRED (2Y/10Y history).
                Informational only — not investment advice.
              </Typography>
            </CardContent>
          </Card>
        </>
      )}
    </Container>
  )
}
