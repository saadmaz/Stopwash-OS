# Stopwash OS: Product Requirements

<!-- nav -->
<sub><a href="../README.md">Project README</a> · <a href="README.md">Documentation index</a></sub>

## 1. Background
Stopwash runs a car wash in Katubedda, Sri Lanka, on SWOMS 2.5, a single HTML file backed by an open Firestore path with shared passcodes. It works, but:
- anyone with the file (or the public repo) can read and write all data;
- money is stored as floats, records can be edited or deleted with no trail, and invoice numbers can collide;
- prices, targets and WhatsApp numbers are hardcoded;
- it needs a constant internet connection.

Stopwash OS replaces it with a secure, multi-brand-ready, offline-tolerant POS and operations system. Every SWOMS feature carries over (see `PARITY.md`), plus the premium features listed below.

## 2. Users
| Persona | Role | Device | Top jobs |
|---|---|---|---|
| Counter cashier / supervisor | cashier | 11" tablet at the counter | Open shift, take orders fast, take payment, record cash-outs, close shift |
| Floor attendant | cashier | phone | See queue, move cars through IN_PROGRESS → READY |
| Manager | manager | desktop + tablet | Approve overrides, staff, attendance, leave, payroll, pricing, reports |
| Owner | owner | desktop/phone | Dashboard, settings, everything a manager can do, tax/payroll config |
| Accounts officer | accounts | desktop | Review closed shifts, approve or query, exports |
| Customer | — | customer display, receipt link | See order and total, get receipt on WhatsApp |

## 3. Goals and success measures
- New order from a blank screen in **under 15 seconds** (plate, class, one add-on, submit).
- Checkout in **under 10 seconds** for cash.
- 0 money rounding errors: integer cents end to end.
- 100% of money/state writes audited, with an actor.
- Order entry keeps working through a 5-minute network outage, with no duplicates after reconnect.
- WCAG 2.1 AA on all screens.

## 4. Scope

### 4.1 Parity (must)
Everything in `PARITY.md`: shift open with checklist and denomination count; orders with vehicle classes, add-ons and products; live queue with search, pagination and target; payments cash/card/split; receipts and invoice PDFs; cash-outs; reconciliation with variance thresholds and handover; accounts EOD approval; employees, incentive rules, payroll, salary slips, leave, attendance; retention and sales analytics; daily/previous-day PDF, CSV, session history; EN/SI/TA.

### 4.2 Premium (after parity)
1. Wall TV bay board (`/board`): big, auto-refreshing columns Queued / In bay / Ready, with plate and elapsed time.
2. Customer-facing display (`/display`): current order lines and total, mirrored from the counter.
3. Vehicle history by plate: visits, spend, last service, timeline.
4. Loyalty: every Nth completed wash discounted by a configurable %, applied automatically at checkout and shown on the receipt.
5. Owner dashboard: today vs same weekday last week, revenue-per-hour heatmap (7×24), average ticket, target progress.
6. Receipt sharing via WhatsApp click-to-chat (wa.me) with the receipt summary.
7. Real-time toasts for variance flags and low stock / equipment faults.

### 4.3 Out of scope (now)
Card terminal integration, SMS, online booking, accounting-system sync, multi-currency. The data model allows them later.

## 5. Key flows
1. **Open shift:** PIN sign-in → checklist (stock, equipment; alerts) → opening count → start.
2. **Order:** plate (typeahead; returning badge) → class tile → add-on steppers → optional phone/name → Add (Enter). It appears in the queue immediately (also offline).
3. **Floor:** attendant taps the card → Start (IN_PROGRESS) → Ready.
4. **Checkout:** from queue → tenders (cash/card/split), optional discount with reason (override above threshold) → Pay → receipt (print/PDF/WhatsApp).
5. **Cash-out:** expense or deposit, category, amount, paid to; manager PIN above threshold.
6. **Close shift:** system totals → closing count → variance → explanation (> threshold) / override (> override threshold) → incoming manager PIN handover → close → PDF.
7. **Accounts:** queue of closed shifts → detail → approve or query.
8. **Payroll:** choose period → preview (incentives from daily counts) → adjustments → finalize → slips.

## 6. Non-functional
- **Security:** see ARCHITECTURE §Security. No secrets in the repo. Old passcodes and Firebase config are never used.
- **Performance:** first load under 2.5 s on mid-range Android over 4G (app shell under 200 KB gz, routes split); queue list virtualised beyond 100 rows.
- **Reliability:** idempotent writes; only one open shift per location.
- **Localisation:** EN/SI/TA. Money shown as `LKR 1,250.00`, dates `15 Nov 2026`, times in Asia/Colombo.
- **Accessibility:** 44 px touch targets, visible focus, labelled controls, reduced motion honoured.
- **Theming:** light and dark, brand tokens from stopwash.lk.

## 7. Open questions (defaults chosen, see DECISIONS)
- VAT registration: tax is off by default (ADR-0019 area / settings.tax).
- EPF/ETF on slips: off by default (ADR-0019).
- Attendance-weighted incentives: off by default (ADR-0017).
- Loyalty rule: off by default; suggested 6th wash at 50%.
