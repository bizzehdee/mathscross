# Learnings index

One line per entry. Read the entries relevant to your area before working in it.

Entries are added as facts are established, not in advance. An empty section
means nothing has been learned there yet, not that nothing can be.

## This project

- [sibling-project-inheritance.md](sibling-project-inheritance.md) — which parts of
  `C:\code\sudoku` MathsCross inherits, which it deliberately diverges from, and the
  learnings of its own that apply here unchanged. Read before adopting or rejecting
  a sibling convention.
- [masking-is-limited-by-weakly-constrained-cells.md](masking-is-limited-by-weakly-constrained-cells.md)
  — a cell only one equation crosses usually cannot be masked without losing
  uniqueness, a hand-built Medium reached 42% against a 60% target, and an operator
  mask is not cheaper than a digit mask. Read before changing masking order, the
  intersection ranges, or the mask density assertion.
- [windows-git-bash-mangles-app-base.md](windows-git-bash-mangles-app-base.md) — Git
  Bash rewrites `APP_BASE=/mathscross/` into a Windows path, silently, with a zero
  exit code. Read before verifying the Pages base path locally, or before passing any
  leading-slash value through a shell on Windows.
