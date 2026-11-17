# ADR-0015: Order status flow

| Status | Date |
| --- | --- |
| Accepted | 2026-11-15 |

## Decision

`QUEUED → IN_PROGRESS → READY → COMPLETED` (COMPLETED only through checkout), plus `CANCELLED` (with reason) from any non-completed state. Managers may skip steps. Every transition is stored in `statusHistory`.

## Alternatives considered

None recorded.

## Rationale

The wall board and the attendant phone need "in bay" and "ready for pickup". Old QUEUED/COMPLETED still map directly.
