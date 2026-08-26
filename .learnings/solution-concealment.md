# The solution cannot be hidden client-side, only kept out of storage

Established in the Sudoku project, 2026-08-26. The reasoning transfers to
MathsCross unchanged, because it follows from uniqueness rather than from
anything Sudoku-specific.

## The fact

A puzzle's givens have exactly one solution — that is what generation enforces.
The givens must be on screen to be playable. So the solution is always derivable
by anyone who runs a solver against what is already in front of them, and no
client-side measure changes that.

Hashing does not help. A MathsCross digit cell has ten candidates and an operator
cell four, so a per-cell hash is brute-forced instantly.

## What is worth doing anyway

Not handing it over. Storing the solution as plain values under a well-known key
makes reading the answer a two-click operation in devtools requiring no knowledge
at all. So:

- `persist.ts` must not write the solution, and must **ignore** a `solution` field
  found in an older save, so storage can never tell the game the answer.
- A future save code must not carry it.
- Both recover it by solving the givens.

State the distinction as casual versus determined. Do not claim the solution is
secret.

## Where this applies again

Any future feature tempted to store derived answers: hint chains, precomputed
deduction steps, a reveal-all cache. Derive it, do not persist it.

## Open for MathsCross

Sudoku measured solving its givens at 0.07 ms median, which made re-deriving on
load affordable on the path that must mount the board before anything else. **That
number does not transfer.** A MathsCross solve spans digit-level variables and
masked operators, and is expected to cost more. Measure it at M5 before putting a
solve on the board-mount path; if it is too slow there, the answer is to solve
lazily when a check needs it, not to start persisting the solution.
