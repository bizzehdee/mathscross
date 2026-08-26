# MathsCross inherits its pipeline from a sibling Sudoku project

Established 2026-08-26, at M0, while scaffolding the repository. Revised the same
day to remove filesystem paths, for the reason in the last section.

## The fact

MathsCross was scaffolded from a sibling project: an offline-first Sudoku PWA with
the same shape — seeded runtime generation in a worker, a Cordova Android shell,
GitHub Pages deployment, and Play publishing. Its pipeline was working and its
costs were measured, so MathsCross copies rather than designs.

Inherited: the folder layout, the theme tokens, the `createConfig(target)` Vite
factory, the two Vitest configs, the workflow split, and the native shell
preferences. Copying is the default; a deviation needs a stated reason, and
`plan.md` section 11 holds the current list.

## Its learnings were copied, not linked

Every entry in this directory whose header says "Established in the Sudoku
project" is a copy. They were copied rather than referenced, because a path like
`C:\code\sudoku\.learnings\` is true on exactly one machine: another developer, a
CI runner, or this machine after a reorganisation would find nothing there. A
learning that cannot be read is not a learning.

The copies name the originating project for provenance but no location. Where a
fact was measured rather than reasoned, the copy says explicitly that the numbers
belong to the other project and do not transfer — see
[generation-cost-follows-rejection-rate.md](generation-cost-follows-rejection-rate.md),
which keeps the conclusion and the cap mistake while discarding the figures.

Where a copied claim has not yet been verified against MathsCross, the entry says
so rather than implying it has. Restating an unverified claim as local knowledge is
worse than not having it.

## What the sibling does not have

Three things were checked for and found absent, so none is a MathsCross omission:

- **No linter.** Its CI runs typecheck, tests, and builds only, with no ESLint
  configuration anywhere. MathsCross matches, relying on `strict` plus
  `noUnusedLocals` and `noUnusedParameters`. Adding ESLint would be a dependency
  neither project has justified.
- **No separate daily generator version.** Its daily seed is `hash(dateKey)` with
  no version mixed in, and its single generator version exists only to encode save
  codes. An earlier MathsCross draft invented a frozen daily version and called it
  a consequence of runtime generation; it was not, and it made generator bugs
  unfixable. Deleted. `plan.md` section 5.7 records the reasoning.
- **No bundle size ceiling.** MathsCross adds one, since a dependency-free bundle
  is easy to keep small and easy to lose by accident.

## Where this applies again

Any time a MathsCross decision looks novel: a working answer in a sibling project
outranks a better answer that has to be built and debugged. And any time a
learning, a plan section, or a comment is about to reference another repository —
copy the content instead, or restate the fact. Never write a path that only exists
here.
