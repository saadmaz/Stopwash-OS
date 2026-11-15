# Stopwash POS

Point-of-sale and operations system for the STOPWASH car wash in Katubedda, Sri Lanka. It covers counter orders, the live queue, checkout, shifts and cash reconciliation, approvals, staff, attendance, leave and payroll, reports, the owner dashboard, B2B invoices, the TV board, the customer display and loyalty. It runs in English, Sinhala and Tamil.

Status and next steps: [docs/PROGRESS.md](docs/PROGRESS.md), including the **Needs Saad** list.

## Layout

| Path | What it is |
| --- | --- |
| `apps/web` | React 18 + Vite PWA (counter tablets, back office, `/tv`, `/display`) |
| `apps/api` | Fastify API. All pricing, money and permission checks happen here. |
| `packages/shared` | Types, zod schemas, money (integer LKR cents), dates (Asia/Colombo), RBAC, pricing, payroll |
| `packages/ui` | Design tokens and accessible components (Radix + Tailwind v4) |
| `firebase/` | Firestore/Storage rules and emulator config, waiting for the Firebase setup |
| `docs/` | PRD, SWOMS parity, architecture, data model, decisions, progress |

## Run it locally

You need Node 22 and pnpm 9 (`corepack enable` picks up the pinned version).

```sh
pnpm install
pnpm --filter @stopwash/api dev     # http://localhost:8080 (in-memory data + dev seed)
pnpm --filter @stopwash/web dev     # http://localhost:5173
```

The API reads `apps/api/.env` if it exists (copy `.env.example` and set your own `AUTH_DEV_SECRET`). Without it, the defaults run in memory with the dev seed. Data resets on every restart.

The first time you open the app:

1. Register the device: id `dev-counter`, secret `dev-counter-secret-change-me`.
2. Pick a staff member and enter their PIN.

| Dev user | Role | PIN |
| --- | --- | --- |
| Saman Jayasuriya | owner | 6142 |
| Dilani Fernando | manager | 7391 |
| Ruwan Silva | accounts | 5038 |
| Kasun Perera | cashier (supervisor) | 4826 |
| Tharindu Bandara | cashier | 3517 |

These PINs exist only in the in-memory dev seed. Production refuses to start with `DEV_SEED` on.

Extra screens: `/tv` is the wall queue board and `/display` is the customer-facing second screen. Both open from links on the Queue and New Order screens.

## Checks

```sh
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test          # unit and API tests (no emulator needed)
pnpm e2e           # Playwright: full shift day; starts the API and web itself
pnpm build
```

The first time you run `pnpm e2e`, install the browser with `pnpm --filter @stopwash/web exec playwright install chromium`.

`pnpm test:rules` runs the Firestore rules tests. It needs the Firebase emulator, so it is kept out of `pnpm test` and CI until Firebase is set up.

## Configuration

| Variable | Where | Purpose |
| --- | --- | --- |
| `DATA_BACKEND` | api | `memory` (default) or `firestore` (adapter is a stub until Firebase is wired) |
| `AUTH_ISSUER` | api | `dev` (signed JWT, development only) or `firebase` |
| `AUTH_DEV_SECRET` | api | 32+ random characters for dev tokens |
| `DEV_SEED` | api | load demo staff/catalog in memory (refused in production) |
| `CORS_ORIGINS` | api | comma-separated web origins |
| `PIN_MAX_ATTEMPTS`, `PIN_LOCKOUT_MINUTES` | api | PIN lockout policy |
| `VITE_API_URL` | web | API base URL (`apps/web/.env.local`) |

Business settings (prices, thresholds, receipt footer, business profile, loyalty, payroll rules, WhatsApp alert numbers) live in the app under **Settings**, not in env files.

## Conventions

- Money is integer LKR cents. Times are stored in UTC, and business days are Asia/Colombo dates.
- Every record carries `brandId` and `locationId`. Writes take an `Idempotency-Key`.
- Financial records are append-only. Corrections are reversing entries, and every change is audit-logged.
- One conventional commit per change. Never commit `.env` files or keys.

## Docs

- [Product requirements](docs/PRD.md)
- [Parity with SWOMS 2.5](docs/PARITY.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Data model](docs/DATA_MODEL.md)
- [Decisions](docs/DECISIONS.md)
- [Translation review notes](docs/i18n-review.md)
