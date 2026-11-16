# ADR-0034: Manager approvals are verified outside the write transaction

| Status | Date |
| --- | --- |
| Accepted | 2026-11-15 |

## Decision

When a request carries a manager override, the PIN is checked before the business transaction starts, and the transaction receives the verified approver.

## Alternatives considered

None recorded.

## Rationale

If the PIN check ran inside a transaction that later rolled back, the failed-attempt count would roll back too, and approval PINs could be brute-forced.
