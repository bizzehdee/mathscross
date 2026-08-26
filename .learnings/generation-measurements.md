# Generation cost, and the four things that dominated it

Established 2026-08-26, at M2, over 60 seeds per difficulty on the development
machine (Windows 11, Node 20.20.1). Re-measured by `npm run test:slow`, which
prints the same figures.

## Measured

| Difficulty | Median ms | Worst ms | Median attempts | Worst attempts | Digit mask | Operator mask | Median checks |
|---|---|---|---|---|---|---|---|
| easy | 0 | 3 | 1 | 1 | 0.43 | 0.00 | 3 |
| medium | 24 | 290 | 1 | 4 | 0.53 | 0.40 | 21 |
| hard | 830 | 1951 | 3 | 10 | 0.46 | 1.00 | 38 |

Zero failures in 180 generations.

## What dominated, in the order it was found

Every one of these was found by measurement, and each was invisible in the fast
suite. Three were wrong decisions of mine rather than missing code.

### 1. The general solver cannot fill an empty grid

`fillMesh` first delegated to `solve`. Easy filled in 1 ms, Medium never
finished, Hard exhausted the test worker.

`solve` prunes with a forward check that only rejects a **fully assigned**
equation. From an empty grid every equation reads `incomplete`, so nothing prunes
until a whole equation is filled and the search degenerates to blind enumeration:
19 digit cells at Medium is 10^19 states.

Filling is a **construction** problem, not a search. Pick two terms, derive the
third, check it fits. Working per number instead of per digit collapsed the fill
to 1 ms.

### 2. Derive the widest term, not the result

The construction first drew both operands and computed the result. That is
hopeless when the result is *narrower* than the operands: Hard offers
`ddd op ddd = d`, where two random three-digit operands land on a one-digit
result about 1% of the time, and all seven of Hard's equations must succeed at
once. Hard's fill never once succeeded.

Deriving whichever term has the **most cells** fixed it — that term has the most
room to absorb the others. Fill success went to 42% of attempts.

### 3. Cell-count filtering admits arithmetically impossible patterns

`dd op ddd = dd` fits nine cells exactly and can never hold: addition and
multiplication overflow the two-digit result, subtraction and division undershoot
the three-digit operand. The fill failed on its first equation, every seed.

Interval arithmetic over the three width ranges now rejects these before a mesh
is built. Necessary rather than sufficient — it ignores integrality and exact
division — but it removes the patterns that cost whole attempts.

### 4. Variable order decides whether uniqueness checking is feasible

Most-constrained-first is the textbook heuristic and it was the wrong one here.
It interleaves cells from different equations, so no equation completes early and
the forward check never fires. A 60%-masked Medium board took **19 seconds** to
check for uniqueness.

Ordering variables **equation by equation**, breadth-first so each shares cells
with one already assigned, took the same check to 261 ms. Same algorithm, same
pruning rule, different order.

## Uniqueness checking is exponential in the blank count

Measured on one Hard board, masking cells one at a time:

| Blanks | Check ms |
|---|---|
| 5 | 1 |
| 10 | 4 |
| 15 | 48 |
| 18 | 371 |
| 19 | 2269 |

Hard's original target was 29 of 39 digit cells. Masking to it takes minutes per
puzzle, so it is not reachable by spending more time.

Two consequences:

- **`solve` takes a node budget** (`DEFAULT_MAX_NODES`), and `hasUniqueSolution`
  answers false when the budget runs out. Deliberately conservative: the
  generator refuses a mask it cannot cheaply *prove* safe, so a shipped puzzle is
  never ambiguous and the cost is density, not correctness.
- **Hard's digit target moved from 0.75 to 0.45**, and Medium's from 0.60 to
  0.50. Both are now set from what uniqueness allows rather than from intuition.

Raising them again needs a stronger solver, not a bigger budget. The specific
missing capability is **bounds propagation** over partially known numbers: with
one digit of a two-cell operand fixed, its value is confined to a ten-wide range,
which bounds the equation's other terms. The current forward check cannot use
that and so learns nothing until a number is complete. That is the way back to a
higher Hard density if anyone wants it.

## Operators must be masked before digits

The sharpest single result, and it rescued Hard's defining mechanic.

Uniqueness is a budget, and whichever kind is masked first spends it. With digits
masked first, Hard reached **14%** of its operator target while Medium reached
40% — the ladder inverted on the one dimension that most distinguishes Hard.
Masking operators first took Hard to the full **100%**, and made generation
*faster* (830 ms median against 1795 ms), because a denser grid settles a
uniqueness check sooner.

Operators are the scarce resource: a handful per grid against dozens of digits,
and each carries far more difficulty. Spend the budget on them first.

This also settles the hypothesis plan section 2.7 raised and M0.5 doubted. 100%
operator masking *is* achievable at Hard. It was never the mask density that was
wrong, only the order.

## Density varies per puzzle; assert on the distribution

About a quarter of legitimate puzzles sit more than 10 points under their density
target while the median sits within 3. A per-puzzle assertion therefore fails
constantly without indicating anything.

The slow suite asserts `medianDensityWithinTolerance` instead. The failure worth
catching is a *distribution* that has slipped, because that is what "Hard quietly
became Medium" actually looks like.

## Where this applies again

Before changing the attempt cap, the node budget, the masking order, or any
density target. Also before concluding a difficulty is slow because of the code:
in four cases out of four here, it was a decision.
