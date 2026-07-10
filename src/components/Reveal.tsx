import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Box } from '@mui/material'

interface Props {
  children: ReactNode
  /** Stagger the entrance — ms of delay before this block animates in. */
  delay?: number
}

/**
 * A lightweight scroll-reveal wrapper: its child starts slightly lowered and
 * transparent, then eases up into place the first time it scrolls into view.
 * Built on a one-shot IntersectionObserver (no animation library, no re-trigger
 * on scroll-back) so the home page's bands arrive with a gentle cascade instead
 * of snapping in all at once.
 *
 * Respects `prefers-reduced-motion`: when the visitor has asked for less motion
 * (or before JS resolves the observer on the server-less first paint) the
 * content is simply shown in place, never hidden — so this can only add polish,
 * never withhold content.
 */
export default function Reveal({ children, delay = 0 }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    // Guard both capabilities: a reduced-motion request, or an environment
    // without matchMedia / IntersectionObserver (jsdom, SSR). In any of those
    // cases, just show the content — the reveal is pure polish.
    const reduce =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce || typeof IntersectionObserver === 'undefined') {
      setShown(true)
      return
    }
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true)
          observer.disconnect()
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.05 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <Box
      ref={ref}
      sx={{
        opacity: shown ? 1 : 0,
        transform: shown ? 'none' : 'translateY(24px)',
        transition: (theme) =>
          theme.transitions.create(['opacity', 'transform'], {
            duration: 600,
            easing: theme.transitions.easing.easeOut,
          }),
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </Box>
  )
}
