import { describe, expect, it } from 'vitest'
import { ALL_DIFFICULTIES, parametersFor, valueInRange } from './difficulty'
import { boardState, readNumber } from './evaluate'
import { generate } from './generate'
import { medianDensityWithinTolerance, type MaskDensity } from './mask'
import { meshProblems, buildMesh } from './mesh'
import { parseGrid } from './parse'
import { createRng } from './rng'
import { solve } from './solver'
import { CellKind } from './types'

/**
 * 100 seeds per difficulty, per plan section 13.4.
 *
 * Runs nightly, on tags, and on demand — never on a pull request. Hard needs a
 * median of 830 ms per puzzle, so this suite is minutes of compute for a signal
 * that changes rarely. Plan section 10.4.
 */
const SEED_COUNT = 100

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] ?? 0
}

for (const difficulty of ALL_DIFFICULTIES) {
  describe(`${difficulty}, ${SEED_COUNT} seeds`, () => {
    const parameters = parametersFor(difficulty)
    const densities: MaskDensity[] = []
    const durations: number[] = []
    const attempts: number[] = []
    let failures = 0

    it('generates a valid, uniquely solvable puzzle for every seed', () => {
      for (let seed = 1; seed <= SEED_COUNT; seed += 1) {
        const started = Date.now()
        const result = generate({ seed, difficulty })
        durations.push(Date.now() - started)

        if (!result.ok) {
          failures += 1
          continue
        }
        attempts.push(result.puzzle.attempts)
        densities.push(result.puzzle.density)

        const { puzzle, solution } = result.puzzle

        // The mesh satisfies its structural rules.
        const parsed = parseGrid(puzzle)
        expect(parsed.problems, `seed ${seed}`).toEqual([])

        // The solution really solves it.
        expect(boardState(solution, parsed.equations), `seed ${seed}`).toBe('solved')

        // Exactly one solution. The single outcome no amount of density is worth
        // trading away.
        const found = solve(puzzle, { operators: parameters.operators, maxSolutions: 3 })
        expect(found.count, `seed ${seed}`).toBe(1)

        // Every operand and result in range, no leading zeros, only permitted
        // operators.
        for (const equation of parsed.equations) {
          for (const token of equation.tokens) {
            if (token.kind !== 'number') {
              continue
            }
            const reading = readNumber(solution, token)
            expect(reading.ok, `seed ${seed}`).toBe(true)
            if (reading.ok) {
              expect(valueInRange(reading.value, parameters), `seed ${seed}`).toBe(true)
            }
          }
        }
        for (let cell = 0; cell < solution.kinds.length; cell += 1) {
          if (solution.kinds[cell] === CellKind.Operator) {
            expect(parameters.operators, `seed ${seed}`).toContain(solution.values[cell])
          }
        }
      }

      // At least 99% of seeds must succeed. Plan section 1.6 criterion 6.
      expect(failures).toBeLessThanOrEqual(1)
    })

    it('meets its mask density targets across the population', () => {
      // Asserted on the median, not per puzzle. Individual density varies with the
      // mesh and the seed, so a per-puzzle assertion fails on about a quarter of
      // legitimate puzzles while telling you nothing. A slipped *distribution* is
      // the failure worth catching: it means the difficulty is no longer the
      // difficulty it claims to be. Plan section 5.4.
      expect(densities.length).toBeGreaterThan(0)
      expect(
        medianDensityWithinTolerance(densities),
        `digit median ${median(densities.map((d) => d.digitRatio)).toFixed(2)} vs target ${
          densities[0]?.digitTarget
        }, operator median ${median(densities.map((d) => d.operatorRatio)).toFixed(2)} vs target ${
          densities[0]?.operatorTarget
        }`,
      ).toBe(true)
    })

    it('stays inside the attempt cap', () => {
      // Not a timing assertion: the wall-clock ceiling lives in slow.yml, where a
      // regression shows up as a failed job rather than a flaky test on whatever
      // hardware happens to run it.
      expect(median(attempts)).toBeLessThan(100)
    })

    it('reports its measurements', () => {
      // Not an assertion. The numbers that belong in
      // .learnings/generation-measurements.md, printed so a slow run updates them
      // without anyone having to write a separate script.
      const summary = {
        difficulty,
        medianMs: median(durations),
        worstMs: Math.max(...durations),
        medianAttempts: median(attempts),
        worstAttempts: Math.max(...attempts),
        failures,
        medianDigitMask: Number(median(densities.map((d) => d.digitRatio)).toFixed(3)),
        medianOperatorMask: Number(median(densities.map((d) => d.operatorRatio)).toFixed(3)),
        medianUniquenessChecks: median(densities.map((d) => d.uniquenessChecks)),
      }
      // eslint-disable-next-line no-console -- the point of this test
      console.log(JSON.stringify(summary))
      expect(summary.difficulty).toBe(difficulty)
    })
  })
}

describe('mesh structure over many seeds', () => {
  it('never produces a structurally invalid mesh', () => {
    for (const difficulty of ALL_DIFFICULTIES) {
      const parameters = parametersFor(difficulty)
      for (let seed = 1; seed <= SEED_COUNT; seed += 1) {
        const mesh = buildMesh({ difficulty, rng: createRng(seed) })
        expect(mesh, `${difficulty} seed ${seed}`).not.toBeNull()
        if (mesh !== null) {
          expect(meshProblems(mesh, parameters), `${difficulty} seed ${seed}`).toEqual([])
        }
      }
    }
  })
})

describe('determinism over many seeds', () => {
  it('produces identical output for a repeated seed', () => {
    // The daily puzzle depends on this. Checked over a wide sample here rather
    // than the handful the fast suite can afford.
    for (const difficulty of ALL_DIFFICULTIES) {
      for (let seed = 1; seed <= 25; seed += 1) {
        const a = generate({ seed, difficulty })
        const b = generate({ seed, difficulty })
        expect(a.ok, `${difficulty} seed ${seed}`).toBe(b.ok)
        if (a.ok && b.ok) {
          expect(Array.from(a.puzzle.puzzle.values), `${difficulty} seed ${seed}`).toEqual(
            Array.from(b.puzzle.puzzle.values),
          )
        }
      }
    }
  })
})
