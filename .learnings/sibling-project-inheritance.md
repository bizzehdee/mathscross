# MathsCross inherits its pipeline from the Sudoku sibling

Established 2026-08-26, at M0, while scaffolding the repository.

## The fact

`C:\code\sudoku` is an offline-first Sudoku PWA with the same shape as MathsCross:
seeded runtime generation in a worker, a Cordova Android shell, GitHub Pages
deployment, and Play publishing. Its pipeline works and its costs are measured.

MathsCross therefore copies rather than designs: the folder layout, the theme
tokens, the `createConfig(target)` Vite factory, the two Vitest configs, the
workflow split, and the native shell preferences. Copying is the default and a
deviation needs a stated reason. Plan section 11 holds the current list of eight.

## Its learnings that apply here unchanged

These live in `C:\code\sudoku\.learnings\` and were not rediscovered here. Read the
relevant one before the work it governs, rather than assuming MathsCross differs:

| Entry | Read before |
|---|---|
| `native-shell-origin.md` | touching `native/config.xml` or the native base path |
| `generation-measurements.md` | changing generation or the attempt cap |
| `github-pages-tag-deploys.md` | changing the deploy trigger, or debugging a rejected deployment |
| `play-app-signing.md` | touching signing secrets or testing a release build |
| `solution-concealment.md` | persisting anything derived from the solution |
| `ios-storage-eviction.md` | touching persistence or stats |
| `service-worker-unverifiable-in-pane.md` | verifying offline behaviour |
| `windows-vite-child-process-locks.md` | starting or stopping a dev server, or a build failing with `EPERM` |
| `vite-root-src-module-paths.md` | driving the app from the browser console |
| `windows-npm-script-env-vars.md` | adding an npm script that needs per-run configuration |

Copy an entry into this directory once its claim has been verified against
MathsCross specifically. Until then the cross-repository path is the honest
reference: restating an unverified claim as local knowledge is worse than pointing
at where it was actually established.

## What the sibling does not have

Two things were checked for and found absent, so neither is a MathsCross omission:

- **No linter.** Its `ci.yml` runs typecheck, tests, and builds only, and there is
  no ESLint configuration anywhere. MathsCross matches, relying on `strict` plus
  `noUnusedLocals` and `noUnusedParameters`. Adding ESLint would be a dependency
  neither project has justified.
- **No `DAILY_GENERATOR_VERSION`.** Its daily seed is `hash(dateKey)` with no
  version mixed in, and its single `GENERATOR_VERSION` exists only to encode save
  codes. An earlier MathsCross draft invented a frozen daily version and called it a
  consequence of runtime generation; it was not, and it made generator bugs
  unfixable. Deleted. Plan section 5.7 records the reasoning.

## Where this applies again

Any time a MathsCross decision looks novel. Check the sibling first — a working
answer next door outranks a better answer that has to be built and debugged.
