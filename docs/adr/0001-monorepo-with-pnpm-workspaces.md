# ADR-0001: Monorepo with pnpm workspaces

| Status | Date |
| --- | --- |
| Accepted | 2026-11-15 |

## Decision

`apps/web`, `apps/api`, `packages/shared`, `packages/ui`, `firebase/` in one pnpm workspace (pnpm 9 via corepack).

## Alternatives considered

Separate repos; Nx/Turborepo.

## Rationale

Money rules, schemas and permissions must be identical on client and server. One repo with plain workspaces keeps that simple. Turborepo can come later if build times grow.
