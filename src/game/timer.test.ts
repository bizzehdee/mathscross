import { describe, expect, it } from 'vitest'
import { createTimer, formatElapsed } from './timer'

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
