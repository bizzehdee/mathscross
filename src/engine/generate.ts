/**
 * The generator: mesh, fill, mask, verify. Plan section 5.
 *
 * ## Attempts, not a clock
 *
 * The cap is on attempts rather than wall-clock time. Cost is almost entirely a
 * function of how many candidate seeds a difficulty rejects before one qualifies,
 * so an attempt count is the thing that actually varies and the thing worth
 * bounding. A time budget would also make the generator non-deterministic, which
 * the daily puzzle cannot tolerate.
 *
 * The cap starts at 5000 because a sibling project set 500 from intuition, then
 * measured a worst case of 331 — putting 500 inside the normal operating range,
 * where it would have rejected legitimate seeds and reported a defect that did not
 * exist. See `.learnings/generation-cost-follows-rejection-rate.md`.
 *
 * ## Determinism
 *
 * `generate({ seed, difficulty })` is a pure function of those two arguments.
 * `onAttempt` and `shouldCancel` observe and abort; neither may influence the
 * result. Every random choice comes from one Rng seeded once per attempt from the
 * caller's seed, so attempt N of a given seed is always the same attempt N.
 */
import { parametersFor, type Difficulty } from './difficulty'
import { buildMesh, meshProblems } from './mesh'
import { fillMesh } from './fill'
import { maskGrid, type MaskDensity } from './mask'
import { parseGrid } from './parse'
import { createRng } from './rng'
import type { Technique } from './solver'
import { solve } from './solver'
import type { Grid } from './types'

/**
 * Bumped whenever a change alters what a seed produces.
 *
 * Free play does not care: a new seed is drawn per game. It exists for save
 * codes in release 2, where a shared code must decode to the same puzzle.
 *
 * There is deliberately no separate frozen version for dailies. Plan section 5.7
 * explains why, and what protects a player's dailies instead.
 */
export const GENERATOR_VERSION = 1

export const DEFAULT_MAX_ATTEMPTS = 5000

export interface Puzzle {
  readonly seed: number
  readonly difficulty: Difficulty
  readonly generatorVersion: number
  /** The masked board the player is given. */
  readonly puzzle: Grid
  /** The full solution. Never persist this: plan section 7.1. */
  readonly solution: Grid
  readonly density: MaskDensity
  readonly techniques: ReadonlySet<Technique>
  /** Attempts spent, including the successful one. */
  readonly attempts: number
}

export type GenerateFailure = 'exhausted' | 'cancelled' | 'no-mesh'

export type GenerateResult =
  | { readonly ok: true; readonly puzzle: Puzzle }
  | { readonly ok: false; readonly reason: GenerateFailure; readonly attempts: number }

export interface GenerateRequest {
  readonly seed: number
  readonly difficulty: Difficulty
  readonly maxAttempts?: number
  /** Called with the attempt number. Must not influence the result. */
  readonly onAttempt?: (attempt: number) => void
  /** Aborts between attempts and inside the masking loop. */
  readonly shouldCancel?: () => boolean
}

export function generate(request: GenerateRequest): GenerateResult {
  const { seed, difficulty, onAttempt, shouldCancel } = request
  const maxAttempts = request.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  const parameters = parametersFor(difficulty)

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (shouldCancel?.() === true) {
      return { ok: false, reason: 'cancelled', attempts: attempt - 1 }
    }
    onAttempt?.(attempt)

    // One Rng per attempt, seeded from the request seed and the attempt number,
    // so attempt N is reproducible on its own and two attempts never share a
    // stream.
    const rng = createRng((seed ^ Math.imul(attempt, 0x9e37_79b9)) >>> 0)

    const mesh = buildMesh({ difficulty, rng })
    if (mesh === null) {
      // No width triple fits the grid size, or no layout reaches the
      // intersection range. A configuration fault, not bad luck: retrying with
      // another seed cannot help.
      return { ok: false, reason: 'no-mesh', attempts: attempt }
    }

    const structural = meshProblems(mesh, parameters)
    if (structural.length > 0) {
      // The mesh builder is meant to satisfy these by construction, so this is a
      // defect rather than a rejection. Checked anyway, because it is cheap and
      // a malformed mesh would otherwise waste a whole fill.
      throw new Error(`mesh builder produced an invalid mesh: ${structural.join('; ')}`)
    }

    const filled = fillMesh(mesh, { difficulty, rng })
    if (filled === null) {
      continue
    }

    const masked = maskGrid(filled.grid, {
      difficulty,
      rng,
      parsed: filled.parsed,
      ...(shouldCancel === undefined ? {} : { shouldCancel }),
    })

    if (shouldCancel?.() === true) {
      return { ok: false, reason: 'cancelled', attempts: attempt }
    }

    // Confirm on the finished puzzle rather than trusting the masking loop. The
    // loop restores a cell whenever uniqueness is lost, so this should always
    // hold; it is asserted because shipping an ambiguous puzzle is the one
    // outcome no amount of density is worth.
    const check = solve(masked.grid, {
      operators: parameters.operators,
      maxSolutions: 2,
      parsed: filled.parsed,
    })
    if (check.count !== 1) {
      continue
    }
    // The mask enforces this per cell, so reaching here with a puzzle that needs
    // guessing would mean the two disagree. Asserted rather than assumed, because
    // the promise made to a player at these grades is that no guess is required,
    // and a silent breach of it is indistinguishable from a hard puzzle.
    if (parameters.requireDeducible && check.techniques.has('search')) {
      continue
    }

    return {
      ok: true,
      puzzle: {
        seed,
        difficulty,
        generatorVersion: GENERATOR_VERSION,
        puzzle: masked.grid,
        solution: filled.grid,
        density: masked.density,
        techniques: check.techniques,
        attempts: attempt,
      },
    }
  }

  return { ok: false, reason: 'exhausted', attempts: maxAttempts }
}

/**
 * Re-derives the parse of a puzzle's grid.
 *
 * Structure depends only on cell kinds, so a caller holding a masked grid can
 * recover its equations without the solution. This is what lets the board render
 * and validate without the answer being in memory, per plan section 7.1.
 */
export function parsePuzzle(grid: Grid): ReturnType<typeof parseGrid> {
  return parseGrid(grid)
}
