---
name: secure-engineering
description: Security and privacy rules for design and implementation, including the non-negotiable priority ordering (security above simplicity, effort, and delivery speed), secret handling, and boundary validation. USE FOR any task that touches authentication, authorisation, secrets, credentials, tokens, cryptography, key handling, encoding, serialisation, user input handling, external API calls, personal data, file uploads, or configuration of environments. USE FOR any design decision where a convenient option and a safer option both exist. DO NOT USE FOR performance tuning or pure refactoring with no data-handling change.
---

<!-- GENERATED FILE. Do not edit.
     Source: standards/*.md in the agent-framework repository.
     Standards version: f897c1ed | stacks: any -->

# Secure engineering

## Priority ordering (non-negotiable)

Security and privacy rank above simplicity, ease of implementation, and delivery
speed. This is an ordering, not one factor among several.

- Never trade security or privacy for simpler code, less effort, or faster
  delivery. If the secure approach is harder to build, build it.
- Where a convenient option and a secure option both exist, choose the secure one
  and say in your response that you did.
- Surface a genuine tradeoff to the user before implementing. A genuine tradeoff is
  a real usability or capability cost; extra implementation effort is not.
- Never silently pick the weaker side.
- This applies equally to server code, client code, and protocol-level decisions
  such as encoding, key handling, and validation.

When reporting a security decision, state the option chosen, the weaker option
rejected, and the concrete risk that rejection avoids.

## Secrets

- Secrets live in environment variables or a user-secrets store.
- Never place a secret in source code, a committed file, a log, an error message, a
  test fixture, or a documentation example.
- Never commit `.env`. Confirm `.gitignore` covers it before creating one.
- Placeholders in examples must be obviously fake, such as `<api-key>`.
- If you find a committed secret, stop and report it, and state that it must be
  rotated: removing it from the working tree does not remove it from history.

## Validate at boundaries

Validate at boundaries; trust internal code. A boundary is any point where data
enters from outside the process's control:

- User input, including form fields, query strings, path segments, and headers.
- Responses from external APIs and third-party services.
- Deserialised data: JSON, XML, YAML, binary payloads.
- File contents and user-supplied file names.
- Message-queue payloads and webhook bodies.
- Environment and configuration values that vary per deployment.

Rules:

- Validate once, at the boundary, then convert to a trusted internal type. Prefer a
  type that cannot hold an invalid value over re-validating in every method.
- Reject invalid input. Never silently coerce or truncate it.
- Set an explicit size limit on any inbound payload or upload. An unbounded read is
  a denial-of-service vector.
- A failure returned to a caller must not disclose internal structure, stack
  traces, or configuration values ([[error-handling]]).

## Privacy

- Never log secrets, credentials, tokens, or personal data
  ([[observability-standards]]).
- Collect the minimum personal data the feature requires.
- Never send user data to a destination the user did not ask for.

## Checklist

- [ ] No secret in any tracked file.
- [ ] Every new boundary validates explicitly and bounds its input size.
- [ ] Every security-relevant choice is stated with its rejected alternative.
- [ ] Any unavoidable tradeoff was raised before implementation.
