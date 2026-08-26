/**
 * Elapsed play time. Plan section 7.3.
 *
 * Pauses whenever the app is not in front. Without that, a puzzle resumed across
 * three sittings reports a nine-hour best time and every time-based statistic
 * becomes worthless.
 *
 * The clock is injected rather than read from `Date` directly, so the tests do not
 * have to wait for real time to pass.
 */
export type Clock = () => number

export interface Timer {
  /** Milliseconds of foreground time so far. */
  elapsed(): number
  start(): void
  pause(): void
  resume(): void
  /** Restores a persisted elapsed total, leaving the timer paused. */
  restore(milliseconds: number): void
  readonly running: boolean
}

export function createTimer(clock: Clock = () => Date.now()): Timer {
  let accumulated = 0
  let startedAt: number | null = null

  const elapsed = (): number =>
    startedAt === null ? accumulated : accumulated + (clock() - startedAt)

  return {
    elapsed,
    start(): void {
      accumulated = 0
      startedAt = clock()
    },
    pause(): void {
      if (startedAt === null) {
        return
      }
      accumulated += clock() - startedAt
      startedAt = null
    },
    resume(): void {
      if (startedAt !== null) {
        return
      }
      startedAt = clock()
    },
    restore(milliseconds: number): void {
      accumulated = Math.max(0, milliseconds)
      startedAt = null
    },
    get running(): boolean {
      return startedAt !== null
    },
  }
}

/**
 * Pauses a timer whenever the document is hidden, and on the Cordova pause event.
 *
 * Both are needed: `visibilitychange` covers a backgrounded browser tab and a
 * locked phone, and Cordova's own `pause` and `resume` fire in the shell where
 * the web event is less reliable. Returns a function that detaches both.
 */
export function bindTimerToVisibility(timer: Timer, target: Document = document): () => void {
  const onVisibility = (): void => {
    if (target.hidden) {
      timer.pause()
    } else {
      timer.resume()
    }
  }
  const onPause = (): void => timer.pause()
  const onResume = (): void => timer.resume()

  target.addEventListener('visibilitychange', onVisibility)
  target.addEventListener('pause', onPause)
  target.addEventListener('resume', onResume)

  return () => {
    target.removeEventListener('visibilitychange', onVisibility)
    target.removeEventListener('pause', onPause)
    target.removeEventListener('resume', onResume)
  }
}

/** `m:ss`, or `h:mm:ss` past an hour. */
export function formatElapsed(milliseconds: number): string {
  const total = Math.max(0, Math.floor(milliseconds / 1000))
  const seconds = total % 60
  const minutes = Math.floor(total / 60) % 60
  const hours = Math.floor(total / 3600)

  const pad = (value: number): string => String(value).padStart(2, '0')

  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`
}
