# ADR-0006: Roles and permission map

<!-- nav -->
<sub><a href="../../README.md">Project README</a> · <a href="../README.md">Documentation index</a></sub>

| Status | Date |
| --- | --- |
| Accepted | 2026-11-15 |

## Decision

Roles are `owner`, `manager`, `cashier` (counter + floor attendant), `accounts`. Permissions are strings like `order.create`, `shift.close`, `payroll.finalize`. `ROLE_PERMISSIONS` in `packages/shared/src/rbac.ts` is the single source. The API checks `can(role, perm)`, and the rules mirror it per collection.

## Alternatives considered

Separate attendant role. An `attendant` alias can be added later; today a cashier and an attendant need the same permissions (queue + status).

## Rationale

Not recorded.

## Notes

- **Mapping from old:** EMPLOYEE → cashier, HR → manager/owner, ACCOUNTS → accounts.
