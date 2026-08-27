/**
 * A confetti burst for the completion dialog. Plan section 8.9.
 *
 * Decorative and nothing else. It carries no information, so it is hidden from
 * assistive technology and takes no pointer events, and the dialog is entirely
 * usable without it — a player who never sees it has lost nothing but a moment of
 * celebration.
 *
 * CSS animation rather than a canvas and a requestAnimationFrame loop. Each piece
 * is a span with its own duration, delay and trajectory in custom properties, so
 * the compositor runs the whole burst and the main thread does nothing after the
 * spawn. That matters more here than it looks: the burst fires at the moment the
 * board is being re-rendered and the stats written, which is the busiest frame in
 * the game.
 *
 * No dependency. A confetti library is a few kilobytes against a 40 KiB budget for
 * the entire application, for an effect that is thirty lines of CSS.
 */

/** How many pieces one burst drops. Enough to read as a burst, few enough to be free. */
const PIECES = 44

/**
 * Colours, fixed rather than themed.
 *
 * Confetti wants several hues at once, which a four-token palette cannot supply,
 * and these carry no text so they have no contrast obligation. They are bright
 * enough to read against both the light and dark scrim, which is the only
 * requirement.
 */
const COLOURS = ['#e8493f', '#f3a01c', '#f7d13d', '#3fae5a', '#3a7fd5', '#8b5cd6'] as const

/**
 * Whether the player has asked for less motion.
 *
 * Checked in script and not left to the stylesheet. The reduced-motion rule in
 * `layout.css` collapses every animation to 0.01 ms, which would spawn 44 elements
 * and flash them out of existence rather than not animating — visible as a blink,
 * and pointless work either way. Guarded for the absence of `matchMedia` so a test
 * environment without it does not throw.
 */
function prefersReducedMotion(): boolean {
  const query = globalThis.matchMedia
  if (typeof query !== 'function') {
    return false
  }
  try {
    return query.call(globalThis, '(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/**
 * Drops a burst of confetti inside `host`.
 *
 * Returns a function that removes it early. The caller must hold that and call it
 * when the dialog closes: without it, dismissing the dialog and finishing another
 * puzzle within the burst's lifetime would leave the first burst's pieces animating
 * over the second.
 *
 * A no-op under reduced motion, in which case the returned function is also a
 * no-op, so the caller needs no special case.
 */
export function burstConfetti(host: HTMLElement, random: () => number = Math.random): () => void {
  if (prefersReducedMotion()) {
    return () => {}
  }

  const container = document.createElement('div')
  container.className = 'confetti'
  // Decoration. A screen reader announcing forty-four empty elements after
  // "Congratulations" would bury the announcement that matters.
  container.setAttribute('aria-hidden', 'true')

  let longest = 0

  for (let piece = 0; piece < PIECES; piece += 1) {
    const element = document.createElement('span')
    element.className = 'confetti__piece'

    // Start across the full width, fall past the bottom, and drift sideways. The
    // horizontal drift is signed so the burst spreads both ways rather than
    // leaning, which reads as wind rather than celebration.
    const duration = 1500 + random() * 1400
    const delay = random() * 350
    longest = Math.max(longest, duration + delay)

    const style = element.style
    style.setProperty('--x', `${random() * 100}%`)
    style.setProperty('--dx', `${(random() - 0.5) * 260}px`)
    // Beyond the viewport, so no piece is ever seen stopping.
    style.setProperty('--dy', `${110 + random() * 25}vh`)
    style.setProperty('--rot', `${(random() - 0.5) * 1600}deg`)
    style.setProperty('--duration', `${duration}ms`)
    style.setProperty('--delay', `${delay}ms`)
    style.setProperty('--piece-colour', COLOURS[piece % COLOURS.length] ?? COLOURS[0])
    // Vary the shape a little: some pieces are ribbons, some nearly square.
    style.setProperty('--piece-width', `${6 + random() * 5}px`)
    style.setProperty('--piece-height', `${9 + random() * 8}px`)

    container.append(element)
  }

  host.append(container)

  // Removed on a timer rather than on animationend. Forty-four listeners to learn
  // the same fact is wasteful, and the last piece's animationend does not fire at
  // all if the tab is hidden mid-burst — which would leave the container attached
  // for the rest of the session.
  const timer = globalThis.setTimeout(() => container.remove(), longest + 200)

  return () => {
    globalThis.clearTimeout(timer)
    container.remove()
  }
}
