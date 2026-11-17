# ADR-0028: Node 22 LTS

| Status | Date |
| --- | --- |
| Accepted | 2026-11-15 |

## Decision

Node 22 for CI, the API runtime and `engines` (the brief said Node 20).

## Alternatives considered

None recorded.

## Rationale

Node 20 reached end-of-life in April 2026, and current jsdom (via undici 8) no longer runs on it. CI failed on Node 20 for exactly that reason.
