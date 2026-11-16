# ADR-0002: Firestore top-level collections with `brandId` + `locationId` fields

| Status | Date |
| --- | --- |
| Accepted | 2026-11-15 |

## Decision

Flat top-level collections (`orders`, `payments`, `shifts`, …). Every document carries `brandId` and `locationId`. Every query filters by `brandId`, and by `locationId` where it applies.

## Alternatives considered

Nested paths (`brands/{b}/locations/{l}/orders`), like the old `artifacts/{appId}/public/data/*`.

## Rationale

Flat collections make cross-location reporting (owner view) a single query, and the composite indexes stay manageable. Security rules check `resource.data.brandId == token.brandId`.
