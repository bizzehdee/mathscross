---
name: error-handling
description: How to signal and handle failure - expected failures are returned as values, exceptions are reserved for genuinely exceptional conditions, and are never used for control flow or silently swallowed. USE FOR designing a function's failure signature, deciding whether to return an error or throw, writing a catch block, handling a failed external call, mapping errors at a boundary, or reviewing error paths. DO NOT USE FOR deciding what to log - see observability-standards.
---

<!-- GENERATED FILE. Do not edit.
     Source: standards/*.md in the agent-framework repository.
     Standards version: f897c1ed | stacks: any -->

Read `.agents/skills/error-handling/SKILL.md` in full before starting this work, then
follow it. That file is the standard; this one only points at it.
