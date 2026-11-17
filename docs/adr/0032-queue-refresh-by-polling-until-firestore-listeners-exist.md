# ADR-0032: Queue refresh by polling until Firestore listeners exist

| Status | Date |
| --- | --- |
| Accepted | 2026-11-15 |

## Decision

The queue, bay board and display refresh with TanStack Query polling (every 5 s, and on window focus) against `GET /orders`. When Firestore is wired up, swap the hook's internals for an `onSnapshot` listener. Components don't change.

## Alternatives considered

None recorded.

## Rationale

The in-memory backend has no realtime channel, and polling a small, indexed query every 5 s is cheap at one location.
