# Architecture

## System context

```mermaid
flowchart LR
  subgraph Devices
    T[Counter tablet<br/>PWA]
    P[Attendant phone<br/>PWA]
    D[Back-office desktop<br/>PWA]
    W[Wall TV board]
    CD[Customer display]
  end
  subgraph Firebase
    AUTH[Firebase Auth]
    FS[(Firestore)]
    ST[(Storage)]
  end
  API[apps/api<br/>Fastify + Admin SDK<br/>container]
  WA[wa.me click-to-chat]

  T & P & D & W & CD -- realtime reads<br/>security rules --> FS
  T & P & D -- REST writes<br/>ID token + Idempotency-Key --> API
  API -- transactions --> FS
  API -- custom tokens / claims --> AUTH
  T & P & D -- sign in --> AUTH
  D -- logo upload (signed) --> ST
  T -. opens link .-> WA
```

## Monorepo

```mermaid
flowchart TB
  shared[packages/shared<br/>zod schemas · money · dates · rbac · pricing · reconciliation · payroll]
  ui[packages/ui<br/>tokens.css · tokens.ts · components]
  web[apps/web<br/>React 18 · Vite · Tailwind v4 · Radix · TanStack Query/Table · RHF · i18next · Recharts]
  api[apps/api<br/>Fastify 5 · firebase-admin · pino]
  fb[firebase/<br/>firestore.rules · indexes · storage.rules · emulator config]
  web --> shared
  web --> ui
  api --> shared
  fb -. rules tests use .-> shared
```

`packages/shared` is pure TypeScript with no Firebase import, so the same functions run in the browser, in Node and in tests.

## Write path (example: checkout)

```mermaid
sequenceDiagram
  participant UI as Web (checkout sheet)
  participant OB as Outbox (IndexedDB)
  participant API as API /orders/:id/checkout
  participant FS as Firestore
  UI->>OB: enqueue {key: uuid, body}
  OB->>API: POST + Bearer ID token + Idempotency-Key
  API->>API: verify token, can(role,'order.checkout'), zod parse
  API->>FS: runTransaction
  FS-->>API: idempotency/{key}? (replay → stored response)
  API->>FS: read order, location.openShiftId, settings, counters
  API->>API: priceOrder(lines) server-side, validate tenders = total
  API->>FS: write payments[], order(status COMPLETED, number), counter++, dailyStats++, vehicles/customers, auditLogs, idempotency/{key}
  API-->>OB: 200 {order, receipt}
  OB-->>UI: resolve, toast "Paid"
  FS-->>UI: onSnapshot updates queue
```

Rules for the API:
1. Each route declares `permission`, `body` (zod), `idempotent: true|false`.
2. The handler runs in one `db.runTransaction`. All reads come before writes (a Firestore requirement).
3. `audit(tx, {...})` is called inside the same transaction.
4. Money is computed only with `@stopwash/shared/money`.
5. Errors are mapped to `{ error: { code, message, details } }` with HTTP status. Codes are stable strings (`SHIFT_NOT_OPEN`, `VARIANCE_EXPLANATION_REQUIRED`, …) and are translated on the client.

## Read path
- Web uses Firestore `onSnapshot` through small hooks (`useLiveQuery`) that always add `where('brandId','==',claims.brandId)`.
- TanStack Query caches API GETs (previews, lookups, reports).
- Persistent local cache: `initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })`.

## Auth

```mermaid
sequenceDiagram
  participant Dev as Registered device
  participant API
  participant Auth as Firebase Auth
  Dev->>API: POST /auth/pin {deviceId, deviceSecret, employeeId, pin}
  API->>API: rate limit (ip+device+employee), check lockout
  API->>API: bcrypt.compare(pin, employeeSecrets.pinHash)
  API->>Auth: createCustomToken(uid, {role, brandId, locationIds, employeeId, deviceId})
  API-->>Dev: {token}
  Dev->>Auth: signInWithCustomToken
```

Email users sign in with Firebase email/password, and custom claims are set by the API admin endpoint. Every API request carries the Firebase ID token, which the API verifies with `verifyIdToken(token, true)` (revocation check).

Manager override (variance > override threshold, big discount, cash-out approval, handover): the client sends `{overrideEmployeeId, overridePin}` with the request. The API verifies it in the same request, so no long-lived elevated session exists.

## Offline
- Reads: Firestore persistent cache. The queue and catalog keep working offline.
- Writes: `apps/web/src/lib/outbox.ts` holds pending requests in IndexedDB keyed by idempotency key, retries with backoff when `navigator.onLine` and on `online` events, and shows a global banner. Orders created offline appear in the queue with a "pending sync" badge (merged from the outbox).
- A service worker (vite-plugin-pwa, Workbox) precaches the app shell and fonts.

## Environments
| Env | Firebase | API |
|---|---|---|
| dev | Emulator Suite in Docker, project `demo-stopwash` | `pnpm --filter api dev` on :8080 |
| test/CI | Emulators (Docker) | in-process Fastify `inject()` |
| prod | real project (to be created) | container (Cloud Run suggested) |

## Security layers
1. Firestore rules: brand/location scoping, role checks, append-only collections, field-level checks on the few client writes.
2. API: token verification, RBAC, zod validation, rate limiting (`@fastify/rate-limit`), helmet headers, CORS allow-list, request size limits, idempotency.
3. Secrets: only through env (`.env`, never committed). The service account is used in prod only; emulators need none.

## Conventions

- Money is integer LKR cents. Times are stored in UTC, and business days are Asia/Colombo dates.
- Every record carries `brandId` and `locationId`. Writes take an `Idempotency-Key`.
- Financial records are append-only. Corrections are reversing entries, and every change is audit-logged.
- One conventional commit per change. Never commit `.env` files or keys.
