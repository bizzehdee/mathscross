---
name: no-hardcodes
description: Pre-commit gate that scans the staged diff for hardcoded secrets, connection strings, API keys, absolute URLs, and other environment-specific values that belong in configuration, and blocks the commit on a hit. USE FOR every commit, before it is made. USE FOR reviewing a diff for values that should be configuration, deciding whether a literal belongs in source, or responding to a blocked commit. DO NOT USE FOR naming magic numbers in business logic - see code-quality.
---

<!-- GENERATED FILE. Do not edit.
     Source: standards/*.md in the agent-framework repository.
     Standards version: f897c1ed | stacks: any -->

# No hardcodes

Fires before a commit. Keeps secrets and environment-specific values out of the
repository, where they would be a security risk and a portability bug.

## The gate

1. Scan the staged diff, added and modified lines only.
2. On a hit, **block the commit**. Report every finding, then stop. Do not commit.
3. With no hit, allow the commit to proceed.

You must not bypass the gate. `--no-verify` is prohibited ([[git-and-commits]]).
Only the user may waive a finding, and only after you have stated the risk.

## Block on

| Category | Examples |
|---|---|
| Credentials and secrets | Password, API key, bearer or SAS token, private key, certificate private material |
| Connection strings | Database, cache, message broker, object storage |
| Environment-specific URLs | `https://api.acme-prod.internal`, a tenant-specific endpoint, a signed URL |
| Machine or OS specific paths | `C:\Users\<name>\...`, `/home/<name>/...`, a drive letter, a hardcoded path separator |
| Environment-specific identifiers | Subscription, tenant, account or bucket name, hostname, port |

## Do not block on

Blocking these would make the gate unusable:

- Obviously fake placeholders: `<api-key>`, `example.com`, `changeme`, `xxxxx`.
- Public URLs that do not vary by environment: specifications, documentation links,
  licence URLs, XML namespaces and schema URIs.
- Package registry URLs in a manifest or lockfile ([[dependency-management]]).
- `localhost` or `127.0.0.1` in a file whose documented purpose is local
  development.
- Test fixtures using clearly fake values ([[testing-standards]]).
- A configuration template carrying non-secret defaults.

A value is environment-specific when moving the code to another environment would
require changing it. That is the test to apply when a case is not listed above.

## Reporting a hit

One line per finding:

```text
<file>:<line>  <category>  <redacted value>  -> move to <destination>
```

Redact the value to at most its first four characters. Never echo a secret in full,
into your response or into a log ([[observability-standards]]).

## Remedy

- A secret goes in an environment variable or a secret store, never in a committed
  file ([[secure-engineering]]).
- An environment-specific non-secret goes in configuration, resolved per
  environment.
- Replace the literal with a named setting. The name belongs in source; the value
  does not.
- Follow the repository's existing configuration mechanism
  ([[existing-project-conventions]]). Do not introduce a new one to fix one value.
- If the value already exists in committed history, say so and state that it must be
  rotated. Removing it from the working tree does not remove it from history.

## Checklist

- [ ] The staged diff was scanned, including added lines.
- [ ] Every finding reports file, line, category and destination.
- [ ] No secret was echoed in full.
- [ ] No commit was made while a finding was open.
- [ ] Any secret already in history was flagged for rotation.
