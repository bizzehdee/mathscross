import { describe, expect, it } from 'vitest'
import { ALL_DIFFICULTIES, Difficulty, parametersFor, valueInRange } from './difficulty'
import { boardState, readNumber } from './evaluate'
import { generate } from './generate'
import { candidatePatterns, buildMesh, meshProblems, nonAdjacentSubsets } from './mesh'
import { densityWithinTolerance } from './mask'
import { isDegenerateOperation, knownValue } from './numbers'
import { binaryShape, parseGrid } from './parse'
import { createRng, hashString } from './rng'
import { STARTER_DIFFICULTY, starterGrid } from './starter'
import { solve } from './solver'
import { CellKind, EMPTY, Operator } from './types'

/** A few fixed seeds. The fast suite is a smoke test; the slow suite sweeps. */
const SEEDS = [1, 2, 3, 7, 11, 12345]

/**
 * Generation is memoised per difficulty and seed.
 *
 * Each property below asserts over every seed, and generating afresh in each one
 * took the fast suite to 38 seconds — Hard costs a median of 830 ms and there are
 * several assertions. The suite runs on every pull request, so it has to stay
 * quick. Determinism makes caching safe: the same seed always gives the same
 * puzzle, which is itself asserted below.
 */
const cache = new Map<string, ReturnType<typeof generate>>()

function generated(seed: number, difficulty: Difficulty): ReturnType<typeof generate> {
  const key = `${difficulty}:${seed}`
  const held = cache.get(key)
  if (held !== undefined) {
    return held
  }
  const fresh = generate({ seed, difficulty })
  cache.set(key, fresh)
  return fresh
}

describe('the promises each grade makes', () => {
  it('makes every Easy and Medium puzzle solvable without guessing', () => {
    // The grades a child plays. The solver records 'search' the moment
    // propagation stalls and it has to try a value, so its absence means there is
    // a chain of forced steps from the givens to the answer.
    //
    // Measured before the rule existed: Easy was 30 of 30 deducible and Medium
    // was 0 of 30 — every Medium board required guessing, which is what made the
    // step up from Easy a cliff rather than a step.
    for (const difficulty of [Difficulty.Easy, Difficulty.Medium]) {
      expect(parametersFor(difficulty).requireDeducible, difficulty).toBe(true)
      for (const seed of SEEDS) {
        const result = generated(seed, difficulty)
        expect(result.ok, `${difficulty} seed ${seed}`).toBe(true)
        if (!result.ok) {
          continue
        }
        expect(result.puzzle.techniques.has('search'), `${difficulty} seed ${seed}`).toBe(false)
      }
    }
  })

  it('does not promise the same of Hard and Extreme', () => {
    // Stated so that turning the flag on everywhere is a deliberate act rather
    // than a drift. These grades guarantee one answer, not a guess-free route to
    // it, and their densities depend on that freedom.
    for (const difficulty of [Difficulty.Hard, Difficulty.Extreme]) {
      expect(parametersFor(difficulty).requireDeducible, difficulty).toBe(false)
    }
  })

  it('keeps operators on show below Hard', () => {
    // Deducing which operator a cell holds is a different kind of reasoning from
    // arithmetic, and the two kid grades introduce one thing at a time.
    expect(parametersFor(Difficulty.Easy).operatorMaskRatio).toBe(0)
    expect(parametersFor(Difficulty.Medium).operatorMaskRatio).toBe(0)
    expect(parametersFor(Difficulty.Hard).operatorMaskRatio).toBeGreaterThan(0)
  })

  it('keeps negatives out of the two kid grades', () => {
    expect(parametersFor(Difficulty.Easy).allowNegative).toBe(false)
    expect(parametersFor(Difficulty.Medium).allowNegative).toBe(false)
    expect(parametersFor(Difficulty.Hard).allowNegative).toBe(true)
  })

  it('gives more blanks at each grade than the one below', () => {
    // The ramp itself, asserted. A grade that asked less of a player than the one
    // below would be a mislabelled grade however its parameters read.
    const blanks = ALL_DIFFICULTIES.map((difficulty) => {
      const counts = SEEDS.map((seed) => {
        const result = generated(seed, difficulty)
        if (!result.ok) {
          return 0
        }
        let empty = 0
        const { kinds, values } = result.puzzle.puzzle
        for (let cell = 0; cell < values.length; cell += 1) {
          if (kinds[cell] !== CellKind.Block && values[cell] === EMPTY) {
            empty += 1
          }
        }
        return empty
      })
      return counts.reduce((a, b) => a + b, 0) / counts.length
    })

    for (let i = 1; i < blanks.length; i += 1) {
      expect(blanks[i], `${ALL_DIFFICULTIES[i]} against ${ALL_DIFFICULTIES[i - 1]}`).toBeGreaterThan(
        blanks[i - 1] ?? 0,
      )
    }
  })
})

describe('arithmetic worth asking', () => {
  it('rejects identities and annihilators', () => {
    // Reported as an Easy board whose three answers were 1 + 0, 7 - 0 and 9 + 0.
    expect(isDegenerateOperation(Operator.Plus, 9, 0)).toBe(true)
    expect(isDegenerateOperation(Operator.Plus, 0, 9)).toBe(true)
    expect(isDegenerateOperation(Operator.Minus, 7, 0)).toBe(true)
    expect(isDegenerateOperation(Operator.Times, 6, 1)).toBe(true)
    expect(isDegenerateOperation(Operator.Times, 6, 0)).toBe(true)
    expect(isDegenerateOperation(Operator.Divide, 6, 1)).toBe(true)
    expect(isDegenerateOperation(Operator.Divide, 0, 6)).toBe(true)
  })

  it('allows the ones that still ask something', () => {
    // 0 - b is how a negative is introduced. a - a and a / a have a constant
    // result but require noticing that the operands match. A result of zero from
    // a real operation is fine.
    expect(isDegenerateOperation(Operator.Minus, 0, 5)).toBe(false)
    expect(isDegenerateOperation(Operator.Minus, 7, 7)).toBe(false)
    expect(isDegenerateOperation(Operator.Divide, 6, 6)).toBe(false)
    expect(isDegenerateOperation(Operator.Plus, 2, 3)).toBe(false)
    expect(isDegenerateOperation(Operator.Times, 3, 4)).toBe(false)
  })

  it('puts none of them on a generated board', () => {
    for (const difficulty of ALL_DIFFICULTIES) {
      for (const seed of SEEDS) {
        const result = generated(seed, difficulty)
        if (!result.ok) {
          continue
        }
        const solved = result.puzzle.solution
        for (const equation of parseGrid(solved).equations) {
          const shape = binaryShape(equation)
          if (shape === null) {
            continue
          }
          const a = knownValue(solved, shape.left)
          const b = knownValue(solved, shape.right)
          const operator = solved.values[shape.operatorCell]
          if (a === null || b === null || operator === undefined) {
            continue
          }
          expect(
            isDegenerateOperation(operator as Operator, a, b),
            `${difficulty} seed ${seed}: ${a} op${operator} ${b}`,
          ).toBe(false)
        }
      }
    }
  })
})

describe('the mesh', () => {
  it('offers at least one pattern per difficulty', () => {
    for (const difficulty of ALL_DIFFICULTIES) {
      const patterns = candidatePatterns(parametersFor(difficulty))
      expect(patterns.length, difficulty).toBeGreaterThan(0)
      for (const pattern of patterns) {
        expect(pattern.length, difficulty).toBe(parametersFor(difficulty).size)
      }
    }
  })

  it('builds a structurally valid mesh for every difficulty and seed', () => {
    for (const difficulty of ALL_DIFFICULTIES) {
      const parameters = parametersFor(difficulty)
      for (const seed of SEEDS) {
        const mesh = buildMesh({ difficulty, rng: createRng(seed) })
        expect(mesh, `${difficulty} seed ${seed}`).not.toBeNull()
        expect(meshProblems(mesh!, parameters), `${difficulty} seed ${seed}`).toEqual([])
      }
    }
  })

  it('produces a legal grid, so every non-block cell is in an equation', () => {
    for (const difficulty of ALL_DIFFICULTIES) {
      for (const seed of SEEDS) {
        const mesh = buildMesh({ difficulty, rng: createRng(seed) })
        expect(parseGrid(mesh!.grid).problems, `${difficulty} seed ${seed}`).toEqual([])
      }
    }
  })

  it('never places two equations in adjacent lines', () => {
    const subsets = nonAdjacentSubsets([0, 1, 2, 3, 4], 2)

    expect(subsets).toContainEqual([0, 2])
    expect(subsets).not.toContainEqual([0, 1])
  })
})

describe('generated puzzles', () => {
  for (const difficulty of ALL_DIFFICULTIES) {
    describe(difficulty, () => {
      const parameters = parametersFor(difficulty)

      it('generates for every seed', () => {
        for (const seed of SEEDS) {
          const result = generated(seed, difficulty)
          expect(result.ok, `seed ${seed}: ${result.ok ? '' : result.reason}`).toBe(true)
        }
      })

      it('has exactly one solution', () => {
        for (const seed of SEEDS) {
          const result = generated(seed, difficulty)
          if (!result.ok) {
            continue
          }
          const found = solve(result.puzzle.puzzle, {
            operators: parameters.operators,
            maxSolutions: 3,
          })
          expect(found.count, `seed ${seed}`).toBe(1)
        }
      })

      it('has a solved solution grid', () => {
        for (const seed of SEEDS) {
          const result = generated(seed, difficulty)
          if (!result.ok) {
            continue
          }
          const parsed = parseGrid(result.puzzle.solution)
          expect(boardState(result.puzzle.solution, parsed.equations), `seed ${seed}`).toBe('solved')
        }
      })

      it('keeps every operand and result in range, with no leading zero', () => {
        for (const seed of SEEDS) {
          const result = generated(seed, difficulty)
          if (!result.ok) {
            continue
          }
          const grid = result.puzzle.solution
          for (const equation of parseGrid(grid).equations) {
            for (const token of equation.tokens) {
              if (token.kind !== 'number') {
                continue
              }
              const reading = readNumber(grid, token)
              expect(reading.ok, `seed ${seed}`).toBe(true)
              if (reading.ok) {
                expect(valueInRange(reading.value, parameters), `seed ${seed}`).toBe(true)
              }
            }
          }
        }
      })

      it('uses only the difficulty’s operators', () => {
        for (const seed of SEEDS) {
          const result = generated(seed, difficulty)
          if (!result.ok) {
            continue
          }
          const grid = result.puzzle.solution
          for (let cell = 0; cell < grid.kinds.length; cell += 1) {
            if (grid.kinds[cell] !== CellKind.Operator) {
              continue
            }
            expect(parameters.operators, `seed ${seed}`).toContain(grid.values[cell])
          }
        }
      })

      it('masks at least one cell', () => {
        for (const seed of SEEDS) {
          const result = generated(seed, difficulty)
          if (!result.ok) {
            continue
          }
          const masked = Array.from(result.puzzle.puzzle.values).filter(
            (value, cell) =>
              value === EMPTY &&
              (result.puzzle.puzzle.kinds[cell] === CellKind.Digit ||
                result.puzzle.puzzle.kinds[cell] === CellKind.Operator),
          )
          expect(masked.length, `seed ${seed}`).toBeGreaterThan(0)
        }
      })
    })
  }
})

describe('determinism', () => {
  it('produces identical output for the same seed and difficulty', () => {
    // The daily puzzle depends on this: the same date must give the same board on
    // every device, with no server to arbitrate. Plan section 5.5.
    // Two seeds, not the full set. This test cannot use the memoised results —
    // comparing a cached value with itself would assert nothing — so it pays for
    // two fresh generations per seed, and at Hard that is the most expensive thing
    // in the fast suite. The slow suite sweeps 25 seeds per difficulty.
    for (const difficulty of ALL_DIFFICULTIES) {
      for (const seed of [1, 7]) {
        const a = generate({ seed, difficulty })
        const b = generate({ seed, difficulty })

        expect(a.ok).toBe(b.ok)
        if (a.ok && b.ok) {
          expect(Array.from(a.puzzle.puzzle.values), `${difficulty} seed ${seed}`).toEqual(
            Array.from(b.puzzle.puzzle.values),
          )
          expect(Array.from(a.puzzle.solution.values)).toEqual(
            Array.from(b.puzzle.solution.values),
          )
          expect(a.puzzle.attempts).toBe(b.puzzle.attempts)
        }
      }
    }
  })

  it('produces different puzzles for different seeds', () => {
    // Guards the opposite failure: a fill that ignored the Rng would be
    // deterministic and identical for every seed, passing the test above.
    const boards = new Set<string>()
    for (const seed of SEEDS) {
      const result = generated(seed, Difficulty.Easy)
      if (result.ok) {
        boards.add(Array.from(result.puzzle.solution.values).join(','))
      }
    }
    expect(boards.size).toBeGreaterThan(1)
  })
})

describe('cancellation and caps', () => {
  it('reports cancellation rather than throwing', () => {
    const result = generate({
      seed: 1,
      difficulty: Difficulty.Easy,
      shouldCancel: () => true,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('cancelled')
    }
  })

  it('reports exhaustion as a result, not an exception', () => {
    // Zero attempts permitted, so the loop cannot run.
    const result = generate({ seed: 1, difficulty: Difficulty.Easy, maxAttempts: 0 })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('exhausted')
    }
  })

  it('reports the attempt count', () => {
    const seen: number[] = []
    const result = generate({
      seed: 1,
      difficulty: Difficulty.Easy,
      onAttempt: (attempt) => seen.push(attempt),
    })

    expect(result.ok).toBe(true)
    expect(seen[0]).toBe(1)
    if (result.ok) {
      expect(seen).toHaveLength(result.puzzle.attempts)
    }
  })
})

describe('mask density', () => {
  it('reports what it achieved against the target', () => {
    const result = generate({ seed: 1, difficulty: Difficulty.Easy })
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    const { density } = result.puzzle
    expect(density.digitsTotal).toBeGreaterThan(0)
    expect(density.digitTarget).toBe(parametersFor(Difficulty.Easy).digitMaskRatio)
    expect(density.uniquenessChecks).toBeGreaterThan(0)
  })

  it('exposes a tolerance check for the slow suite to assert', () => {
    // Not asserted here: the fast suite runs six seeds, which is too few to say
    // anything about density. The slow suite sweeps 100 per difficulty and
    // asserts this. Plan section 13.4.
    const density = {
      digitsMasked: 4,
      digitsTotal: 10,
      digitRatio: 0.4,
      digitTarget: 0.4,
      operatorsMasked: 0,
      operatorsTotal: 3,
      operatorRatio: 0,
      operatorTarget: 0,
      uniquenessChecks: 1,
    }
    expect(densityWithinTolerance(density)).toBe(true)
    expect(densityWithinTolerance({ ...density, digitRatio: 0.1 })).toBe(false)
  })
})

describe('seed hashing', () => {
  it('gives adjacent dates non-adjacent seeds', () => {
    // Consecutive daily puzzles must not look alike, which they would if
    // consecutive date keys produced neighbouring seeds.
    const a = hashString('20260826')
    const b = hashString('20260827')

    expect(Math.abs(a - b)).toBeGreaterThan(1000)
  })

  it('is stable for the same input', () => {
    expect(hashString('20260826')).toBe(hashString('20260826'))
  })
})

describe('the bundled starter puzzle', () => {
  it('is a valid, uniquely solvable Easy puzzle', () => {
    // Plan section 5.8. This board ships in the bundle and is the first thing a
    // new player sees, so it faces the same checks a generated puzzle does.
    const grid = starterGrid()
    const parsed = parseGrid(grid)
    const parameters = parametersFor(STARTER_DIFFICULTY)

    expect(parsed.problems).toEqual([])
    expect(grid.size).toBe(parameters.size)

    const found = solve(grid, { operators: parameters.operators, maxSolutions: 3 })
    expect(found.count).toBe(1)
  })

  it('has blanks to fill', () => {
    const grid = starterGrid()
    let blanks = 0
    for (let cell = 0; cell < grid.kinds.length; cell += 1) {
      const kind = grid.kinds[cell]
      if ((kind === CellKind.Digit || kind === CellKind.Operator) && grid.values[cell] === EMPTY) {
        blanks += 1
      }
    }
    expect(blanks).toBeGreaterThan(0)
  })

  it('returns a fresh copy each call, so a player cannot corrupt it', () => {
    const first = starterGrid()
    first.values[0] = 7
    expect(starterGrid().values[0]).not.toBe(7)
  })
})
