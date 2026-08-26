# Learnings index

One line per entry. Read the entries relevant to your area before working in it.

Entries whose header says "Established in the Sudoku project" were copied from a
sibling project rather than linked to it, because a path outside this repository is
true on one machine only. See
[sibling-project-inheritance.md](sibling-project-inheritance.md).

## Project and process

- [sibling-project-inheritance.md](sibling-project-inheritance.md) — what MathsCross
  inherits from the sibling Sudoku project, what it deliberately does differently,
  and why the sibling's learnings were copied rather than referenced by path. Read
  before adopting or rejecting a sibling convention.

## Generation and puzzles

- [masking-is-limited-by-weakly-constrained-cells.md](masking-is-limited-by-weakly-constrained-cells.md)
  — a cell only one equation crosses usually cannot be masked without losing
  uniqueness, a hand-built Medium reached 42% against a 60% target, and an operator
  mask is not cheaper than a digit mask. Read before changing masking order, the
  intersection ranges, or the mask density assertion.
- [generation-measurements.md](generation-measurements.md) — MathsCross's own measured cost per difficulty, and the four decisions that dominated it: the solver cannot fill an empty grid, derive the widest term, cell-count filtering admits impossible patterns, and variable order decides whether uniqueness checking is feasible. Also why operators must be masked before digits. Read before changing the attempt cap, the node budget, the masking order, or any density target.
- [generation-cost-follows-rejection-rate.md](generation-cost-follows-rejection-rate.md)
  — cost is driven by how many seeds a difficulty rejects, not by how hard it plays,
  so the hardest grade need not be the slowest; and an attempt cap set from intuition
  reported a defect that did not exist. Read before changing the attempt cap or
  diagnosing a slow difficulty.
- [solution-concealment.md](solution-concealment.md) — the solution follows from the
  givens, so it cannot be hidden from a determined reader; what is achievable is
  keeping it out of storage. Read before persisting anything derived from a solution.

## Platform and storage

- [native-shell-origin.md](native-shell-origin.md) — a Cordova shell must serve from
  `https://localhost`, not `file://`, or `localStorage` is not durable and there is
  no secure context. The failure is silent. Read before touching `native/config.xml`
  or the native base path.
- [ios-storage-eviction.md](ios-storage-eviction.md) — iOS deletes all
  script-writable storage after 7 days without interaction, IndexedDB included, so
  switching to IndexedDB does not fix it; home-screen installs are exempt. Read
  before touching persistence or stats.

## Build, test and release

- [github-pages-tag-deploys.md](github-pages-tag-deploys.md) — a tag-triggered Pages
  deploy is rejected until the `github-pages` environment gets a tag rule, and the
  error blames the tag rather than the setting. Read before pushing the first `v*`
  tag.
- [play-app-signing.md](play-app-signing.md) — "Releases are signed by Google Play"
  does not remove the need for an upload key, the console hands back certificates
  rather than private keys, and the APK CI builds is not the one users get. Read
  before touching the signing secrets or testing a release build.
- [windows-git-bash-mangles-app-base.md](windows-git-bash-mangles-app-base.md) — Git
  Bash rewrites `APP_BASE=/mathscross/` into a Windows path, silently, with a zero
  exit code. Read before verifying the Pages base path locally, or before passing any
  leading-slash value through a shell on Windows.
- [windows-npm-script-env-vars.md](windows-npm-script-env-vars.md) — an npm script
  cannot set an environment variable inline on Windows, which is why suite and target
  selection use config files. Read before adding a script that needs per-run
  configuration.
- [windows-vite-child-process-locks.md](windows-vite-child-process-locks.md) — killing
  an npm script on Windows orphans the vite child, which holds a lock on the output
  directory and makes the next build fail with `EPERM`. A closed port is not evidence
  the server exited. Read before starting or stopping a dev server.
- [vite-root-src-module-paths.md](vite-root-src-module-paths.md) — the dev server
  serves modules from `src/`, so an in-page import uses `/engine/...` not
  `/src/engine/...`. Read before driving the app from the browser console.
- [service-worker-unverifiable-in-pane.md](service-worker-unverifiable-in-pane.md) —
  the in-app browser pane cannot register a service worker, so a passing build is not
  evidence of offline capability. Read before claiming offline behaviour is verified.
