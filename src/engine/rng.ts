/**
 * Seeded deterministic pseudo-random numbers. Plan section 5.5.
 *
 * `Math.random()` must never be called anywhere in `src/engine/`. The daily
 * puzzle is derived from a date, so the same seed has to produce the same puzzle
 * on every device, and there is no server to arbitrate a disagreement.
 *
 * sfc32: small, fast, and good enough for shuffling candidate values. Not
 * cryptographic, and nothing here needs it to be.
 */

export interface Rng {
  /** The next 32-bit unsigned integer. */
  nextUint32(): number
  /** A uniform integer in [0, bound). Throws when bound is not positive. */
  nextBelow(bound: number): number
  /** Fisher-Yates, in place. */
  shuffle<T>(items: T[]): T[]
  /** One item, or undefined when the list is empty. */
  pick<T>(items: readonly T[]): T | undefined
}

/**
 * Expands one 32-bit seed into sfc32's four state words.
 *
 * sfc32 needs 128 bits of state. Seeding all four words from the same value
 * leaves the generator in a degenerate state whose first outputs are strongly
 * correlated, so each word is derived with a different splitmix32 step.
 */
function expandSeed(seed: number): [number, number, number, number] {
  let state = seed >>> 0
  const next = (): number => {
    state = (state + 0x9e37_79b9) >>> 0
    let z = state
    z = Math.imul(z ^ (z >>> 16), 0x21f0_aaad) >>> 0
    z = Math.imul(z ^ (z >>> 15), 0x735a_2d97) >>> 0
    return (z ^ (z >>> 15)) >>> 0
  }
  return [next(), next(), next(), next()]
}

export function createRng(seed: number): Rng {
  let [a, b, c, d] = expandSeed(seed)

  const nextUint32 = (): number => {
    const t = (a + b) >>> 0
    a = b ^ (b >>> 9)
    b = (c + (c << 3)) >>> 0
    c = ((c << 21) | (c >>> 11)) >>> 0
    d = (d + 1) >>> 0
    const result = (t + d) >>> 0
    c = (c + result) >>> 0
    return result
  }

  const nextBelow = (bound: number): number => {
    if (!Number.isInteger(bound) || bound <= 0) {
      throw new Error(`nextBelow needs a positive integer bound, got ${bound}`)
    }
    // Rejection sampling. Taking a modulo of the raw 32-bit value biases towards
    // the low end whenever the bound does not divide 2^32, and a biased shuffle
    // would show up as puzzles that favour certain digits.
    const limit = Math.floor(0x1_0000_0000 / bound) * bound
    let value = nextUint32()
    while (value >= limit) {
      value = nextUint32()
    }
    return value % bound
  }

  const shuffle = <T>(items: T[]): T[] => {
    for (let index = items.length - 1; index > 0; index -= 1) {
      const swap = nextBelow(index + 1)
      const held = items[index] as T
      items[index] = items[swap] as T
      items[swap] = held
    }
    return items
  }

  const pick = <T>(items: readonly T[]): T | undefined => {
    if (items.length === 0) {
      return undefined
    }
    return items[nextBelow(items.length)]
  }

  return { nextUint32, nextBelow, shuffle, pick }
}

/**
 * Hashes a string into a 32-bit seed.
 *
 * FNV-1a followed by an avalanche step. The avalanche matters: adjacent inputs
 * such as two consecutive dates must not give adjacent seeds, or consecutive
 * daily puzzles would look alike.
 */
export function hashString(text: string): number {
  let hash = 0x811c_9dc5
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x0100_0193) >>> 0
  }
  hash = Math.imul(hash ^ (hash >>> 16), 0x21f0_aaad) >>> 0
  hash = Math.imul(hash ^ (hash >>> 15), 0x735a_2d97) >>> 0
  return (hash ^ (hash >>> 15)) >>> 0
}
