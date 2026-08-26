---
name: no-hardcodes
description: Pre-commit gate that scans the staged diff for hardcoded secrets, connection strings, API keys, absolute URLs, and other environment-specific values that belong in configuration, and blocks the commit on a hit. USE FOR every commit, before it is made. USE FOR reviewing a diff for values that should be configuration, deciding whether a literal belongs in source, or responding to a blocked commit. DO NOT USE FOR naming magic numbers in business logic - see code-quality.
---

<!-- GENERATED FILE. Do not edit.
     Source: standards/*.md in the agent-framework repository.
     Standards version: f897c1ed | stacks: any -->

Read `.agents/skills/no-hardcodes/SKILL.md` in full before starting this work, then
follow it. That file is the standard; this one only points at it.
