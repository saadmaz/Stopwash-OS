# ADR-0013: Denominations

| Status | Date |
| --- | --- |
| Accepted | 2026-11-15 |

## Decision

Configurable list. Default notes 5000, 2000, 1000, 500, 100, 50, 20, plus "coins" entered as a total value (same as old). Counts are stored as `{ "500000": 2, … , coins: 12300 }` (keys in cents).

## Alternatives considered

None recorded.

## Rationale

LKR 2000 notes are legal tender; the old app could not count them.
