---
name: performance-discipline
description: Rules for when and how to optimise - correctness before performance, measure before optimising, and the specific defects worth avoiding by default (N+1 queries, loading unnecessary data, buffering large payloads, poor algorithmic complexity on collections). USE FOR responding to a slowness report, reviewing code for efficiency, writing a database query or a loop over a large collection, handling file or streamed payloads, or when asked to make something faster. DO NOT USE FOR diagnosing a specific measured regression - use elimination-debugging to find the cause first.
---

<!-- GENERATED FILE. Do not edit.
     Source: standards/*.md in the agent-framework repository.
     Standards version: f897c1ed | stacks: any -->

# Performance discipline

## Order of work

Make it correct, measure it, then optimise the measured bottleneck.

- Do not optimise early. Prefer correctness first.
- You must measure before optimising, and state what was measured, by what method,
  and the number observed.
- "This will be faster" without a measurement is not a justification. If you cannot
  measure, say so and label the change unverified.
- Measure again afterwards and report before and after.
- Never trade readability for an unmeasured gain.

## Defects to avoid by default

These are not premature optimisations. They are defects. Avoid them when first
writing the code.

**N+1 queries.** Never issue a query inside a loop over another query's results.
Load related data in one query, or batch the loads. When reviewing data access,
count the queries one request issues.

**Loading unnecessary data.** Select only the columns used. Filter and paginate in
the database, not in memory. Never materialise a collection to compute a count or
check existence.

**Buffering large payloads.** Prefer streaming. Never read an entire file or
response into memory when it can be processed incrementally. Set an explicit size
limit on any inbound payload — an unbounded read is also a security issue
([[secure-engineering]]).

**Algorithmic complexity.** Never write a nested loop over two collections that both
grow with data volume; use a lookup structure. State the complexity when it is not
obvious from the code, as a non-obvious why ([[code-quality]]).

## Reporting a performance change

State the measurement before, the change made, the measurement after, and the method
used, so the result can be reproduced.
