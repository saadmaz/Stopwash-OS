# ADR-0003: Money as integer cents (LKR), one `Money` module

<!-- nav -->
<sub><a href="../../README.md">Project README</a> · <a href="../README.md">Documentation index</a></sub>

| Status | Date |
| --- | --- |
| Accepted | 2026-11-15 |

## Decision

Every amount is a safe integer of cents. `packages/shared/src/money.ts` is the only place that parses, formats, adds, multiplies or allocates money. Display uses `Intl.NumberFormat('en-LK')`, e.g. "LKR 1,250.00".

## Alternatives considered

Floats (old app), decimal.js.

## Rationale

Floats caused rounding issues in split payments (`> 0.01` tolerance in the old code). Integer cents make split totals exact and comparisons exact.
