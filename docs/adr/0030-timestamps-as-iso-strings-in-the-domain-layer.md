# ADR-0030: Timestamps as ISO strings in the domain layer

<!-- nav -->
<sub><a href="../../README.md">Project README</a> · <a href="../README.md">Documentation index</a></sub>

| Status | Date |
| --- | --- |
| Accepted | 2026-11-15 |

## Decision

Domain records and API payloads carry timestamps as ISO-8601 UTC strings (`Timestamp` schema). The Firestore adapter converts them to and from native `Timestamp` at the boundary. Business days are always `DateKey` strings computed in Asia/Colombo.

## Alternatives considered

None recorded.

## Rationale

The same objects serialise as JSON for the API and the in-memory store without conversion code everywhere.
