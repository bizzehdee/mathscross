// @vitest-environment jsdom
/**
 * The confetti burst. Plan section 8.9.
 *
 * Decoration, so what is tested is not how it looks — jsdom parses no stylesheet
 * and could not tell — but the three things that would be defects rather than
 * matters of taste: that it cleans up after itself, that it is invisible to
 * assistive technology, and that it does not run for a player who asked for less
 * motion.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { burstConfetti } from './confetti'

/** A fixed sequence, so piece geometry is deterministic and nothing is flaky. */
function sequence(): () => number {
  let n = 0
  return () => {
    n += 1
    return (n % 10) / 10
  }
}

function host(): HTMLElement {
  const element = document.createElement('div')
  document.body.replaceChildren(element)
  return element
}

function setReducedMotion(reduce: boolean): void {
  Object.defineProperty(globalThis, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: reduce && query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  setReducedMotion(false)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('a confetti burst', () => {
  it('drops pieces into the host', () => {
    const element = host()
    burstConfetti(element, sequence())

    const container = element.querySelector('.confetti')
    expect(container).not.toBeNull()
    expect(container?.querySelectorAll('.confetti__piece').length).toBeGreaterThan(20)
  })

  it('gives every piece its own trajectory', () => {
    const element = host()
    burstConfetti(element, sequence())

    const pieces = [...element.querySelectorAll<HTMLElement>('.confetti__piece')]
    // Not all identical: a burst where every piece falls the same way is a
    // curtain, not a burst.
    const drifts = new Set(pieces.map((piece) => piece.style.getPropertyValue('--dx')))
    const delays = new Set(pieces.map((piece) => piece.style.getPropertyValue('--delay')))
    expect(drifts.size).toBeGreaterThan(1)
    expect(delays.size).toBeGreaterThan(1)

    for (const piece of pieces) {
      expect(piece.style.getPropertyValue('--piece-colour')).toMatch(/^#[0-9a-f]{6}$/)
      expect(piece.style.getPropertyValue('--duration')).toMatch(/ms$/)
    }
  })

  it('is hidden from assistive technology', () => {
    // Forty-four empty elements announced after "Congratulations" would bury the
    // announcement that matters.
    const element = host()
    burstConfetti(element, sequence())

    expect(element.querySelector('.confetti')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('removes itself once the last piece has fallen', () => {
    const element = host()
    burstConfetti(element, sequence())

    expect(element.querySelector('.confetti')).not.toBeNull()

    vi.advanceTimersByTime(10_000)

    // On a timer rather than animationend: the last piece's animationend never
    // fires if the tab is hidden mid-burst, which would leave the container
    // attached for the rest of the session.
    expect(element.querySelector('.confetti')).toBeNull()
  })

  it('can be removed early, and does not then remove anything later', () => {
    const element = host()
    const stop = burstConfetti(element, sequence())

    stop()
    expect(element.querySelector('.confetti')).toBeNull()

    // A second burst started after the first was cancelled must survive the first
    // burst's timer, which is still pending unless cancelling cleared it.
    burstConfetti(element, sequence())
    vi.advanceTimersByTime(1_000)
    expect(element.querySelector('.confetti')).not.toBeNull()
  })

  it('does nothing at all under reduced motion', () => {
    setReducedMotion(true)
    const element = host()

    const stop = burstConfetti(element, sequence())

    expect(element.querySelector('.confetti')).toBeNull()
    // The returned function is still safe to call, so the caller needs no special
    // case for this.
    expect(() => stop()).not.toThrow()
  })

  it('survives an environment with no matchMedia', () => {
    // jsdom has one, but the Cordova WebView is the environment that matters and a
    // throw here would take the completion dialog down with it.
    Reflect.deleteProperty(globalThis, 'matchMedia')
    const element = host()

    expect(() => burstConfetti(element, sequence())).not.toThrow()
    expect(element.querySelector('.confetti')).not.toBeNull()
  })
})
