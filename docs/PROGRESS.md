# Progress

> A fresh session starts here. Read this file, then `DECISIONS.md`, then `PARITY.md`.

## Current state
- **Done:** Phase 1 (foundation), Phase 2 (design system + app shell), Phase 3 (data layer, auth, RBAC, config), Phase 4 (orders, queue, checkout, receipts, corrections).
- **Next:** Phase 5, step 5.1 (pre-shift checklist). Until 5.2 lands, checkout needs a shift opened by the test helper or the coming shift API. The last line of the step log is always the latest step.
- **Run it locally:** `pnpm install`, then `pnpm --filter @stopwash/api dev` (in-memory data with the dev seed; credentials are logged on start) and `pnpm --filter @stopwash/web dev`. On first open, register the device (id `dev-counter`, secret `dev-counter-secret-change-me`), then pick a staff member. Dev PINs: owner 6142, manager 7391, accounts 5038, cashier 4826, attendant 3517.
- **Working mode:** small steps (about 300 lines or fewer), one commit + push per step, gated on format, lint, typecheck and tests.
- **Data backend:** in-memory repositories (`DATA_BACKEND=memory`). The Firestore adapters are stubs, and Saad wires up Firebase himself.
- **Figma:** not connected (checked 2026-11-15: no Figma MCP tools in the session). Check again at Phase F.

## Environment notes (this machine)
- Git over HTTPS needs `http.sslBackend=schannel` (set in this repo's local config).
- pnpm 9.15.4 via corepack. TypeScript 6.0 (typescript-eslint does not support 7 yet).
- Reference repos are cloned read-only in `../_ref/`.
- Do NOT start the emulators or run the firebase CLI (Saad handles Firebase).

## Step log
Each line: step · what changed · commit. A commit can't contain its own hash, so the hash is filled in by the next step's commit (D-025).

| Step | What changed | Commit |
|---|---|---|
| 0 | Discovery docs: PRD, PARITY, ARCHITECTURE, DATA_MODEL, DECISIONS | df000d1 |
| 1.1 | Workspace root config (pnpm, TS 6 strict, prettier) + `packages/shared`: money (integer cents), Asia/Colombo dates, plate/phone normalisation, RBAC map; 58 tests | 03d5434 |
| 1.2 | API skeleton: zod env (demo- project guard), AppError codes, validation helper, health route, helmet/CORS/rate limit, pino redaction; 9 tests | 822d170 |
| 1.3 | Web skeleton: React 18 + Vite 8, Vitest (jsdom, Testing Library), Playwright config + smoke spec, brand favicon | ea189d5 |
| 1.4 | firebase/ (config, deny-all baseline rules, empty indexes, rules test harness) + emulator Dockerfile/compose committed as-is; rules tests excluded from `pnpm test`, run with `pnpm test:rules` | a6a220e |
| 1.5 | Root ESLint 9 flat config (typescript-eslint, react-hooks, jsx-a11y), zero warnings; Prettier applied to code (docs and firebase/ excluded) | 6f2b56b |
| 1.6 | GitHub Actions CI: install (frozen lockfile), typecheck, lint, format check, unit tests, build; no emulator | c1a91cb |
| 2.1 | Tailwind v4 + `packages/ui` token layer: brand palette, semantic light/dark colours, type scale, radius, elevation, motion, 44px touch spacing; tokens.ts for charts/PDF; cn() | 05b1a62 |
| 2.2 | Self-hosted variable fonts (Inter, Space Grotesk, Noto Sans Sinhala, Noto Sans Tamil, JetBrains Mono) via fontsource; font stacks fall back to Sinhala/Tamil | 862790d |
| 2.3 | Button (variants, 44px+ sizes, loading, asChild), Badge (tones, dot), Input (sizes, leading/trailing), Label, Textarea, Field (a11y wiring); 6 tests | 28e1184 |
| 2.4 | Select (options-driven, Field-compatible), Checkbox, Switch, RadioGroup (labelled), SegmentedControl (never empty); 4 tests | 6f8c6b3 |
| 2.5 | Dialog (sizes, labelled, close), Sheet (right/left/bottom, sticky footer), Toaster/toast (sonner, themed), Tooltip; 3 tests | 6bf6eb9 |
| 2.6 | Table primitives, Pagination (old pager shape via tested pageItems), EmptyState (empty/error/offline/denied), Skeleton, StatCard (delta, progress); 5 tests | 86e37ee |
| 2.7 | POS parts: VehicleClassTile (radio tile, price, shortcut), AddOnStepper (bounded qty, line total), DenominationCounter (notes + coins value, live total in cents), PinPad (taps + keyboard, completes at length); 6 tests | ca9ee61 |
| 2.8 | App shell: React Router 7, role-aware sidebar + mobile sheet nav, RequirePermission (permission-denied state), theme provider (light/dark/system), offline badge, skip link, temporary dev session; 3 tests | a6d1e23 |
| 2.9 | i18next EN/SI/TA (legacy SWOMS strings carried over under `legacy.*`), language switcher, html lang, shell fully translated, key/placeholder parity test; docs/i18n-review.md | 23acc8a |
| 2.10 | /design-system route: brand + semantic swatches, type, radius, elevation, every component incl. POS parts; fix: PinPad ignores keys typed in other inputs (+1 test) | ad60bbc |
| 2.11 | Ctrl/⌘K command palette (cmdk; permitted pages, theme, language), global shortcuts Alt+N/Q/S (ignored while typing), header search button; 5 tests | b99d8db |
| 3.3 | Audit service: audit() writes inside the caller's transaction (who/what/when/before/after/reason/request/device), secrets redacted, listAudit with filters + paging; request Actor/Ctx types; time-sortable ids; 5 tests | c829217 |
| 3.5 | RBAC middleware: guard(...permissions) preHandler (bearer verify → request Ctx, shared permission map), ctxOf, assertLocation/resolveLocation; GET /me (actor + permissions); 10 tests incl. role matrix and segregation of duties | 0cd9c6f |
| 3.7 | PIN sign-in screen: device registration form, staff tiles, PinPad → /auth/pin, translated error codes (EN/SI/TA), tab-scoped session persistence, API client (bearer, idempotency header, ApiError), TanStack Query; app gated on sign-in (dev user removed); 3 tests | bc80b28 |
| 3.9 | Dev seed for the in-memory backend (dev only): Katubedda location, defaults, counter device, staff for every role with dev PINs, logged on start; smoke-tested health → PIN sign-in → /config over HTTP; 1 test | 25ff2a7 |
| 3.10 | Docs: PARITY statuses for Phase 1–3 work (32 rows), PROGRESS current state with local run instructions and dev credentials, known issues | 9bb2202 |
| 4.1 | Pricing engine in shared: priceOrder (snapshotted lines, one vehicle class, no add-on-only orders, max qty, merged duplicates, manual + loyalty discount, inclusive/exclusive tax), discountPercent, loyaltyDiscount, visitsUntilReward, summarizeLines; 11 tests | 00dceb3 |
| 4.2 | Customers & vehicles: recordVisit upserts vehicle by plate key and customer by phone (or the vehicle's last customer), fills blanks, returning flag; lookup by plate/phone/name prefix (Firestore-compatible ranges, case-insensitive names via nameKey); GET /lookup, GET /vehicles/:plate; 5 tests | ec741e1 |
| 4.3 | Create order API: idempotent() helper (stored response per actor+key in the same transaction, replay, mismatch 422), POST /orders (Idempotency-Key required, server pricing, daily ticket numbers, visit/returning, QUEUED, audited, rollback on failure, product-only allowed); 6 tests | 43bd935 |
| 4.8 | Receipts: GET /orders/:id/receipt; one receipt model for screen, 80 mm vector PDF (jsPDF, lazy chunk, brand header) and WhatsApp click-to-chat text; receipt dialog after payment and from paid orders in the queue (PDF, print-only-receipt CSS, WhatsApp); 5 tests | 7fee1ef |
| 4.10 | Docs: PARITY statuses for orders and payments (P6 now DDMM+seq per D-033), PROGRESS current state after Phase 4 | 4f34ace |
| 5.4 | Reconciliation engine in shared: cash/card/other sales from payments (refunds net), expenses/deposits from cash movements (reversals net), expected = opening + cash sales − expenses − deposits, variance label, explanation > LKR 500 and override > LKR 2,000 (strict, as SWOMS); 12 tests | 583932f |
| 5.6 | Reconciliation report: GET /shifts/:id/report (summary, close records, cash entries, business, denominations); A4 PDF with the SWOMS sections (header, period, summary, expense and deposit tables, variance analysis, notes, handover, opening/closing denominations, internal-document footer); download from the closed-shift panel; 3 tests | c650e6d |
| 5.7a | Accounts EOD API: GET /approvals (pending/approved/all, location-scoped, KPIs over pending: count, expected, counted, expenses, net variance), POST /shifts/:id/decision (accounts/owner approve or query with note; append-only approvals; shift status follows); 3 tests | (next) |
| 5.5b | Close shift UI: End shift sheet with system totals, open-orders warning, closing count, live colour-coded variance (matched/shortage/overage), explanation/override gates from settings, incoming supervisor (not yourself) + PIN, closed panel with variance WhatsApp links and sign out, EN/SI/TA; 1 test | 8e49070 |
| 5.5a | Close shift API: GET /shifts/:id/summary (shared reconcile, vehicles, open orders), POST /shifts/:id/close (denomination count, explanation > LKR 500, manager override > LKR 2,000, handover PIN by someone else, append-only close record, shift CLOSED, location freed, VARIANCE alert + WhatsApp links, audit); D-035; 5 tests | 8f62a6e |
| 5.3b | Cash-out screen (/cash): expense/deposit form (category by type, rupee amount, paid to / deposited by, description), manager approver + PIN above threshold, this shift's entries, manager reverse dialog with reason, no-shift state, EN/SI/TA; 3 tests | bd1a51f |
| 5.3a | Cash-out API: POST /cash-movements (expense/deposit on the open shift, category must match type, manager PIN above the configured amount, approver stored), POST /cash-movements/:id/reverse (manager, negative entry, once), GET /cash-movements (current shift); append-only, audited; 4 tests | 4bf87b7 |
| 5.2b | Shift screen (/shift): open wizard (pre-shift checklist → alerts with WhatsApp links → opening count with live clock, supervisor picker, denomination counter, carry-over notes); managers may skip the check; open-shift summary with Request stock sheet; shared device-staff hook (approver picker reuses it); EN/SI/TA; 1 test | 5d29cf2 |
| 5.2a | Open shift API: POST /shifts (one open shift per location, enforced in the same tx that sets openShiftId; supervisor must be allowed; optional pre-shift checklist link; opening float from denomination count), GET /shifts/current; shared denominationTotal used by UI and API (rejects unknown notes); staff tiles carry canOpenShift; 6 tests | 154481d |
| 5.1b | Checklist form (pre-shift and stock request): configurable items as OK/fault toggles with localized labels, All good, notes, alert summary with one WhatsApp click-to-chat button per number, EN/SI/TA; 3 tests | 9e7771b |
| 5.1a | Pre-shift checklist API: POST /checklists (pre-shift needs every active item; request needs a low item), append-only record, LOW_STOCK / EQUIPMENT_FAULT alerts for every faulty item (fixes the old mitts/power bug), wa.me messages in the SWOMS wording to configured numbers, GET /stock-status for the banner; shared alert message builders; 4 tests | ff5fef2 |
| 4.9b | Queue corrections UI: edit dialog for unpaid orders (plate/customer + required reason), manager refund dialog for paid orders (reason, reversal amount), EN/SI/TA; 2 tests | 9ebfb77 |
| 4.9a | Order corrections API: PATCH /orders/:id edits unpaid orders (plate moves the visit, re-priced lines, reason required, audited before/after); POST /orders/:id/refund (manager) appends negative reversing payments in the open shift, voids the sale, adjusts vehicle/customer totals, blocks double refunds; 4 tests | 047f5c0 |
| 4.7b | Payment screen: checkout sheet from the queue with server quote (loyalty/discount/tax), cash with change due, card, split (card = remainder), discount with reason, manager approver + PIN when above threshold, stable idempotency key, receipt-number toast, EN/SI/TA; 2 tests | f13fd5e |
| 4.7a | Quote API for the payment screen: quoteOrder shared by checkout and GET /orders/:id/quote (loyalty, discount, tax, needs-approval flag), GET /orders/:id, staff tiles include role (approver picker); 1 test | a6a7281 |
| 4.6b | Checkout API: POST /orders/:id/checkout (idempotent) needs an open shift, re-prices from the order snapshot, loyalty reward, manual discount (reason; manager PIN above threshold, verified outside the tx), tenders must equal total (cash/card/split), append-only payments, DDMM+seq receipt number, vehicle/customer totals, audit; D-033/D-034; 7 tests | 98eccea |
| 4.6a | Manager override service: one-action step-up (approver active at the location, role holds the permission, own PIN with lockout), no remembered elevation; reused by discounts, variance, cash-out and handover; 5 tests | 0442065 |
| 4.5b | Queue screen (/queue): ticket/time, plate, status + returning badges, services summary, total; next-step button (Start/Ready), manager-only cancel with reason, search ('/' shortcut), Open/Paid/All filter, daily target bar, pagination, 5 s polling (D-032), loading/empty/error states, EN/SI/TA; 3 tests | 6709217 |
| 4.5a | Queue API: order status state machine in shared (skip forward, undo one step, checkout-only completion, cancel before completion), queueSort; GET /orders (business day + older open orders, search plate/name/phone/#ticket, pagination, daily target), POST /orders/:id/status (idempotent, audited, cancel = manager + reason); 9 tests | 8b4b3a9 |
| 4.4b | New order screen (/pos): xl plate field + lookup, vehicle class tiles (keys 1–9), add-on/product steppers, live summary priced by the shared engine (same as server), pricing hints, Ctrl+Enter submit, idempotency key kept until success, ticket toast, reset + refocus; 3 tests | c438307 |
| 4.4a | Order form customer fields: plate/phone/name comboboxes with debounced /lookup suggestions (keyboard + touch, ARIA listbox), SWOMS autofill rules as a tested reducer, returning-customer badge, EN/SI/TA; 6 tests | 413c40f |
| 3.8c | Settings screen (part 3): cash category editor (expense/deposit, next E/D code, active toggle) and pre-shift checklist editor (stock/equipment), EN/SI/TA; 1 test | 3406b78 |
| 3.8b | Settings screen (part 2): Services & prices tab, catalog table grouped by kind, add/edit dialog (names EN/SI/TA, price in rupees → cents, max qty, active toggle; code/kind locked after creation); 2 tests | dfdc132 |
| 3.8a | Settings screen (part 1): Tabs component, useConfig/useSaveSettings, General form (daily target, variance 500/2000 thresholds, cash-out approval, discount override, receipt footer, WhatsApp numbers normalised to +94) with RHF + Zod, rupees in / cents out, EN/SI/TA; 2 tests | cae54e6 |
| 3.6b.1 | Fix lint error that slipped into 3.6b (type-only import); the step commit script now refuses to commit unless format, lint, typecheck and tests pass | 31881b0 |
| 3.6b | Admin config API: POST/PATCH /catalog, /cash-categories, /checklist-items (audited, codes immutable, no deletes), PUT /settings (validated thresholds; tax/payroll owner-only); 7 tests | f25921b |
| 3.6a | Config defaults (SWOMS prices for 4 classes, 2 add-ons, 3 products; 5 stock + 4 equipment checks; E001–E007 / D001–D003; settings 15 / 500 / 2000), idempotent ensureDefaults, GET /config (location-checked); 4 tests | 87a22fd |
| 3.4b | Sign-in routes: POST /auth/device/staff (PIN-pad staff list), POST /auth/pin (device secret + PIN → token, audited, 10/min per device+IP), POST /auth/email stub (501); AUTH_ISSUER/AUTH_DEV_SECRET env; reusable test fixtures; 7 tests | bb6afb6 |
| 3.4a | PIN service: bcrypt hashing, weak-PIN policy (old passcodes banned), verify with failure count + timed lockout, constant-time unknown-employee path; AuthTokenIssuer with DevJwtIssuer (HS256, jose) and FirebaseTokenIssuer stub; 16 tests | 81a0aad |
| 3.2b | Firestore DataStore stub (every repo + transaction + counters throw NotImplementedError 'wire up when Firebase is configured'), DATA_BACKEND=memory|firestore switch, store decorated on Fastify, 501 NOT_IMPLEMENTED mapping, health shows backend; 3 tests | 7df062c |
| 3.2a | Repository layer: typed query model, ReadRepo/AppendOnlyRepo/MutableRepo, named repos for every collection, DataStore with transactions; in-memory adapter (copies on read/write, brand-scoped queries enforced, append-only enforced, serialised transactions with rollback, counters); 10 tests | d0f3764 |
| 3.1c | Zod schemas (part 3): users, employees (SW001 codes, exempt months), PINs, attendance, leave (end ≥ start), incentive rules/tiers, payroll adjustments (append-only), payslip lines, payroll runs, B2B invoices, audit entries; 5 tests | 0a1107e |
| 3.1b | Zod schemas (part 2): orders (snapshotted lines, status flow), CreateOrderInput, payments (append-only, negative = reversal), tenders, CheckoutInput (override PIN), shifts, denomination counts, checklists, cash movements, shift closes/approvals, alerts; 6 tests | cd9382c |
| 3.1a | Zod schemas (part 1): common fields (cents, ISO timestamps, date keys, localized text, base record), catalog items, checklist items, cash categories, location Settings + SWOMS-parity defaults (target 15, variance 500/2000), customers, vehicles; 6 tests | f151f4c |
| 1.6a | CI and runtime on Node 22 LTS (Node 20 is EOL; jsdom/undici 8 failed on it) | 6c34e8a |

## Findings from Phase 0 (old-app bugs fixed by design)
- Mitts and Power/Water faults never triggered the WhatsApp alert (status string mismatch).
- Cash-out manager approval was collected but saved as "N/A".
- The Accounts "expenses" KPI read a field that doesn't exist, so it was always 0.
- Payroll daily counts used the UTC date, so orders after 18:30 SL time landed on the next day.
- The YEARLY sales tab had no date window.
- Receipt numbers were computed client-side and could collide.
- The variance > LKR 2,000 supervisor override exists in the code but not in the old README.

## Needs Saad
- **Firebase (all of it).** Firestore adapters for every repository (`apps/api/src/repos/firestore/*`, currently stubs that throw), Firebase Auth custom-token issuer (stub), `firestore.rules` / `storage.rules` beyond the deny-all baseline, `firestore.indexes.json` (indexes listed in `DATA_MODEL.md`), rules unit tests (`pnpm test:rules`, needs the emulator), the real project config and deploy.
- **Figma:** the Figma MCP is not connected in this session. Expected account: w2053223@westminster.ac.uk (student team).
- **Rotate the old secrets.** The old Firebase config (`stopwash-dashboard-001`), passcodes 5252/6225/0706 and WhatsApp number 94767885404 are public in `Stopwash-POS-HTML`.
- Native-speaker review of the Sinhala/Tamil strings.
- Real logo files and photography (the website itself still uses a text wordmark and placeholder images).

## Known issues
- The web app ships as one large chunk (Vite warns about chunk size). Route-level code splitting is planned for the Phase 9 performance step.
- Without `AUTH_DEV_SECRET`, the API picks a random signing secret at start, so a restart signs everyone out (a warning is logged).
