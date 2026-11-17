# ADR-0026: Repository layer with in-memory adapters (supersedes the Firestore-first parts of ADR-0007/ADR-0020)

| Status | Date |
| --- | --- |
| Accepted | 2026-11-15 |

## Decision

The API talks to storage only through repository interfaces. `DATA_BACKEND=memory` (default) uses full in-memory adapters for dev and tests. `DATA_BACKEND=firestore` selects stub adapters that throw `NotImplementedError` until the owner wires up Firebase. Token issuance sits behind `AuthTokenIssuer` (dev JWT now, Firebase custom token later).

## Alternatives considered

None recorded.

## Rationale

Firebase is configured separately by the owner. The domain rules (cents, idempotency, append-only, audit) are enforced in the service layer above the repositories, so they hold for both adapters.
