# Architecture decision records

<!-- nav -->
<sub><a href="../../README.md">Project README</a> · <a href="../README.md">Documentation index</a></sub>

An architecture decision record (ADR) captures one significant technical decision: what was decided, what else was considered, and why. ADRs are never edited after acceptance; a later ADR supersedes an earlier one instead.

## Writing a new ADR

1. Copy [TEMPLATE.md](TEMPLATE.md) to `NNNN-short-title.md`, using the next free number.
2. Fill it in and set the status to `Proposed`.
3. Open it in a pull request with the change it describes. It becomes `Accepted` when merged.
4. If it replaces an earlier decision, set the earlier ADR's status to `Superseded by ADR-NNNN`.

## Index

| ADR | Decision | Status |
| --- | --- | --- |
| [0001](0001-monorepo-with-pnpm-workspaces.md) | Monorepo with pnpm workspaces | Accepted |
| [0002](0002-firestore-top-level-collections-with-brandid-locationid.md) | Firestore top-level collections with `brandId` + `locationId` fields | Accepted |
| [0003](0003-money-as-integer-cents-one-money-module.md) | Money as integer cents (LKR), one `Money` module | Accepted |
| [0004](0004-staff-sign-in-with-their-own-pin-on-a-registered-device.md) | Staff sign in with their own PIN on a registered device | Accepted |
| [0005](0005-email-sign-in-for-owner-manager-accounts.md) | Email sign-in for owner, manager, accounts | Accepted |
| [0006](0006-roles-and-permission-map.md) | Roles and permission map | Accepted |
| [0007](0007-all-money-and-state-writes-go-through-the-api.md) | All money and state writes go through the API | Accepted |
| [0008](0008-append-only-financial-records.md) | Append-only financial records | Accepted |
| [0009](0009-idempotency-keys-on-every-mutating-api-call.md) | Idempotency keys on every mutating API call | Accepted |
| [0010](0010-offline-order-entry.md) | Offline order entry | Accepted |
| [0011](0011-whatsapp-via-click-to-chat-only.md) | WhatsApp via click-to-chat only | Accepted |
| [0012](0012-tailwind-v4-tokens-from-the-website.md) | Tailwind v4 + tokens from the website | Accepted |
| [0013](0013-denominations.md) | Denominations | Accepted |
| [0014](0014-receipt-numbering.md) | Receipt numbering | Partially superseded by [ADR-0033](0033-receipt-numbers-keep-the-swoms-format.md) |
| [0015](0015-order-status-flow.md) | Order status flow | Accepted |
| [0016](0016-shift-linkage-by-id-not-time-window.md) | Shift linkage by id, not time window | Accepted |
| [0017](0017-attendance-multiplier-configurable-off-by-default.md) | Attendance multiplier configurable, off by default | Accepted |
| [0018](0018-payroll-runs-are-snapshots.md) | Payroll runs are snapshots | Accepted |
| [0019](0019-sri-lanka-statutory-contributions-optional.md) | Sri Lanka statutory contributions optional | Accepted |
| [0020](0020-local-dev-on-emulators-in-docker.md) | Local dev on emulators in Docker | Accepted |
| [0021](0021-pdfs-generated-client-side-with-jspdf.md) | PDFs generated client-side with jsPDF (vector text) | Accepted |
| [0022](0022-location-katubedda-as-the-seed-location.md) | Location `katubedda` (code `KTB`) as the seed location | Accepted |
| [0023](0023-translations.md) | Translations | Accepted |
| [0024](0024-business-day-calendar-day-in-asia-colombo.md) | Business day = calendar day in Asia/Colombo | Accepted |
| [0025](0025-step-by-step-delivery.md) | Step-by-step delivery | Accepted |
| [0026](0026-repository-layer-with-in-memory-adapters.md) | Repository layer with in-memory adapters (supersedes the Firestore-first parts of ADR-0007/ADR-0020) | Accepted |
| [0027](0027-typescript-6-0.md) | TypeScript 6.0 | Accepted |
| [0028](0028-node-22-lts.md) | Node 22 LTS | Accepted |
| [0029](0029-design-system-page-stays-english.md) | Design-system page stays English | Accepted |
| [0030](0030-timestamps-as-iso-strings-in-the-domain-layer.md) | Timestamps as ISO strings in the domain layer | Accepted |
| [0031](0031-dev-sign-in-is-pin-only-email-sign-in-waits-for-firebase.md) | Dev sign-in is PIN-only; email sign-in waits for Firebase Auth | Accepted |
| [0032](0032-queue-refresh-by-polling-until-firestore-listeners-exist.md) | Queue refresh by polling until Firestore listeners exist | Accepted |
| [0033](0033-receipt-numbers-keep-the-swoms-format.md) | Receipt numbers keep the SWOMS format (supersedes the format in ADR-0014) | Accepted |
| [0034](0034-manager-approvals-are-verified-outside-the-write-transaction.md) | Manager approvals are verified outside the write transaction | Accepted |
| [0035](0035-shift-handover-must-be-signed-by-someone-else.md) | Shift handover must be signed by someone else | Accepted |
| [0036](0036-late-payroll-corrections-go-into-the-next-period.md) | Late payroll corrections go into the next period | Accepted |
| [0037](0037-route-level-code-splitting-and-lazy-locales.md) | Route-level code splitting and lazy locales | Accepted |
| [0038](0038-offline-orders-device-outbox-server-assigns-on-arrival.md) | Offline orders: device outbox, server assigns on arrival | Accepted |
| [0039](0039-figma-tokens-mirror-tokens-css-not-tokens-ts.md) | Figma tokens mirror tokens.css, not tokens.ts | Accepted |
| [0040](0040-figma-component-sets-sparse-state-matrices-lucide-icons-as.md) | Figma component sets: sparse state matrices, lucide icons as swaps | Accepted |
| [0041](0041-website-frames-in-figma-brand-primitives-fixed-section.md) | Website frames in Figma: brand primitives, fixed section themes, raw overlays | Accepted |
| [0042](0042-mobile-website-frames-are-reflowed-clones-of-the-desktop.md) | Mobile website frames are reflowed clones of the desktop frames | Accepted |
| [0043](0043-figma-foundations-page-is-the-design-reference.md) | Figma Foundations page is the design reference | Accepted |
