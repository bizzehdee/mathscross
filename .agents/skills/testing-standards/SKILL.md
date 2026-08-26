---
name: testing-standards
description: Test coverage targets, definition-of-done rules, and test design standards including behaviour-over-implementation testing, integration-test preference, mocking limits, and mandatory regression tests for bugs. USE FOR writing, reviewing, or planning tests. USE FOR deciding whether a task is complete. USE FOR judging whether existing test coverage is adequate. USE FOR deciding what to test after fixing a bug. DO NOT USE FOR choosing a test framework in an existing repo - follow the repo's framework per existing-project-conventions.
---

<!-- GENERATED FILE. Do not edit.
     Source: standards/*.md in the agent-framework repository.
     Standards version: f897c1ed | stacks: any -->

# Testing standards

## Coverage

**90% branch coverage is a floor, not a target**, excluding EF Core migrations,
generated code, and composition-root wiring such as `Program.cs` or `Startup.cs`
and its equivalents.

Coverage is a floor for finding untested branches, not a goal. Never add
assertion-free tests to raise the number. If the floor cannot be met, state which
branches are uncovered and why.

## Definition of done

- Tests must pass before a task is done.
- Never mark a checkbox or report completion until you have run the tests and
  observed them pass. "Should pass" is not a result.
- If tests fail and you cannot fix them, say so, include the failure output, and
  leave the task open.

## What to test

- Assert an observable outcome: a return value, a persisted state change, an emitted
  event.
- Never assert that a specific private method was called, unless the call itself is
  the contract.
- A behaviour-preserving refactor must not require test changes. If it does, the
  tests were coupled to implementation.

Prefer, in order: integration tests for business workflows, exercising real
collaborators; unit tests for logic with many branches or edge cases; end-to-end
tests only for critical paths, because they are slow and brittle.

## Mocking

Mock only what you cannot control: network calls, wall-clock time, randomness, the
filesystem where relevant, third-party services.

- Never mock the type under test.
- Never mock a type you own when a real instance is cheap to construct.
- A test whose setup is mostly mock configuration is testing the mocks. Rewrite it
  as an integration test.

## Regression tests

Every bug requires a regression test. Write it first, confirm it fails for the
reported reason, fix the defect, then confirm it passes. A broad test that passes
with the bug present is not a regression test.

## Determinism

Tests must be deterministic and repeatable. No dependence on wall-clock time, date,
or timezone — inject a time source. No unseeded randomness. No dependence on
execution order, shared mutable state, or network availability. A test that fails
intermittently must be fixed or removed, never retried.

## Checklist

- [ ] The full test command was run and its output observed.
- [ ] All tests pass.
- [ ] Each new test asserts an observable outcome.
- [ ] Each fixed bug has a test that fails without the fix.
