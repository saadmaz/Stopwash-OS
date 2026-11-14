# Decisions

Each entry: the decision, the alternatives considered, and why. Newest at the bottom.

---

### D-001 Monorepo with pnpm workspaces
- **Decision:** `apps/web`, `apps/api`, `packages/shared`, `packages/ui`, `firebase/` in one pnpm workspace (pnpm 9 via corepack).
- **Alternatives:** separate repos; Nx/Turborepo.
- **Why:** money rules, schemas and permissions must be identical on client and server. One repo with plain workspaces keeps that simple. Turborepo can come later if build times grow.

### D-002 Firestore top-level collections with `brandId` + `locationId` fields
- **Decision:** flat top-level collections (`orders`, `payments`, `shifts`, …). Every document carries `brandId` and `locationId`. Every query filters by `brandId`, and by `locationId` where it applies.
- **Alternatives:** nested paths (`brands/{b}/locations/{l}/orders`), like the old `artifacts/{appId}/public/data/*`.
- **Why:** flat collections make cross-location reporting (owner view) a single query, and the composite indexes stay manageable. Security rules check `resource.data.brandId == token.brandId`.

### D-003 Money as integer cents (LKR), one `Money` module
- **Decision:** every amount is a safe integer of cents. `packages/shared/src/money.ts` is the only place that parses, formats, adds, multiplies or allocates money. Display uses `Intl.NumberFormat('en-LK')`, e.g. "LKR 1,250.00".
- **Alternatives:** floats (old app), decimal.js.
- **Why:** floats caused rounding issues in split payments (`> 0.01` tolerance in the old code). Integer cents make split totals exact and comparisons exact.

### D-004 Staff sign in with their own PIN on a registered device
- **Decision:** a manager registers a tablet or phone once, which stores a device id + secret. Staff then pick their name or type their employee code, and enter a 4–6 digit PIN. The API checks the device secret and the bcrypt PIN hash, rate-limits, locks out after 5 failures for 15 minutes, and returns a Firebase custom token with claims `{role, brandId, locationIds, employeeId}`.
- **Alternatives:** shared role passcodes (old); email + password for everyone; Firebase phone auth (SMS costs, slow at the counter).
- **Why:** it's individual and auditable, and fast enough for the counter (about 3 seconds). Old passcodes 5252/6225/0706 are treated as compromised and are not used anywhere.

### D-005 Email sign-in for owner, manager, accounts
- **Decision:** Firebase email/password, with roles in custom claims set by the API (`POST /admin/users`). Managers may also hold a PIN, for on-floor overrides.
- **Why:** these roles use desktops and need recoverable accounts.

### D-006 Roles and permission map
- **Decision:** roles are `owner`, `manager`, `cashier` (counter + floor attendant), `accounts`. Permissions are strings like `order.create`, `shift.close`, `payroll.finalize`. `ROLE_PERMISSIONS` in `packages/shared/src/rbac.ts` is the single source. The API checks `can(role, perm)`, and the rules mirror it per collection.
- **Mapping from old:** EMPLOYEE (5252) → cashier, HR (6225) → manager/owner, ACCOUNTS (0706) → accounts.
- **Alternatives:** separate attendant role. An `attendant` alias can be added later; today a cashier and an attendant need the same permissions (queue + status).

### D-007 All money and state writes go through the API
- **Decision:** clients read Firestore directly (real-time). Writes to orders, payments, shifts, cash movements, payroll, stock, config and audit go through Fastify endpoints that use Firestore transactions. Rules deny client writes to those collections.
- **Exception:** the client may write its own `users/{uid}.preferences` (language, theme).

### D-008 Append-only financial records
- **Decision:** `payments`, `cashMovements`, `shiftCloses`, `shiftApprovals`, `payrollRuns`, `payrollAdjustments`, `invoices`, `invoiceSettlements` and `auditLogs` are never updated or deleted. Corrections are new documents with `reversesId` (reversal) and, where needed, a replacement entry. Rules deny update/delete on them for every client, and the API has no endpoints that update them.
- **Old behaviour replaced:** edit/delete expense, edit completed-order payment, edit session, delete session, clear all history, delete invoice, toggle invoice paid.
- **Why:** this is an explicit requirement, and it makes the accounts approval meaningful.

### D-009 Idempotency keys on every mutating API call
- **Decision:** the client generates a UUID v4 `Idempotency-Key` header per user intent (one per "Add order" press, reused on retry). The API stores `idempotency/{key}` → `{status, response, hash}` inside the same transaction as the write. A replay returns the stored response, and the same key with a different body returns 422.
- **Why:** offline retry and double taps must never create two orders or two payments.

### D-010 Offline order entry
- **Decision:** Firestore persistent cache (multi-tab) for reads. For writes, a small IndexedDB outbox in the web app keeps pending API calls (with their idempotency keys) and flushes them when online. A banner shows "Offline: n queued" / "Syncing…". Orders created offline show as "Pending sync" in the queue (optimistic). Payment while offline is allowed for CASH only, is queued the same way, and is flagged in the UI.
- **Alternatives:** client writes directly to Firestore (would break D-007); block offline.
- **Why:** this meets "survive a short network drop" without giving clients write access to money.

### D-011 WhatsApp via click-to-chat only
- **Decision:** `https://wa.me/{number}?text=…` links built from settings (`notificationNumbers`). No paid API, and no number in code.
- **Why:** keeps parity, costs nothing, and the number is configurable.

### D-012 Tailwind v4 + tokens from the website
- **Decision:** Tailwind CSS v4 (same as the website), with tokens defined as CSS variables in `packages/ui/src/tokens.css` plus a TS export for charts and PDFs. Fonts: Space Grotesk (display), Inter (UI), Noto Sans Sinhala and Noto Sans Tamil as fallbacks in the stack, all self-hosted via `@fontsource` so they work offline.
- **Why:** it's the same brand system as stopwash.lk, and the self-hosted fonts work offline in the PWA.

### D-013 Denominations
- **Decision:** configurable list. Default notes 5000, 2000, 1000, 500, 100, 50, 20, plus "coins" entered as a total value (same as old). Counts are stored as `{ "500000": 2, … , coins: 12300 }` (keys in cents).
- **Why:** LKR 2000 notes are legal tender; the old app could not count them.

### D-014 Receipt numbering
- **Decision:** server counter document per location per business day, incremented in the checkout transaction. Format `{locationCode}-{YYMMDD}-{seq:3}`, e.g. `KTB-261115-007`. Custom B2B invoices use a separate running counter seeded at 55100 (old value).
- **Why:** the old DDMM+count was computed client-side and could collide.

### D-015 Order status flow
- **Decision:** `QUEUED → IN_PROGRESS → READY → COMPLETED` (COMPLETED only through checkout), plus `CANCELLED` (with reason) from any non-completed state. Managers may skip steps. Every transition is stored in `statusHistory`.
- **Why:** the wall board and the attendant phone need "in bay" and "ready for pickup". Old QUEUED/COMPLETED still map directly.

### D-016 Shift linkage by id, not time window
- **Decision:** the API stamps `shiftId` on orders at checkout and on cash movements at creation. Only one OPEN shift per location (enforced in a transaction via `locations/{id}.openShiftId`).
- **Why:** the old time-window fallback double-counted when sessions overlapped.

### D-017 Attendance multiplier configurable, off by default
- **Decision:** `payroll.attendanceMultiplier.enabled = false` reproduces 2.5 behaviour. When enabled: PRESENT 1.0, LATE 1.0, HALF_DAY 0.5, ABSENT 0, LEAVE 0 (configurable).

### D-018 Payroll runs are snapshots
- **Decision:** draft payroll is computed on demand (API `GET /payroll/preview?period=`). "Finalize" writes an immutable `payrollRuns` doc with every line and its inputs. Salary slips render from the run. A correction is a supplementary run that references the original.

### D-019 Sri Lanka statutory contributions optional
- **Decision:** settings `payroll.statutory = { enabled: false, epfEmployeePct: 8, epfEmployerPct: 12, etfEmployerPct: 3 }`. When enabled, the employee EPF is deducted on the slip, and employer EPF/ETF are shown as employer cost.
- **Why:** the old app didn't do it. The owner can turn it on once they confirm their payroll basis with their accountant.

### D-020 Local dev on emulators in Docker
- **Decision:** the Firebase Emulator Suite runs in a Docker container (`docker compose up emulators`), because the dev machine has no JDK. CI uses the same image. The project id is `demo-stopwash` (the `demo-` prefix means the emulators never touch a real project).
- **Why:** this was Saad's choice, and it gives the same setup on every machine.

### D-021 PDFs generated client-side with jsPDF (vector text)
- **Decision:** receipts, daily revenue, reconciliation, salary slips, attendance and invoices are built with `jspdf` + `jspdf-autotable` in a lazily loaded chunk. Fonts are embedded for Sinhala/Tamil names.
- **Alternatives:** server-side PDF (Puppeteer: heavy container); html2canvas (old: blurry, large files).
- **Why:** works offline and keeps the API container small.

### D-022 Location `katubedda` (code `KTB`) as the seed location
- **Decision:** brand `stopwash`, first location `katubedda` (from the website's locations list).

### D-023 Translations
- **Decision:** English is the source. Sinhala and Tamil strings reuse the old app's translations where they exist. Everything else is translated by the developer and marked for native-speaker review (`docs/i18n-review.md`).

### D-024 Business day = calendar day in Asia/Colombo
- **Decision:** `businessDate` (YYYY-MM-DD) is computed from the server timestamp in `Asia/Colombo` and stored on orders, payments and cash movements. All "today" queries use it. Sri Lanka has no DST, so +05:30 holds all year, but the code still uses the IANA zone.

### D-025 Step-by-step delivery
- **Decision:** work ships in small steps (about 300 changed lines or fewer), one conventional commit and one push per step, with a line in `PROGRESS.md`. The commit hash for a step is filled in by the next step's commit, because a commit can't contain its own hash and history is never rewritten.

### D-026 Repository layer with in-memory adapters (supersedes the Firestore-first parts of D-007/D-020)
- **Decision:** the API talks to storage only through repository interfaces. `DATA_BACKEND=memory` (default) uses full in-memory adapters for dev and tests. `DATA_BACKEND=firestore` selects stub adapters that throw `NotImplementedError` until Saad wires up Firebase. Token issuance sits behind `AuthTokenIssuer` (dev JWT now, Firebase custom token later).
- **Why:** Saad handles Firebase himself. The domain rules (cents, idempotency, append-only, audit) are enforced in the service layer above the repositories, so they hold for both adapters.

### D-027 TypeScript 6.0
- **Decision:** pin `typescript ~6.0.3`. TS 7 (native compiler) is out, but typescript-eslint 8.x supports `<6.1`. Revisit when typescript-eslint supports 7.

### D-028 Node 22 LTS
- **Decision:** Node 22 for CI, the API runtime and `engines` (the brief said Node 20).
- **Why:** Node 20 reached end-of-life in April 2026, and current jsdom (via undici 8) no longer runs on it. CI failed on Node 20 for exactly that reason.
