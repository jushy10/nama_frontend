import { useState } from 'react'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Stack,
  Typography,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ScienceOutlined from '@mui/icons-material/ScienceOutlined'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ResearchResult, ResearchStep } from '@/lib/api'
import { errorMessage, useResearch } from '@/lib/queries'
import PageHero from '@/components/PageHero'
import AiScreenBox from '@/components/AiScreenBox'
import AnalysisLoadingCard from '@/components/AnalysisLoadingCard'
import { fontFamilyMono } from '@/theme'

// One-tap starters, each answerable by the agent's current tools (the stock
// screen + market sentiment) so a first tap always lands a real answer.
const EXAMPLES = [
  'How is the market feeling today?',
  'Compare NVDA and AMD on growth and valuation',
  'Which mega-cap tech stock grew revenue fastest?',
  'Is Shopify expensive relative to its growth?',
] as const

// The agent's tool names, translated for the trace. Unknown names fall back to
// the raw name so a backend tool added later still renders.
const TOOL_LABELS: Record<string, string> = {
  search_stocks: 'Searched the stock universe',
  get_market_sentiment: 'Checked market sentiment',
}

/** One row of the agent's work: what it called, with what, and what came back. */
function StepRow({ step, index }: { step: ResearchStep; index: number }) {
  const args = Object.entries(step.arguments)
  return (
    <Box>
      <Stack
        direction="row"
        spacing={1}
        useFlexGap
        sx={{ alignItems: 'center', flexWrap: 'wrap' }}
      >
        <Typography
          variant="body2"
          sx={{
            fontWeight: 600,
            color: step.is_error ? 'error.main' : 'text.primary',
          }}
        >
          {index + 1}. {TOOL_LABELS[step.tool] ?? step.tool}
          {step.is_error && ' (failed)'}
        </Typography>
        {args.map(([key, value]) => (
          <Chip
            key={key}
            size="small"
            variant="outlined"
            label={`${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`}
            sx={{ fontFamily: fontFamilyMono, fontSize: '0.72rem' }}
          />
        ))}
      </Stack>
      <Box
        component="pre"
        sx={{
          m: 0,
          mt: 1,
          p: 1.5,
          borderRadius: 2,
          border: 1,
          borderColor: 'divider',
          bgcolor: 'action.hover',
          fontFamily: fontFamilyMono,
          fontSize: '0.72rem',
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          maxHeight: 200,
          overflow: 'auto',
          color: 'text.secondary',
        }}
      >
        {step.output}
      </Box>
    </Box>
  )
}

/**
 * The agent's prose answer, rendered as markdown. The model naturally reaches
 * for GFM — tables for rankings, bold for key figures, lists for takeaways —
 * so render it properly instead of leaking raw pipes and asterisks. Styling is
 * theme-aware via child selectors; a wide table scrolls inside the card rather
 * than breaking it.
 */
function AnswerBody({ answer }: { answer: string }) {
  return (
    <Box
      sx={{
        lineHeight: 1.7,
        maxWidth: '75ch',
        overflowWrap: 'break-word',
        '& > :first-of-type': { mt: 0 },
        '& > :last-child': { mb: 0 },
        '& p': { my: 1 },
        '& ul, & ol': { my: 1, pl: 3 },
        '& li': { mb: 0.5 },
        '& h1, & h2, & h3, & h4': {
          fontSize: '1.05rem',
          fontWeight: 700,
          mt: 2,
          mb: 1,
        },
        '& table': {
          display: 'block',
          overflowX: 'auto',
          borderCollapse: 'collapse',
          my: 1.5,
        },
        '& th, & td': {
          border: '1px solid',
          borderColor: 'divider',
          px: 1.25,
          py: 0.75,
          textAlign: 'left',
          fontSize: '0.875rem',
          whiteSpace: 'nowrap',
        },
        '& th': { bgcolor: 'action.hover', fontWeight: 600 },
        '& code': {
          fontFamily: fontFamilyMono,
          fontSize: '0.85em',
          bgcolor: 'action.hover',
          px: 0.5,
          borderRadius: 0.5,
        },
      }}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{answer}</ReactMarkdown>
    </Box>
  )
}

/** The finished answer: the question echoed, the prose, and the work shown. */
function AnswerCard({ result }: { result: ResearchResult }) {
  const generated = new Date(result.generated_at)
  return (
    <Card variant="outlined">
      <CardContent
        sx={{ p: { xs: 2, sm: 3 }, '&:last-child': { pb: { xs: 2, sm: 3 } } }}
      >
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: 'center', mb: 0.5 }}
        >
          <AutoAwesomeIcon fontSize="small" sx={{ color: 'primary.main' }} />
          <Typography
            variant="caption"
            sx={{ color: 'text.secondary', fontWeight: 600 }}
          >
            You asked
          </Typography>
        </Stack>
        <Typography
          variant="h6"
          component="h2"
          sx={{ fontWeight: 700, letterSpacing: '-0.01em', mb: 2 }}
        >
          {result.question}
        </Typography>

        <AnswerBody answer={result.answer} />

        {result.steps.length > 0 && (
          <Accordion
            disableGutters
            elevation={0}
            sx={{
              mt: 2.5,
              border: 1,
              borderColor: 'divider',
              borderRadius: 2,
              '&:before': { display: 'none' },
              bgcolor: 'transparent',
            }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Show the agent's work ({result.steps.length}{' '}
                {result.steps.length === 1 ? 'tool call' : 'tool calls'})
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={2}>
                {result.steps.map((step, i) => (
                  <StepRow key={i} step={step} index={i} />
                ))}
              </Stack>
            </AccordionDetails>
          </Accordion>
        )}

        <Divider sx={{ my: 2 }} />
        <Typography
          variant="caption"
          sx={{ color: 'text.secondary', display: 'block' }}
        >
          {result.disclaimer}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Generated {generated.toLocaleString()}
        </Typography>
      </CardContent>
    </Card>
  )
}

/**
 * The research agent's page: ask a market question in plain English and the
 * backend agent answers off Nama's own live reads (never memorized figures),
 * with its tool calls shown. The ask box is the page's primary action, in the
 * screeners' hero idiom; a run is slow (a multi-step model loop), so the
 * in-flight state leans on the shared AnalysisLoadingCard.
 */
export default function Research() {
  const [input, setInput] = useState('')
  const research = useResearch()

  function ask(question: string) {
    const trimmed = question.trim()
    if (!trimmed || research.isPending) return
    research.mutate(trimmed)
  }

  return (
    <Container maxWidth="md" sx={{ py: { xs: 3, sm: 5 } }}>
      <PageHero
        eyebrowIcon={ScienceOutlined}
        eyebrow="Research agent"
        title="Ask the market a question"
        subtitle="The agent answers from Nama's live data. Quotes, screens, and sentiment, with every tool call shown."
      >
        <AiScreenBox
          heading="Ask the research agent"
          value={input}
          onChange={setInput}
          onSubmit={() => ask(input)}
          pending={research.isPending}
          error={research.isError ? errorMessage(research.error) : null}
          placeholder="e.g. Compare NVDA and AMD on growth and valuation"
          inputAriaLabel="Ask a market research question"
          examples={EXAMPLES}
          onExample={(ex) => {
            setInput(ex)
            ask(ex)
          }}
          submitLabel="Ask"
          pendingLabel="Researching…"
        />
      </PageHero>

      <Box sx={{ mt: { xs: 2.5, sm: 3 } }}>
        {research.isPending ? (
          <AnalysisLoadingCard
            title="Researching"
            subtitle="Pulling live data, usually under a minute"
            points={4}
          />
        ) : research.data ? (
          <AnswerCard result={research.data} />
        ) : null}
      </Box>
    </Container>
  )
}
