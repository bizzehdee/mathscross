# Mask density is limited by cells only one equation crosses

Established 2026-08-26, at M0.5, by hand-authoring the boards in
`playtest/boards.md`. No generator code existed yet.

## The fact

A cell that belongs to exactly one equation is weakly constrained, and masking it
is often what destroys uniqueness. A cell at an intersection belongs to two
equations, and masking it is comparatively safe.

Authoring a Medium 7 x 7 by hand, the 60% digit-mask target in plan section 2.7 was
unreachable. Three masks had to be given back, and every one was a
single-equation cell:

| Masked as | Readings | Fix |
|---|---|---|
| `7 ? ? 8 = ? 5` | `7+18=25`, `7+28=35`, `7+38=45`, … | give the tens digit |
| `2 * ? 2 = ? 4` | `2*12=24`, `2*22=44`, `2*32=64`, `2*42=84` | give the tens digit |
| `5 ? ? 4 ? = ?` | `50-46`, `51-47`, `52-48`, `53-49` | give one digit |

Achieved density was **8 of 19 digits, or 42%**, against a 60% target. An
18-point shortfall, on a Medium board, built deliberately rather than by search.

## Why it matters

This is plan section 5.4's restore-on-failure loop, observed before the generator
exists. Two consequences for the implementation:

1. **Mask intersection cells in preference to non-intersection cells.** The random
   masking order in section 5.4 should be weighted, not uniform. An unweighted
   order spends its uniqueness budget on the cells least able to survive masking.
2. **Prefer meshes with high intersection density.** Section 2.7's intersection
   count is currently a range to satisfy. It is really a lever on achievable mask
   density, and the top of the range is the better place to sit.

The 10-percentage-point tolerance asserted in section 13.4 may itself be
optimistic. A hand-built Medium missed by 18. Do not widen the tolerance to make
the assertion pass — that would defeat its purpose. Treat a miss as evidence about
masking order or mesh choice.

## The related result about operators

Masking an operator is usually free, because arithmetic and cell width pin it down.
Of five operators masked on the same board, four were forced:

- `? ? 25 = ?2` — multiplication gives 25, 50, 75 then three digits, none ending in
  2; subtraction goes negative. Only `+`.
- `51 ? 4? = 4` — addition exceeds 90. Only `-`.
- `7 ? 18 = ?5` — subtraction gives −11 which cannot fill `?5`; multiplication gives
  126 which needs three cells. Only `+`.

The fifth was not. `2 ? 32 = ?4` admits both `2 + 32 = 34` and `2 * 32 = 64`: two
operators agreeing on the result's digit count *and* its last digit.

So an operator mask cannot be treated as cheaper than a digit mask. It needs the
same uniqueness check, and when the check fails the fix is to restore that operator
rather than a digit. At Hard's 100% operator masking this is the mechanism by which
Hard could quietly become Medium.

## Where this applies again

Any change to masking order, to the intersection-count ranges, or to the mask
density assertion. Also read before concluding that a difficulty's low achieved
density is a bug: it may be the geometry.
