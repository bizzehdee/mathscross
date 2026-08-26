---
name: code-quality
description: Standards for code structure, duplication, abstraction timing, comments, and dead code. Covers SOLID and DRY balanced against a no-premature-abstraction rule, the why-only comment policy, and mandatory removal of dead and commented-out code. USE FOR writing new code, reviewing a diff, refactoring, deciding whether to extract an abstraction, deciding whether to add a comment, or cleaning up a file. DO NOT USE FOR architectural or feature-boundary decisions - see architecture-principles.
---

<!-- GENERATED FILE. Do not edit.
     Source: standards/*.md in the agent-framework repository.
     Standards version: f897c1ed | stacks: any -->

# Code quality

## SOLID and DRY, bounded by need

Follow SOLID and avoid duplication, balanced against no-premature-abstraction below.
Extract a common method when the same logic exists in more than one place.

Duplication of *shape* is not duplication of *logic*. Two blocks that look alike but
change for different reasons stay separate.

## No premature abstraction

Abstract only for a need that exists now. A concrete need is one of:

- The same logic exists in two or more places already.
- A second implementation of an interface exists, or the current task requires one.
- A boundary must be crossed for testability now.

State which of these applies before introducing an abstraction. Prefer duplicating a
small amount of code twice over an abstraction whose shape you cannot yet know.

## Comments

Comment only when the *why* is non-obvious. Never explain what the code does —
well-named identifiers do that. Legitimate comments explain:

- A constraint imposed from outside the code.
- A workaround, including what it works around and when it can be removed.
- A subtle invariant a reader could break unknowingly.

If a comment is needed to explain *what*, rename the identifiers or extract a named
method instead. Public API documentation comments are exempt where the codebase's
convention requires them.

## Dead code

- Remove dead code when you find it. Never comment it out.
- Remove commented-out code rather than leaving it. Version control holds the
  history.
- Remove parameters, fields, imports, and private members that your change makes
  unreachable.
- Do not remove code unreachable only from the current entry point but part of a
  published API. Ask first.

## Checklist

- [ ] No logic duplicated across the change.
- [ ] Every new abstraction has a stated, present-tense justification.
- [ ] Every comment explains a why, not a what.
- [ ] No commented-out code remains.
- [ ] Nothing left unreachable by this change.
