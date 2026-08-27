# Enforce an acceptance rule where the work happens, not after it

Established in MathsCross, 2026-08-27, adding a "solvable without guessing"
guarantee to the two difficulties children play.

## The requirement

Easy and Medium must be solvable by deduction alone — no point at which a player
has to try a value to see whether it works. The engine can already tell: the solver
records a `search` technique the moment constraint propagation stalls and it has to
branch, so a puzzle whose solve records no `search` fell to forced steps only.

## What measurement changed about the plan

Three things, each of which would have been got wrong by reasoning alone.

**1. The old ladder was wrong in kind, not degree.** Easy measured 30 of 30
deducible; the old Medium measured **0 of 30**. Not "harder" — categorically
different. A grade where every board needs a guess is not a step up from one where
none does, and no amount of parameter tuning turns one into the other.

**2. Loosening the parameters does not produce deducibility.** The obvious fix is
to mask fewer cells, stop hiding operators and drop negatives. Done all three: the
new Medium still measured **0 of 40** deducible without the rule. Fewer blanks make
a puzzle *shorter*, not more *logical*. Deducibility is a property of the chain of
inferences, and nothing about a smaller mask guarantees the chain exists.

**3. Where the rule is enforced dominates its cost.** Two placements, both
correct, measured on the same 25 seeds of Medium:

| enforcement | attempts | median | worst |
|---|---|---|---|
| reject the finished board | 263.0 | 277 ms | 868 ms |
| check as each cell is masked | **2.0** | **2 ms** | **8 ms** |

138 times faster for an identical guarantee.

## Why the difference is so large

Generation is: build a mesh, fill it, mask cells one at a time, verify. Rejecting at
the *end* throws away every mask that preceded the rejection, so the whole attempt
is lost and the next one starts from nothing. Checking as each cell is masked
cannot lose an attempt at all — the mask simply stops growing at the point
deduction can no longer reach it, and the board is accepted slightly less dense.

**The cost lands on density, which is recoverable, instead of on attempts, which
are not.** That is the general shape: when an acceptance rule can be evaluated
incrementally, evaluating it incrementally converts a rejection into a smaller
result. A rule evaluated only at the end can do nothing but discard.

Ordering matters within the check too. Uniqueness must explore the whole space to
prove no second answer exists; deducibility stops at the first stall. The cheap
test runs first, so for a deducible difficulty most rejections never pay for the
expensive one.

## The one-way nature of the guarantee

`search` absent means propagation finished the board, and both techniques
propagation uses are ones a child can do: an equation with one blank determines
that blank, and a cell where two equations cross takes only the values both allow.
So **no `search` implies genuinely deducible**, and that direction is what a
promise to a player needs.

The converse does not hold. A puzzle the engine had to search might still be
deducible by a person reasoning about magnitude or parity, which this engine cannot
do. So the rule rejects some acceptable puzzles. For the grades children play that
is the right direction to be wrong in, and the price is paid in density rather than
in a broken promise.

## Where this applies again

Any generate-then-verify loop with a rule that can be checked on a partial result:
mask density, uniqueness, deducibility, a size budget, a legality constraint. Ask
whether the rule can be evaluated before the candidate is finished. If it can,
enforcing it there turns a thrown-away attempt into a slightly weaker result.

And before tuning parameters to reach a property, **measure whether the property
follows from the parameters at all.** Here it did not, and the tuning would have
looked like progress: the boards did get easier, they just never got logical.
