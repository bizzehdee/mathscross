// @vitest-environment jsdom
/**
 * Waiting for the Cordova shell. The regression here is a page that never loads
 * `cordova.js`, so `deviceready` has nobody to fire it — which shipped, and opened
 * to a blank screen. See `.learnings/deviceready-needs-cordova-js.md`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { waitForDeviceReady } from './platform'

describe('waitForDeviceReady', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('resolves when the shell fires deviceready', async () => {
    const ready = waitForDeviceReady()
    document.dispatchEvent(new Event('deviceready'))

    await expect(ready).resolves.toBeUndefined()
  })

  it('resolves anyway when deviceready never arrives', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const ready = waitForDeviceReady(1000)

    await vi.advanceTimersByTimeAsync(1000)

    await expect(ready).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalled()
  })

  it('does not warn when the event arrives in time', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const ready = waitForDeviceReady(1000)
    document.dispatchEvent(new Event('deviceready'))
    await ready

    await vi.advanceTimersByTimeAsync(5000)

    expect(warn).not.toHaveBeenCalled()
  })
})
