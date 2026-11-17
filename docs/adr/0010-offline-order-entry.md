# ADR-0010: Offline order entry

| Status | Date |
| --- | --- |
| Accepted | 2026-11-15 |

## Decision

Firestore persistent cache (multi-tab) for reads. For writes, a small IndexedDB outbox in the web app keeps pending API calls (with their idempotency keys) and flushes them when online. A banner shows "Offline: n queued" / "Syncing…". Orders created offline show as "Pending sync" in the queue (optimistic). Payment while offline is allowed for CASH only, is queued the same way, and is flagged in the UI.

## Alternatives considered

Client writes directly to Firestore (would break ADR-0007); block offline.

## Rationale

This meets "survive a short network drop" without giving clients write access to money.
