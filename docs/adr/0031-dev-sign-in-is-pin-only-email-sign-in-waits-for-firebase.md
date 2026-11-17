# ADR-0031: Dev sign-in is PIN-only; email sign-in waits for Firebase Auth

<!-- nav -->
<sub><a href="../../README.md">Project README</a> · <a href="../README.md">Documentation index</a></sub>

| Status | Date |
| --- | --- |
| Accepted | 2026-11-15 |

## Decision

Every role, owner and accounts included, signs in with an employee PIN on a registered device in dev. `POST /auth/email` returns 501 until Firebase Auth is wired up. Sign-in tokens come from `AuthTokenIssuer`: `dev` signs an HS256 JWT with `AUTH_DEV_SECRET`, and `firebase` is a stub. `AUTH_ISSUER=dev` is refused in production.

## Alternatives considered

None recorded.

## Rationale

Firebase is out of scope for now (ADR-0026), and the PIN path already covers device trust, hashing, lockout and rate limits.
