/// <reference lib="webworker" />
/**
 * Generation worker.
 *
 * Generation must not run on the main thread. Measured at M2, Hard needs a median
 * of 830 ms and up to 1951 ms, which would freeze input and animation for that
 * whole time. Plan section 5.6.
 *
 * The worker owns generation and nothing else: it draws no seeds, reads no
 * storage, and makes no policy decisions. That keeps it a pure function of the
 * request, which is what the daily puzzle's reproducibility depends on.
 */
import type { Difficulty } from './difficulty'
import { generate, type GenerateFailure } from './generate'
import type { MaskDensity } from './mask'

export interface GenerateWorkerRequest {
  readonly kind: 'generate'
  readonly requestId: number
  readonly seed: number
  readonly difficulty: Difficulty
}

export interface CancelWorkerRequest {
  readonly kind: 'cancel'
  readonly requestId: number
}

export type WorkerRequest = GenerateWorkerRequest | CancelWorkerRequest

export type WorkerResponse =
  | { readonly kind: 'progress'; readonly requestId: number; readonly attempt: number }
  | {
      readonly kind: 'done'
      readonly requestId: number
      readonly seed: number
      readonly difficulty: Difficulty
      readonly generatorVersion: number
      /** The masked board. Transferred as a plain array for structured cloning. */
      readonly puzzleKinds: Uint8Array
      readonly puzzleValues: Int8Array
      readonly size: number
      readonly density: MaskDensity
      readonly attempts: number
    }
  | {
      readonly kind: 'failed'
      readonly requestId: number
      readonly reason: GenerateFailure | 'error'
      readonly detail?: string
    }

const cancelled = new Set<number>()

self.onmessage = (event: MessageEvent<WorkerRequest>): void => {
  const request = event.data

  if (request.kind === 'cancel') {
    cancelled.add(request.requestId)
    return
  }

  const { requestId, seed, difficulty } = request

  try {
    const result = generate({
      seed,
      difficulty,
      onAttempt: (attempt) => {
        // Report sparsely. One message per attempt would flood the main thread on
        // a difficulty that needs hundreds, and the UI only needs enough to show
        // that something is happening.
        if (attempt % 25 === 0) {
          post({ kind: 'progress', requestId, attempt })
        }
      },
      shouldCancel: () => cancelled.has(requestId),
    })

    if (!result.ok) {
      post({ kind: 'failed', requestId, reason: result.reason })
      return
    }

    // The solution is deliberately not sent. The main thread never needs it: it
    // re-derives it by solving the givens when a check requires it, which keeps
    // the answer out of memory and out of storage. Plan section 7.1.
    post({
      kind: 'done',
      requestId,
      seed: result.puzzle.seed,
      difficulty: result.puzzle.difficulty,
      generatorVersion: result.puzzle.generatorVersion,
      puzzleKinds: result.puzzle.puzzle.kinds,
      puzzleValues: result.puzzle.puzzle.values,
      size: result.puzzle.puzzle.size,
      density: result.puzzle.density,
      attempts: result.puzzle.attempts,
    })
  } catch (error) {
    post({
      kind: 'failed',
      requestId,
      reason: 'error',
      detail: error instanceof Error ? error.message : String(error),
    })
  } finally {
    cancelled.delete(requestId)
  }
}

function post(response: WorkerResponse): void {
  self.postMessage(response)
}
