import { describe, expect, it } from 'vitest'
import { createRouter } from './router'

describe('the router', () => {
  it('starts where it is told', () => {
    expect(createRouter().current).toBe('home')
    expect(createRouter('game').current).toBe('game')
  })

  it('remembers where to come back to', () => {
    const router = createRouter('home')
    router.go('stats')
    expect(router.current).toBe('stats')

    expect(router.back()).toBe(true)
    expect(router.current).toBe('home')
  })

  it('cannot be popped past the floor', () => {
    // The floor is what lets the Android back button distinguish "leave this
    // screen" from "exit the app". Plan section 8.6.
    const router = createRouter('home')

    expect(router.back()).toBe(false)
    expect(router.current).toBe('home')
  })

  it('ignores navigating to the screen already showing', () => {
    // Otherwise pressing Settings twice would need two backs to leave.
    const router = createRouter('home')
    router.go('settings')
    router.go('settings')

    expect(router.back()).toBe(true)
    expect(router.current).toBe('home')
  })

  it('replaces the stack on reset', () => {
    const router = createRouter('home')
    router.go('stats')
    router.go('settings')
    router.reset('game')

    expect(router.current).toBe('game')
    expect(router.back()).toBe(false)
  })

  it('notifies listeners of every change', () => {
    const seen: string[] = []
    const router = createRouter('home')
    router.onChange((screen) => seen.push(screen))

    router.go('stats')
    router.back()
    router.reset('game')

    expect(seen).toEqual(['stats', 'home', 'game'])
  })
})
