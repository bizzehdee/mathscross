/**
 * Main-thread client for the generation worker. Plan section 5.6.
 *
 * Owns the worker, draws seeds, and turns messages into promises. The engine
 * never chooses a seed: it receives one, which is what makes generation a pure
 * function of (seed, difficulty) and the daily puzzle reproducible.
 */
import type { Difficulty } from '../engine/difficulty'
import type { MaskDensity } from '../engine/mask'
import type { WorkerRequest, WorkerResponse } from '../engine/generate.worker'
import type { Grid } from '../engine/types'

/**
 * Draws a fresh 32-bit seed.
 *
 * `crypto.getRandomValues`, not `Date.now`. Consecutive games would otherwise get
 * adjacent seeds, and a session's seeds would be guessable from its start time.
 */
export function drawSeed(): number {
  const buffer = new Uint32Array(1)
  crypto.getRandomValues(buffer)
  return buffer[0] ?? 0
}

export interface GeneratedPuzzle {
  readonly seed: number
  readonly difficulty: Difficulty
  readonly generatorVersion: number
  readonly grid: Grid
  readonly density: MaskDensity
  readonly attempts: number
}

export type GenerateOutcome =
  | { readonly ok: true; readonly puzzle: GeneratedPuzzle }
  | {
      readonly ok: false
      readonly reason: 'cancelled' | 'exhausted' | 'no-mesh' | 'error'
      readonly detail?: string
    }

export interface GenerateHandle {
  readonly puzzle: Promise<GenerateOutcome>
  readonly cancel: () => void
}

export interface GenerateClientOptions {
  readonly onProgress?: (attempt: number) => void
}

interface Pending {
  readonly resolve: (outcome: GenerateOutcome) => void
  readonly onProgress?: (attempt: number) => void
}

export class GenerateClient {
  private readonly worker: Worker
  private nextRequestId = 1
  private readonly pending = new Map<number, Pending>()

  constructor() {
    this.worker = new Worker(new URL('../engine/generate.worker.ts', import.meta.url), {
      type: 'module',
    })
    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      this.handle(event.data)
    }
  }

  request(
    seed: number,
    difficulty: Difficulty,
    options: GenerateClientOptions = {},
  ): GenerateHandle {
    const requestId = this.nextRequestId
    this.nextRequestId += 1

    const puzzle = new Promise<GenerateOutcome>((resolve) => {
      this.pending.set(
        requestId,
        options.onProgress === undefined
          ? { resolve }
          : { resolve, onProgress: options.onProgress },
      )
    })

    this.send({ kind: 'generate', requestId, seed, difficulty })

    return {
      puzzle,
      cancel: () => {
        this.send({ kind: 'cancel', requestId })
      },
    }
  }

  /** Ends the worker and settles every outstanding promise as cancelled. */
  terminate(): void {
    this.worker.terminate()
    for (const [, entry] of this.pending) {
      entry.resolve({ ok: false, reason: 'cancelled' })
    }
    this.pending.clear()
  }

  private send(request: WorkerRequest): void {
    this.worker.postMessage(request)
  }

  private handle(response: WorkerResponse): void {
    const entry = this.pending.get(response.requestId)
    if (entry === undefined) {
      // A response to a request already settled or terminated. Dropping it is
      // correct: a cancelled request must not resolve twice.
      return
    }

    if (response.kind === 'progress') {
      entry.onProgress?.(response.attempt)
      return
    }

    this.pending.delete(response.requestId)

    if (response.kind === 'failed') {
      entry.resolve(
        response.detail === undefined
          ? { ok: false, reason: response.reason }
          : { ok: false, reason: response.reason, detail: response.detail },
      )
      return
    }

    entry.resolve({
      ok: true,
      puzzle: {
        seed: response.seed,
        difficulty: response.difficulty,
        generatorVersion: response.generatorVersion,
        grid: {
          size: response.size,
          kinds: response.puzzleKinds,
          values: response.puzzleValues,
        },
        density: response.density,
        attempts: response.attempts,
      },
    })
  }
}
