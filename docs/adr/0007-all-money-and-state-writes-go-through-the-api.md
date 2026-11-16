# ADR-0007: All money and state writes go through the API

| Status | Date |
| --- | --- |
| Accepted | 2026-11-15 |

## Decision

Clients read Firestore directly (real-time). Writes to orders, payments, shifts, cash movements, payroll, stock, config and audit go through Fastify endpoints that use Firestore transactions. Rules deny client writes to those collections.

## Alternatives considered

None recorded.

## Rationale

Not recorded.

## Notes

- **Exception:** the client may write its own `users/{uid}.preferences` (language, theme).
