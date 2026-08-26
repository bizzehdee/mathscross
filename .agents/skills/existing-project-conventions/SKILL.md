---
name: existing-project-conventions
description: Precedence rules for working inside an existing repository - follow established architecture, patterns, naming, and tooling over global preferences, and obtain approval before introducing any new framework, pattern, or architectural style. USE FOR any change to a repository you did not create, before choosing a library, before adding a project or folder, before applying a personal or default convention, and when a default guideline conflicts with what the repository already does. DO NOT USE FOR greenfield work with no existing code.
---

<!-- GENERATED FILE. Do not edit.
     Source: standards/*.md in the agent-framework repository.
     Standards version: f897c1ed | stacks: any -->

# Existing project conventions

## Precedence

Existing project structure outranks every default in this framework.

Authority, highest first:

1. An explicit instruction from the user in this conversation.
2. The repository's documented conventions: `CONTRIBUTING.md`, a style guide,
   `.editorconfig`, linter configuration.
3. The patterns used in the surrounding code.
4. These standards, including [[architecture-principles]].

## Rules

- Follow the established architecture and conventions unless the user explicitly
  requests a change.
- Never introduce a new framework, library, pattern, or architectural style without
  approval ([[dependency-management]]).
- Never migrate existing code to a preferred style as a side effect of an unrelated
  change.
- Match the surrounding code's naming, formatting, error handling, comment density,
  and test structure.
- Prefer modifying existing code over rewriting working code.

## Establish these before your first change

State what you found for each:

1. Build and test commands.
2. Test framework and where tests live.
3. How code is organised: by feature, by layer, or otherwise.
4. Dependency-injection or wiring approach, if any.
5. Error-handling and validation convention at boundaries.
6. Logging approach.
7. Formatter or linter configuration and its rules.
8. The `.learnings/` entries relevant to the area you are changing. A missing
   directory means none exist yet — create it when this task produces one
   ([[learnings]]).

If a fact cannot be established from the code, ask. Do not assume.

## When a default conflicts with the repository

Name the framework default, name what the repository does, follow the repository,
and note the conflict once so the user can decide.

The exception is security. If a repository convention is insecure, raise it rather
than following it ([[secure-engineering]] is non-negotiable).
