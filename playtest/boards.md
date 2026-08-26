# M0.5 — the playtest gate

Hand-authored boards, per plan section 14.1. No code was involved: these were
constructed and checked by hand, which is the point. The gate exists so that the
mechanic is judged before M2 builds a generator for it.

**The criterion is yours, not mine.** Pass means you would voluntarily play a third.
Solve board 1 and board 2, then read the findings section, then decide.

`#` is a block. `?` is a cell you fill. Equations read left to right and top to
bottom, with **normal BODMAS arithmetic**.

> These boards were authored while the plan still specified left-to-right evaluation
> with precedence ignored. That rule was reversed immediately afterwards, for the
> reason now in plan section 2.5. Every equation on every board below has a single
> operator on each side of the `=`, so precedence cannot arise and all three boards
> and all three findings are unaffected. Finding 3 is what prompted the reversal.

Solutions are at the bottom. The findings section between the boards and the
solutions contains no spoilers for boards 1 and 2.

---

## Board 1 — Easy, 5 x 5

Six equations: three rows, three columns. Single digits, `+` and `-` only, no
negatives. Every operator is given.

```
      c0  c1  c2  c3  c4

r0     ?   -   3   =   4
r1     -   #   +   #   +
r2     3   +   ?   =   5
r3     =   #   =   #   =
r4     4   +   ?   =   ?
```

Read the six equations as:

```
rows      r0: ? - 3 = 4        r2: 3 + ? = 5        r4: 4 + ? = ?
columns   c0: ? - 3 = 4        c2: 3 + ? = ?        c4: 4 + 5 = ?
```

Four blanks. Each falls out directly from one equation.

---

## Board 2 — Medium, 7 x 7

Five equations: three rows, two columns. Numbers now span cells, so `2 5` in
adjacent cells reads as twenty-five. All three of `+ - *` appear. Two operators are
blank as well as eight digits.

```
      c0  c1  c2  c3  c4  c5  c6

r0     ?   +   2   5   =   ?   2
r1     ?   #   #   #   #   #   *
r2     1   #   #   #   #   #   3
r3     8   +   1   ?   =   ?   2
r4     =   #   #   #   #   #   =
r5     ?   #   #   #   #   #   ?
r6     5   1   ?   4   ?   =   ?
```

The five equations:

```
r0    ?  +  25  =  ?2          a single digit plus twenty-five
r3    8  +  1?  =  ?2
r6   51  ?  4?  =  ?           two-digit minus two-digit, single-digit result
c0    7  ?  18  =  ?5          reading down column 0
c6    2  *   ?2  =  ?4          reading down column 6
```

Ten blanks, two of them operators. Note that `r6` and `c6` share the cell at
`(r6,c6)`, so the column tells you the row's answer and vice versa.

---

## Board 3 — the Hard hypothesis

Plan section 2.7 sets Hard at **100% operator masking**: every operator blank, plus
75% of digits. It flags this as a hypothesis rather than a specification. Board 3
tests the hypothesis on board 2's geometry rather than a fresh 9 x 9, because the
question is whether all-operators-blank is *deducible*, and that does not need a
bigger grid to answer.

Board 2, with all five operators blank instead of two:

```
      c0  c1  c2  c3  c4  c5  c6

r0     ?   ?   2   5   =   ?   2
r1     ?   #   #   #   #   #   ?
r2     1   #   #   #   #   #   3
r3     8   ?   1   ?   =   ?   2
r4     =   #   #   #   #   #   =
r5     ?   #   #   #   #   #   ?
r6     5   1   ?   4   ?   =   ?
```

Work each equation's operator out from its arithmetic before reading the findings.

---

## Findings from authoring these

Three results, all obtained by hand while constructing the boards. None depends on
your enjoyment judgement, so they stand either way.

### 1. Uniqueness forced the Medium mask density down, hard

Board 2 has 19 digit cells. Plan section 2.7 targets **60% digit masking**, so 11
blanks. I could not reach 11 and keep one solution. Three separate masks had to be
given back:

- `c0` masked as `7 ? ? 8 = ? 5` has infinitely many readings: `7 + 18 = 25`,
  `7 + 28 = 35`, `7 + 38 = 45` and so on. The tens digit had to become a given.
- `c6` masked as `2 * ? 2 = ? 4` has four: `2 * 12 = 24`, `2 * 22 = 44`,
  `2 * 32 = 64`, `2 * 42 = 84`. Same fix.
- `r6` masked as `5 ? ? 4 ? = ?` has four: `50 - 46`, `51 - 47`, `52 - 48`,
  `53 - 49`. The cells `(r6,c1)` and `(r6,c4)` sit in no column equation, so nothing
  else constrains them.

Achieved density was **8 of 19, or 42%**, against a 60% target — an 18-point
shortfall on a *Medium* board built deliberately.

This is section 5.4's restore-on-failure loop, observed before a line of generator
code exists. It is direct support for the section 13.4 assertion that achieved mask
density must be asserted rather than assumed, and it suggests the 10-point tolerance
in that assertion may itself be optimistic.

The structural cause is worth naming: **a digit cell belonging to only one equation
is weakly constrained.** Board 2's ambiguities were all in cells no second equation
crossed. That argues for the generator preferring meshes with high intersection
density, and for masking intersection cells in preference to non-intersection ones.

### 2. Masking every operator is mostly free, and occasionally fatal

Board 3 masks all five operators. Four of the five are still forced:

- `r0`: `? ? 25 = ?2`. Multiplication gives 25, 50, 75, then three digits — none
  ends in 2. Subtraction goes negative. Only `+` survives.
- `r3`: same shape, same reasoning. Only `+`.
- `r6`: `51 ? 4? = 4`. Addition exceeds 90, multiplication far more. Only `-`.
- `c0`: `7 ? 18 = ?5`. Addition gives 25. Subtraction gives −11, which cannot fill
  `?5`. Multiplication gives 126, which needs three cells. Only `+`.

The fifth is not:

- `c6`: `2 ? 32 = ?4`. Addition gives **34**. Multiplication gives **64**. Both fit
  the cell pattern and both leave a consistent grid. **Two solutions.**

So the operator mask is usually harmless — the arithmetic and the cell widths pin it
down — but it fails exactly where two operators happen to agree on the result's
shape. `2 + 32` and `2 * 32` both give a two-digit number ending in 4, and nothing
distinguishes them.

The practical consequence for the generator: **an operator mask cannot be treated as
cheaper than a digit mask.** Each one needs the same uniqueness check, and when it
fails, the fix is to give back that operator rather than a digit. At Hard's 100%
operator masking, expect the loop to hand a meaningful fraction of them back, which
is the mechanism by which Hard could quietly become Medium.

### 3. The evaluation rule never came up — which changed the rule

Not once in three boards. Every equation I could build within the cell budget has a
single operator on each side of the `=`, so precedence has nothing to disambiguate.
`5 + 3 * 2` needs five cells for the left side alone plus four more for `= 11`, so
nine — a full Hard row, and only in the one pattern that fits.

So whichever evaluation rule the game uses, it is a **Hard-only concern** in
practice. Easy and Medium cannot express an equation where it matters.

That finding is what prompted reversing the rule. Under the old left-to-right rule,
the plan was carrying a mechanic that almost never fired, that contradicted school
arithmetic, and that therefore had to be taught in the onboarding before a player
could meet it — a teaching cost paid by every player for a rule most would never
encounter. Under BODMAS the rarity costs nothing, because the behaviour is what a
player already expects. The onboarding slot freed up went to multi-cell numbers,
which unlike precedence apply from the first Medium board.

The wider lesson: check how often a distinctive rule can actually fire before paying
to teach it.

---

## Solutions

**Board 1.**

```
7 - 3 = 4
-   +   +
3 + 2 = 5
=   =   =
4 + 5 = 9
```

Blanks were `(r0,c0)=7`, `(r2,c2)=2`, `(r4,c2)=5`, `(r4,c4)=9`.

**Board 2.**

```
7 + 25 = 32
+          *
1          3
8 + 14 = 22
=          =
2          6
51 - 47 = 4
```

The five equations: `7 + 25 = 32`, `8 + 14 = 22`, `51 - 47 = 4`, `7 + 18 = 25`,
`2 * 32 = 64`.

**Board 3.** The same grid as board 2, except `c6` is genuinely ambiguous: both
`2 + 32 = 34` and `2 * 32 = 64` solve it. There is no unique answer, which is the
finding rather than a mistake in the board.
