# ADR-0009: Idempotency keys on every mutating API call

| Status | Date |
| --- | --- |
| Accepted | 2026-11-15 |

## Decision

The client generates a UUID v4 `Idempotency-Key` header per user intent (one per "Add order" press, reused on retry). The API stores `idempotency/{key}` → `{status, response, hash}` inside the same transaction as the write. A replay returns the stored response, and the same key with a different body returns 422.

## Alternatives considered

None recorded.

## Rationale

Offline retry and double taps must never create two orders or two payments.
