---
name: git-and-commits
description: Commit, branch, and pull request practice - one logical change per commit, imperative subjects, bodies that explain why, no secrets, and no rewriting of published history. USE FOR writing a commit message, deciding what belongs in one commit, staging changes, naming a branch, writing a pull request description, or deciding whether to amend, rebase, or force-push. DO NOT USE FOR prose style in documentation - see technical-writing.
---

<!-- GENERATED FILE. Do not edit.
     Source: standards/*.md in the agent-framework repository.
     Standards version: f897c1ed | stacks: any -->

# Git and commits

## When to commit

**A series of tasks: one commit per task.** When the user asks for a sequence of
tasks — a task list, a numbered plan, a multi-step migration — commit each task as
it completes. Do not batch completed tasks together. Do not commit a task before
its tests pass ([[testing-standards]]). A task needing two unrelated changes is
two commits.

**Otherwise: commit only when asked.** Finishing work is not permission to commit
it.

**Always suggest a commit once the working tree is hard to review.** Signals, any
one of which is enough:

- Ten or more files changed, or several hundred changed lines.
- Two or more unrelated concerns in the tree.
- A change you can no longer summarise in one imperative subject line.

Name what you would commit now and what you would leave for a second commit, then
wait. Suggesting is required; committing unasked is still prohibited.

## Rules

- Create a branch before committing if the repository is on its default branch.
- Never pass `--no-verify`, `--no-gpg-sign`, or any flag that skips hooks or
  signing. If a hook fails, fix the cause.
- Interactive git modes are unavailable to agents. Do not attempt them.
- Never rewrite published history: no rebase, amend, or force-push on a branch
  another person may have pulled. `--force-with-lease` is acceptable only on your
  own unshared branch, and only when asked.
- Prefer a new commit over amending, unless the user asks and the commit is
  unpushed.

## One commit, one change

- A commit must be revertible on its own.
- Never mix a behaviour change with a refactor. Split them; land the refactor
  first.
- Formatting-only changes stand alone.
- Never stage secrets, credentials, tokens, or `.env` files
  ([[secure-engineering]]); generated files, build output, or dependency
  directories; commented-out code or debug output ([[code-quality]]).

## Message format

Follow the repository's convention. Read recent history first
([[existing-project-conventions]]). Absent a convention:

```text
<subject: imperative, 50 characters or fewer, no trailing full stop>

<body: why this change was made, wrapped at 72 characters>

<footer: ticket reference, breaking-change note>
```

- Imperative mood: "Add retry to payment client", not "Added" or "Adds".
- The body explains *why*; the diff shows *what*. Omit it only when the subject is
  complete on its own.
- State any breaking change and what callers must do.
- Describe the resulting code, not your session. "Fixed after testing" and
  "addressed review comments" are prohibited.
- Never claim a verification you did not perform.

## Branches

Branch from the updated default branch. Match the repository's naming convention;
absent one, use `<type>/<short-description>`, e.g. `fix/payment-retry-timeout`.
One concern per branch.

## Pull requests

State, briefly: what changed; why; how it was verified, with the observed result
([[testing-standards]]); risk and rollback if not trivially reversible.

## Checklist

- [ ] A commit was requested, or a task in a series just completed.
- [ ] Not on the default branch.
- [ ] The staged diff is one logical change.
- [ ] No secret, generated file, or debug output staged.
- [ ] Subject is imperative, 50 characters or fewer.
- [ ] No hook or signing check skipped.
