---
name: observability-standards
description: Logging, diagnostics, and health-check standards - structured logging, which events to log, prohibition on logging secrets or personal data, health endpoints for services, and using existing diagnostics before writing custom debug code. USE FOR adding or reviewing logging, choosing log levels, instrumenting a feature, adding metrics or traces, adding a health check, or when tempted to add print statements or temporary debug output. DO NOT USE FOR interpreting existing telemetry during a bug hunt - see elimination-debugging.
---

<!-- GENERATED FILE. Do not edit.
     Source: standards/*.md in the agent-framework repository.
     Standards version: f897c1ed | stacks: any -->

# Observability standards

## Structured logging

Pass values as named parameters, never interpolated into the message.

```
logger.LogInformation("Order {OrderId} created for {CustomerId}", orderId, customerId);   // yes
logger.LogInformation($"Order {orderId} created");                                        // no
```

Interpolation destroys the queryable fields.

- Keep the message template constant for a given event. Do not vary the wording
  between call sites.
- Include a correlation identifier on every entry belonging to a request or
  message-handling operation.

## What to log

Log business events with the identifiers needed to trace the entity; failures,
including handled exceptions, boundary validation rejections, and failed external
calls; and the start and outcome of long-running or scheduled operations.

Do not log the success of every internal call — that is tracing, not logging. Do not
log the same failure at more than one level; log it where it is handled
([[error-handling]]).

Levels: `Error` — failed, a person may need to act. `Warning` — continued, but a
degraded path was taken. `Information` — a business event completed. `Debug` and
`Trace` — developer detail, off in production by default.

## Never log

Secrets, credentials, tokens, connection strings, API keys, or personal data
including names, email addresses, phone numbers, postal addresses, payment details,
and government identifiers. Log an identifier instead of the data it refers to.

Check exception messages and request-body dumps before logging them; both commonly
carry either category ([[secure-engineering]]).

## Health checks

Expose a liveness check reporting whether the process runs, and a readiness check
reporting whether dependencies are reachable. A health response must not disclose
connection strings, internal hostnames, or unnecessary version detail.

## Diagnose with what exists first

Before adding a print statement or temporary logger call, check whether an existing
log, metric, trace, or structured error already answers the question. If temporary
instrumentation is required, say so and remove it before reporting the task
complete. Temporary debug output must never be committed ([[git-and-commits]]).

## Checklist

- [ ] Every new log call uses a constant template with named parameters.
- [ ] No log call can emit a secret or personal data.
- [ ] Failures are logged once, where handled.
- [ ] No temporary debug output remains.
