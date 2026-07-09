/**
 * Hand-drawn market-phase glyphs — a clean sun and a crescent moon — so the
 * menu-bar status owns its iconography instead of pulling two more icons from
 * the library. Both are tuned to sit centred in the 24×24 box (their ink
 * centre lands on 12,12), which is what lets App's small optical nudge line the
 * status up with the wordmark. Colour comes from `currentColor`, so the caller
 * sets it with a normal CSS/`sx` colour on any wrapper.
 */

interface IconProps {
  /** Rendered pixel size (square). Defaults to 20 to match the menu bar. */
  size?: number
}

/** A round sun with eight evenly-spaced rays. */
export function SunIcon({ size = 20 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="5" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="12" y1="4.5" x2="12" y2="2" />
        <line x1="12" y1="19.5" x2="12" y2="22" />
        <line x1="4.5" y1="12" x2="2" y2="12" />
        <line x1="19.5" y1="12" x2="22" y2="12" />
        <line x1="6.7" y1="6.7" x2="4.93" y2="4.93" />
        <line x1="17.3" y1="17.3" x2="19.07" y2="19.07" />
        <line x1="6.7" y1="17.3" x2="4.93" y2="19.07" />
        <line x1="17.3" y1="6.7" x2="19.07" y2="4.93" />
      </g>
    </svg>
  )
}

/**
 * A waxing crescent — the outer edge is a circle of radius 9, the inner
 * terminator a tighter arc scooped from the upper-right, leaving a fat,
 * clearly-read moon whose belly sits lower-left.
 */
export function MoonIcon({ size = 20 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M20.923 13.173A9 9 0 1 1 10.827 3.077A7.5 7.5 0 0 0 20.923 13.173Z"
        fill="currentColor"
      />
    </svg>
  )
}
