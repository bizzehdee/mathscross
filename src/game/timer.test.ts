import { describe, expect, it } from 'vitest'
import { bindTimerToVisibility, createTimer, formatElapsed } from './timer'

/** A clock the test moves by hand, so nothing waits for real time. */
function fakeClock(): { now: () => number; advance: (ms: number) => void } {
  let value = 1_000
  return {
    now: () => value,
    advance: (ms) => {
      value += ms
    },
  }
}

describe('the timer', () => {
  it('accumulates foreground time', () => {
    const clock = fakeClock()
    const timer = createTimer(clock.now)

    timer.start()
    clock.advance(5_000)
    expect(timer.elapsed()).toBe(5_000)
  })

  it('stops counting while paused', () => {
    // The rule that makes every time-based statistic meaningful. Without it a
    // puzzle resumed across three sittings reports a nine-hour best time.
    const clock = fakeClock()
    const timer = createTimer(clock.now)

    timer.start()
    clock.advance(3_000)
    timer.pause()
    clock.advance(60_000)

    expect(timer.elapsed()).toBe(3_000)
    expect(timer.running).toBe(false)
  })

  it('resumes from where it paused', () => {
    const clock = fakeClock()
    const timer = createTimer(clock.now)

    timer.start()
    clock.advance(2_000)
    timer.pause()
    clock.advance(60_000)
    timer.resume()
    clock.advance(1_000)

    expect(timer.elapsed()).toBe(3_000)
  })

  it('ignores a repeated pause or resume', () => {
    const clock = fakeClock()
    const timer = createTimer(clock.now)

    timer.start()
    clock.advance(1_000)
    timer.pause()
    timer.pause()
    timer.resume()
    timer.resume()
    clock.advance(1_000)

    expect(timer.elapsed()).toBe(2_000)
  })

  it('restores a persisted total, paused', () => {
    const clock = fakeClock()
    const timer = createTimer(clock.now)

    timer.restore(45_000)
    clock.advance(10_000)

    expect(timer.elapsed()).toBe(45_000)
    expect(timer.running).toBe(false)

    timer.resume()
    clock.advance(5_000)
    expect(timer.elapsed()).toBe(50_000)
  })
})

describe('formatting', () => {
  it('shows minutes and seconds', () => {
    expect(formatElapsed(0)).toBe('0:00')
    expect(formatElapsed(9_000)).toBe('0:09')
    expect(formatElapsed(65_000)).toBe('1:05')
    expect(formatElapsed(600_000)).toBe('10:00')
  })

  it('shows hours once past one', () => {
    expect(formatElapsed(3_600_000)).toBe('1:00:00')
    expect(formatElapsed(3_725_000)).toBe('1:02:05')
  })

  it('never shows a negative time', () => {
    expect(formatElapsed(-5_000)).toBe('0:00')
  })
})

/**
 * A stand-in for the document, so the test controls `hidden` and dispatches the
 * events itself.
 *
 * Its own object rather than jsdom's document because `hidden` is derived from
 * `visibilityState` there and cannot be set, and because the point of these tests
 * is that the window listener is registered on the window rather than the
 * document — which a shared global would hide.
 */
function fakeTarget(): {
  target: Document
  fireDocument: (type: string) => void
  fireWindow: (type: string) => void
  hide: () => void
  show: () => void
  listenerCount: () => number
} {
  const documentListeners = new Map<string, Set<() => void>>()
  const windowListeners = new Map<string, Set<() => void>>()

  const add = (map: Map<string, Set<() => void>>, type: string, fn: () => void): void => {
    const set = map.get(type) ?? new Set<() => void>()
    set.add(fn)
    map.set(type, set)
  }
  const fire = (map: Map<string, Set<() => void>>, type: string): void => {
    for (const fn of [...(map.get(type) ?? [])]) {
      fn()
    }
  }
  const size = (map: Map<string, Set<() => void>>): number =>
    [...map.values()].reduce((total, set) => total + set.size, 0)

  const target = {
    hidden: false,
    addEventListener: (type: string, fn: () => void) => add(documentListeners, type, fn),
    removeEventListener: (type: string, fn: () => void) => documentListeners.get(type)?.delete(fn),
    defaultView: {
      addEventListener: (type: string, fn: () => void) => add(windowListeners, type, fn),
      removeEventListener: (type: string, fn: () => void) => windowListeners.get(type)?.delete(fn),
    },
  }

  return {
    target: target as unknown as Document,
    fireDocument: (type) => fire(documentListeners, type),
    fireWindow: (type) => fire(windowListeners, type),
    hide: () => {
      target.hidden = true
    },
    show: () => {
      target.hidden = false
    },
    listenerCount: () => size(documentListeners) + size(windowListeners),
  }
}

describe('binding a timer to visibility', () => {
  it('stops the clock while the document is hidden, and restarts it after', () => {
    const clock = fakeClock()
    const timer = createTimer(clock.now)
    const dom = fakeTarget()
    bindTimerToVisibility(timer, dom.target)

    timer.start()
    clock.advance(4_000)

    dom.hide()
    dom.fireDocument('visibilitychange')
    clock.advance(60_000)
    expect(timer.elapsed()).toBe(4_000)

    dom.show()
    dom.fireDocument('visibilitychange')
    clock.advance(1_000)
    expect(timer.elapsed()).toBe(5_000)
  })

  it('stops on the Cordova pause event and restarts on resume', () => {
    const clock = fakeClock()
    const timer = createTimer(clock.now)
    const dom = fakeTarget()
    bindTimerToVisibility(timer, dom.target)

    timer.start()
    clock.advance(2_000)

    dom.fireDocument('pause')
    clock.advance(30_000)
    expect(timer.running).toBe(false)

    dom.fireDocument('resume')
    clock.advance(3_000)
    expect(timer.elapsed()).toBe(5_000)
  })

  it('stops as the page goes away, which is the last chance to record anything', () => {
    const clock = fakeClock()
    const timer = createTimer(clock.now)
    const dom = fakeTarget()
    bindTimerToVisibility(timer, dom.target)

    timer.start()
    clock.advance(7_000)

    dom.fireWindow('pagehide')

    expect(timer.running).toBe(false)
    expect(timer.elapsed()).toBe(7_000)
  })

  it('reports every pause, so the caller can write the total down', () => {
    const clock = fakeClock()
    const timer = createTimer(clock.now)
    const dom = fakeTarget()
    const recorded: number[] = []
    bindTimerToVisibility(timer, dom.target, () => recorded.push(timer.elapsed()))

    timer.start()

    clock.advance(1_000)
    dom.hide()
    dom.fireDocument('visibilitychange')

    dom.show()
    dom.fireDocument('visibilitychange')
    clock.advance(2_000)
    dom.fireDocument('pause')

    dom.fireDocument('resume')
    clock.advance(4_000)
    dom.fireWindow('pagehide')

    expect(recorded).toEqual([1_000, 3_000, 7_000])
  })

  it('does not report becoming visible, which would save nothing new', () => {
    const clock = fakeClock()
    const timer = createTimer(clock.now)
    const dom = fakeTarget()
    let pauses = 0
    bindTimerToVisibility(timer, dom.target, () => {
      pauses += 1
    })

    timer.start()
    dom.show()
    dom.fireDocument('visibilitychange')
    dom.fireDocument('resume')

    expect(pauses).toBe(0)
  })

  it('detaches every listener, the window one included', () => {
    const dom = fakeTarget()
    const detach = bindTimerToVisibility(createTimer(fakeClock().now), dom.target)

    expect(dom.listenerCount()).toBe(4)

    detach()

    expect(dom.listenerCount()).toBe(0)
  })
})
