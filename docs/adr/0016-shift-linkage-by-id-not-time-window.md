# ADR-0016: Shift linkage by id, not time window

<!-- nav -->
<sub><a href="../../README.md">Project README</a> · <a href="../README.md">Documentation index</a></sub>

| Status | Date |
| --- | --- |
| Accepted | 2026-11-15 |

## Decision

The API stamps `shiftId` on orders at checkout and on cash movements at creation. Only one OPEN shift per location (enforced in a transaction via `locations/{id}.openShiftId`).

## Alternatives considered

None recorded.

## Rationale

The old time-window fallback double-counted when sessions overlapped.
