/**
 * Presentation tokens for the daily market brief.
 *
 * The brief is styled as a dated *market dispatch* — an editorial voice distinct
 * from the app's sans-serif data cards. `SERIF` is a system-serif stack (no web
 * font to download; refined faces on the platforms that have them, Georgia
 * everywhere else) used for the masthead date, the lede, and section headings.
 *
 * `BRIEF_TONE` maps the headline posture to a chip colour + a plain gloss, reusing
 * the app's up/down semantics (risk-on emerald, risk-off amber, mixed neutral) —
 * the same mapping the Market Summary widget uses, so the two read consistently.
 */

import type { BriefTone } from '@/lib/api'

/** System-serif display stack for the brief's editorial type. Self-contained —
 *  no `@font-face`, so nothing downloads and it renders on every platform. */
export const SERIF =
  "'Iowan Old Style', 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, 'Times New Roman', serif"

export const BRIEF_TONE: Record<
  BriefTone,
  { label: string; color: 'success' | 'warning' | 'default'; help: string }
> = {
  risk_on: {
    label: 'Risk-On',
    color: 'success',
    help: 'The market is broadly rising and growth is leading — an appetite for risk.',
  },
  risk_off: {
    label: 'Risk-Off',
    color: 'warning',
    help: 'The market is under pressure or turning defensive — a cautious mood.',
  },
  mixed: {
    label: 'Mixed',
    color: 'default',
    help: 'No clear lean between risk-taking and caution.',
  },
}
