---
name: error-handling
description: How to signal and handle failure - expected failures are returned as values, exceptions are reserved for genuinely exceptional conditions, and are never used for control flow or silently swallowed. USE FOR designing a function's failure signature, deciding whether to return an error or throw, writing a catch block, handling a failed external call, mapping errors at a boundary, or reviewing error paths. DO NOT USE FOR deciding what to log - see observability-standards.
---

<!-- GENERATED FILE. Do not edit.
     Source: standards/*.md in the agent-framework repository.
     Standards version: f897c1ed | stacks: any -->

# Error handling

## Return values are the default; exceptions are not

Throwing captures a stack trace and unwinds the stack, costing orders of magnitude
more than a return. Exceptions are for *exceptional* conditions. They are not the
default error-handling mechanism.

Classify every failure before choosing a mechanism.

| Failure kind | Example | Mechanism |
|---|---|---|
| Expected, part of the contract | Not found, validation failed, parse failed, insufficient funds | **Return a value** |
| Caller mistake, a bug | Null argument, index out of range, invalid state transition | **Throw** |
| Environment failure, unrecoverable here | Database unreachable, disk full, out of memory | **Throw or propagate** |

- A failure that is a normal outcome of calling the function must be returned, not
  thrown.
- Never use an exception for control flow, or as the expected path through working
  code.
- Never throw inside a loop or hot path to signal an ordinary outcome.
- A function whose name asks a question (`Try`, `Find`, `Parse`) must not throw
  when the answer is no.

To return a failure, use what the codebase already provides, preferring in order: a
result type; a try-pattern with a success flag and out value; a nullable return
when the reason does not matter; an error return alongside the value. Do not
introduce a result type into a codebase that has none without approval
([[existing-project-conventions]]).

## Throwing

- Throw the most specific type available, never a bare base type.
- Include the values needed to diagnose it; never secrets or personal data
  ([[secure-engineering]]).
- Throw at the boundary where invalid input arrives. Bad data must not travel
  inward.
- Fail fast on a violated invariant. Corrupted state must not continue.

## Catching

- Catch only what you can act on. Otherwise let it propagate.
- Never catch a broad base type, except at a top-level boundary that converts
  failures into a response and logs them.
- Never swallow an exception. An empty catch, or one that only continues, is
  prohibited. If ignoring is genuinely correct, state why in a comment — that is a
  non-obvious why, which [[code-quality]] permits.
- Never catch and rethrow without adding information: in some languages that
  discards the original stack trace, and in the rest it adds nothing.
- When wrapping, attach the original as the inner cause.
- Bound every retry. Retry only genuinely transient failures, never a validation
  failure.

## Boundaries

- Log a failure once, where it is handled, not at every level it passes
  ([[observability-standards]]).
- Convert internal failures into the caller's vocabulary. An HTTP handler returns a
  status code, not a stack trace.
- A failure response must not disclose internal structure, file paths, queries, or
  configuration.

## Checklist

- [ ] Every failure is classified expected or exceptional.
- [ ] Expected failures are returned, not thrown.
- [ ] No exception is part of the normal path.
- [ ] No catch is empty or a bare rethrow.
- [ ] Wrapped exceptions retain the original cause.
- [ ] Each failure is logged once and leaks nothing sensitive.
