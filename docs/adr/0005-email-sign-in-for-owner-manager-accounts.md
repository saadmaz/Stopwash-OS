# ADR-0005: Email sign-in for owner, manager, accounts

| Status | Date |
| --- | --- |
| Accepted | 2026-11-15 |

## Decision

Firebase email/password, with roles in custom claims set by the API (`POST /admin/users`). Managers may also hold a PIN, for on-floor overrides.

## Alternatives considered

None recorded.

## Rationale

These roles use desktops and need recoverable accounts.
