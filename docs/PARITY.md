# Parity: SWOMS 2.5 → Stopwash POS

Source of truth for the old system: `SWOMS2.5.html` (10,594 lines) in `Stopwash-POS-HTML`, plus its README, SYSTEM_SUMMARY and attendance notes.
Every row below is a feature, screen, field, calculation or edge case found in the old app. Nothing is dropped silently. A row that is intentionally changed says so in **Notes** and links to a decision in `DECISIONS.md`.

Status legend: `TODO` not started · `WIP` in progress · `DONE` built and tested · `CHANGED` built differently on purpose (see notes) · `DROPPED` removed on purpose (see notes)

Line numbers refer to `SWOMS2.5.html`.

## 1. Access & session

| # | Old behaviour | Where (old) | New home | Status | Notes |
|---|---|---|---|---|---|
| A1 | Three shared 4-digit passcodes decide role: Supervisor 5252 → EMPLOYEE, HR 6225 → HR, Accounts 0706 → ACCOUNTS | 2883–2885, `attemptPasscodeLogin` 3569 | Email sign-in (owner/manager/accounts) + per-employee PIN on a registered device (cashier/attendant) → Firebase custom token | WIP | CHANGED: shared passcodes are compromised and give no individual accountability. D-004, D-005 |
| A2 | Role kept in `sessionStorage.swPasscode` across refresh | 3569, 4290 | Firebase Auth session persistence + custom claims | DONE | |
| A3 | Anonymous Firebase auth; `userId` is a device id | 4283 | Real user identity (uid + employeeId) on every write | DONE | CHANGED: audit log now names the person |
| A4 | "Switch" user button with confirm, clears role and session id | `logoutUser` 3672 | Header "Switch user" → PIN pad (keeps device registered) | DONE | |
| A5 | Role-based UI: HR sees analytics, HR menus, quick actions; ACCOUNTS sees only EOD dashboard; EMPLOYEE sees order form + queue | `updateUIVisibilityByRole` 3601 | RBAC permission map in `packages/shared`; nav and routes filtered by permission; API + rules enforce | DONE | Roles map: EMPLOYEE→cashier, HR→owner/manager, ACCOUNTS→accounts. D-006 |
| A6 | `checkHRAuth()` prompts for HR passcode to unlock HR features mid-session | 5710 | "Manager override" dialog: manager PIN re-auth that grants one action (step-up) | TODO | CHANGED: one-time elevation, not session-wide |
| A7 | Supervisor passcode prompt to edit/delete session history, clear all history | `editSession` 7074, `deleteSession` 7406, `clearAllHistory` 7361 | Manager/owner permission + reason required; corrections as reversing entries | TODO | CHANGED: no delete of financial history. D-008 |
| A8 | Resume session modal: finds OPEN session (localStorage id first, else newest OPEN) and offers Resume / Start new anyway (warning) | `updateStaffDropdowns` 6420, `resumeExistingSession` 6517, `startNewShiftAnyway` 6547 | Shift context loads the location's open shift from Firestore; only one open shift per location (API enforces); "Resume" is automatic | TODO | CHANGED: "start new anyway" removed because it caused double-open shifts; manager can force-close instead |
| A9 | Supervisor login goes to stock checker first; HR/ACCOUNTS bypass | 3569 | Cashier with no open shift → Open Shift wizard (checklist → count → start); managers land on dashboard | TODO | |
| A10 | Employee "can open/close shifts" flag; supervisor list = canOpenShift or role Manager/Supervisor/HR | 6420 | `employees.canOpenShift` + permission `shift.open` | WIP | |

## 2. Pre-shift checklist & stock

| # | Old behaviour | Where | New home | Status | Notes |
|---|---|---|---|---|---|
| S1 | Stock items: Shampoo, Tyre Shine, Glass Cleaner, Air Freshener, Wiper Fluid → HIGH ("Have Stock") / LOW ("Running Low") | 3741, 3796 | Configurable `stockItems` list in settings; checklist step 1 | WIP | CHANGED: items configurable |
| S2 | Equipment: Vacuum (Working/Faulty), Pressure Gun (Working/Faulty), Mitts & Cloths (Clean/Need wash), Power & Water (Stable/Issues) | `selectEquip` 4811 | Configurable `equipmentItems` with ok/fault labels; checklist step 2 | WIP | |
| S3 | "Mark all in stock" button | `markAllStockHigh` 4795 | "All good" button on each checklist step | TODO | |
| S4 | Saves stock levels to `settings/stockLevels` (merge) with lastUpdated | 4875 | `checklists` (append-only) + derived `stockStatus` doc updated by API | TODO | |
| S5 | Low stock → WhatsApp `wa.me` message to hardcoded number, timestamped list | 4875 | wa.me click-to-chat to number(s) from settings + in-app alert + toast | WIP | Hardcoded number removed. D-011 |
| S6 | Faulty equipment → separate "EQUIPMENT FAILURE ALERT" WhatsApp message | 4875 | Same, config numbers | WIP | BUG FIXED: old code only checked `=== 'FAULTY'`, so Mitts ("LOW") and Utilities ("ISSUE") never triggered the alert |
| S7 | Request-stock mode from nav mid-shift: same modal, sends "STOCK REQUEST" WhatsApp, requires at least one LOW | `showStockChecker('REQUEST')` 3766 | "Request stock" sheet in Inventory | TODO | |
| S8 | Red "Running low: …" banner on dashboard from live stock doc | `startStockListener` 8322 | Low-stock banner + real-time toast (premium) | TODO | |

## 3. Shift open & cash count

| # | Old behaviour | Where | New home | Status | Notes |
|---|---|---|---|---|---|
| H1 | Start shift: live clock, select staff (supervisors), carryover notes | `confirmStartShift` 5200 | Open Shift wizard step 3 | TODO | |
| H2 | Denominations LKR 5000/1000/500/100/50/20 + coins (coins entered as total value) | 4853, 5178 | Denomination counter component; denominations configurable (default adds 2000 note; coins kept as value) | WIP | CHANGED: LKR 2000 note added to defaults (legal tender). D-013 |
| H3 | Opening total auto-calculated, per-denomination subtotal shown | 4853 | Same, integer cents | WIP | |
| H4 | Session doc: startTime, openingBalance, staffName, shiftType LIVE, carryoverNotes, status OPEN, denominations | 5200 | `shifts` doc via API `POST /shifts` (transaction, idempotent) | TODO | |
| H5 | Audit log CREATE/SESSION on open | 5200 | Audit log `shift.open` | TODO | |
| H6 | Duplicate `calculateOpeningBalance` definitions (second overrides first) | 4853, 5178 | Single tested function in `packages/shared` | DONE | |

## 4. Orders & queue

| # | Old behaviour | Where | New home | Status | Notes |
|---|---|---|---|---|---|
| O1 | Plate (required, uppercased), phone, name (optional; stored as 'N/A' when empty) | `addOrder` 8851 | New Order screen; empty → null (not 'N/A') | TODO | |
| O2 | Vehicle size: BIKE 500 / SMALL 750 / MEDIUM 1000 / LARGE 1250 (hardcoded) | `PRICES` 3381 | Configurable vehicle classes in `catalog` | WIP | Seeded with the same prices |
| O3 | Add-ons (flat, on/off): Wax 250, Vacuum add-on 250 | `PRICES.addons` | Catalog items `kind: addon`, qty stepper (max 1 by default) | WIP | Old README lists only products; source has both. Both kept |
| O4 | Products (per unit, qty): Air Freshener 500, Int. Vacuum product 500, Wiper Fluid 250 | `PRICES.products` | Catalog items `kind: product`, steppers | WIP | |
| O5 | Selecting a size opens add-ons modal | `handleSizeSelection` 3975 | Add-ons shown inline beside class tiles (no modal, faster) | TODO | CHANGED for speed |
| O6 | Order valid if plate + (size or ≥1 product); add-on alone is not enough | `calculateTotal` 4233, `addOrder` | Same rule in shared Zod schema | TODO | |
| O7 | Price = size + add-ons + Σ product×qty; qty defaults 1 | `calculateTotal`, `calculateBreakdown` 3890 | `priceOrder()` in shared, recomputed on API (client total ignored) | TODO | |
| O8 | Order doc fields: customerName, customerPhone, numberPlate, vehicleSize, selectedAddOns[], selectedProducts[{name,qty}], calculatedPrice, orderDate, status QUEUED, paymentMethod 'N/A', createdBy, createdAt | 8851 | `orders` with line items snapshotting name + unit price | TODO | |
| O9 | Autocomplete: datalists for plates/phones/names from all orders + localStorage recent list; normalized plate (no spaces) dedupe | 8252, 8673–8840 | Customer/vehicle lookup endpoint + Firestore `vehicles` index; typeahead | TODO | |
| O10 | Cross-fill: entering a known plate fills phone/name; known phone fills name/plate; known name fills phone/plate; only fills empty fields or fields it filled itself; clears what it filled when the trigger changes | `lookUpPlate/Phone/Name`, `setAutofillValue`, `clearAutofilledBy` 8760–8850 | Same behaviour in New Order form hook (tested) | TODO | |
| O11 | Returning-customer badge when plate seen before | README §8.3 | Badge + visit count + last service on plate entry | TODO | |
| O12 | Live queue: real-time listener of ALL orders, QUEUED first then newest | `startOrderListener` 8252 | Queue scoped to location + business day (+ open older QUEUED), real-time | TODO | CHANGED: no full-collection listener (performance) |
| O13 | Search across plate, name, phone | `renderOrders` 8350 | Search box (Ctrl/⌘+K and `/`) | TODO | |
| O14 | Pagination 10/page with numbered pages, ellipsis, "Showing x to y of z" | 8350, 8522–8550 | Paginated table (desktop) / card list (mobile) | WIP | |
| O15 | Daily target progress (DAILY_TARGET=15), counts COMPLETED orders completed today; bar colour red <5, orange <10, green ≥10 | `renderOrders` | Target progress, target from settings; colour thresholds as % of target | TODO | CHANGED: thresholds scale with target |
| O16 | Row shows date/time, plate, phone, services string, price, discount note, status badge, payment info, actions | `renderOrders` | Queue card/row | TODO | |
| O17 | Status values in use: QUEUED, COMPLETED, CANCELLED (filtered in analytics) | various | QUEUED → IN_PROGRESS → READY → COMPLETED; CANCELLED with reason | TODO | CHANGED: richer flow for bay board. D-015 |
| O18 | Edit order modal: customer, plate, size, add-ons, products; recalculates price; for COMPLETED also final price, payment method, split amounts | `showEditModal` 4041, `saveOrderChanges` 8556 | Edit before payment; after payment, corrections via payment reversal + re-tender | TODO | CHANGED: append-only payments. D-008 |
| O19 | HR can backdate order date (sets createdAt/completedAt, clears sessionId) | 4041, 8556 | Manager "back-dated entry" with reason, assigned to a target shift; audited | TODO | |
| O20 | Delete order (confirm) — hard delete | `deleteOrder` 8914 | Cancel with reason (permission `order.cancel`); paid orders need refund first | TODO | CHANGED: no hard deletes |
| O21 | Edit/delete icons per row | `renderOrders` | Row actions menu | TODO | |
| O22 | Clear form button | `clearOrderForm` 4762 | "Clear" (Esc) | TODO | |
| O23 | Products-only order allowed (no vehicle size) | `addOrder` | Allowed ("Retail only") | TODO | |
| O24 | `order-staff-name` select (all staff) exists in UI | 6420 | Optional "Assigned washer" on order | TODO | Used later for per-staff analytics |

## 5. Payment & invoice per order

| # | Old behaviour | Where | New home | Status | Notes |
|---|---|---|---|---|---|
| P1 | "Mark complete & pay" opens payment modal with calculated amount, final paid price editable | `showPaymentModal` 4002 | Checkout sheet | TODO | |
| P2 | Methods CASH, CARD, SPLIT (cash+card must equal final ±0.01); split inputs auto-fill the remainder | 4168, 4740 | Tenders list (CASH, CARD now; design allows more) with remaining-due calculator | TODO | Integer cents, exact match |
| P3 | discountAmount = calculated − final; shown as "(LKR x Discount)" | 4168, 8350 | Discount line with reason; above configurable % needs manager override | TODO | Override threshold new |
| P4 | Final price must be ≥ 0 | 4168 | Zod + API | TODO | |
| P5 | On pay: status COMPLETED, paymentMethod, cashAmount, cardAmount, completedAt, invoiceNumber, finalPaidPrice, discountAmount, sessionId | 4168 | API `POST /orders/:id/checkout` transaction writes `payments` + order status + invoice | TODO | |
| P6 | Invoice number = DDMM + 3-digit sequence of today's completed orders (client-side count, race-prone) | 4168 | Server counter per location per business day, in transaction: `{prefix}-{YYMMDD}-{seq}` | TODO | CHANGED: race-free. D-014 |
| P7 | "View invoice" → per-order invoice PDF `Invoice_{plate}_{no}.pdf` | `generateInvoicePDF` 9148 | Receipt view + PDF download + WhatsApp share | TODO | |
| P8 | Sales split: SPLIT counts cashAmount to cash and cardAmount to card | 5348 | Payments ledger sums by method | TODO | |

## 6. Cash out (expenses & deposits)

| # | Old behaviour | Where | New home | Status | Notes |
|---|---|---|---|---|---|
| C1 | Requires an active session | `showCashOutModal` 7456 | Requires open shift | TODO | |
| C2 | Type EXPENSE or DEPOSIT; labels change ("Paid To (Vendor/Staff)" vs "Deposited By / Handed To") | `setCashOutType` 7603 | Same | TODO | |
| C3 | Categories with codes: E001 Cleaning Supplies, E002 Equipment Repairs, E003 Utility top-up, E004 Staff Meals, E005 Transport/Delivery, E006 Minor Site Fixes, E007 Miscellaneous; D001 Bank Deposit, D002 Owner Withdrawal, D003 Safe Drop | 7406 `CASH_OUT_CATEGORIES` | Configurable categories (seeded with these) | WIP | |
| C4 | Amount > 0, category, paidTo required; description optional | `validateCashOut` 7667 | Zod | TODO | |
| C5 | Manager approval select + PIN verify UI exists but `approvedBy` is always saved as "N/A" | `verifyCashOutApproval` 7633, `saveCashOut` 7687 | Manager PIN approval required above configurable amount; approver stored | TODO | BUG FIXED |
| C6 | HR can backdate (createdAt, sessionId null) | 7687 | Manager back-dated entry to a chosen shift, with reason | TODO | |
| C7 | Recent transactions list for current session with edit + delete | `loadRecentExpenses` 7480, `editExpense`, `deleteExpense` | List with "Reverse" action (creates reversing entry) | TODO | CHANGED: append-only |
| C8 | Audit CREATE/UPDATE EXPENSE | 7687 | Audit | TODO | |
| C9 | `calculateCashOutDenoms` stub returns 0 | 7662 | Dropped (unused stub) | DROPPED | Dead code |

## 7. End shift & reconciliation

| # | Old behaviour | Where | New home | Status | Notes |
|---|---|---|---|---|---|
| R1 | Shows opening, cash sales, card sales, expenses, deposits, expected cash, vehicle count | `showEndShiftModal` 5348 | Close Shift screen (API computes) | TODO | |
| R2 | Sales & cash-outs gathered by sessionId PLUS any orphan record whose time falls in the shift window | 5348 | Every order/payment/cash movement carries `shiftId` set by the API; no time-window guessing | TODO | CHANGED. Legacy import maps orphans once. D-016 |
| R3 | Expected = opening + cash sales − expenses − deposits | 5348 | `expectedCash()` in shared, tested | TODO | |
| R4 | Closing denomination count → physical total | `calculateClosingBalance` 5268 | Same component | TODO | |
| R5 | Variance = physical − expected; label Matched (<1), Shortage (<0), Overage (>0), coloured box | `calculateVariance` 5323 | Same; exact 0 = Matched (integer cents) | TODO | |
| R6 | |variance| > 500 → explanation mandatory | `finalizeCloseShift` 5547 | Threshold from settings (default LKR 500) | WIP | |
| R7 | |variance| > 2000 → supervisor passcode override required | 5547 | Second threshold from settings (default LKR 2,000) → manager PIN override, override recorded | WIP | Not in old README; found in source |
| R8 | Handover: incoming manager selects name + PIN → "Verified by" | `verifyHandover` 5283 | Incoming manager PIN verification via API (hashed PIN, rate-limited) | TODO | Old compared plain-text PIN client-side |
| R9 | Close blocked without handover verification; confirm dialog | 5547 | Same | TODO | |
| R10 | Close writes endTime, closingBalance, expectedBalance, variance, cash/card/total sales, totalExpenses, totalDeposits, vehicleCount, closingNotes, handoverManager, closingDenominations, status CLOSED | 5547 | `shiftCloses` append-only record + shift status CLOSED (API transaction) | TODO | |
| R11 | After close, back-links orphan orders/expenses in window to the session | 5547 | Not needed (R2) | CHANGED | |
| R12 | Audit CLOSE/SESSION with before/after | 5547 | Audit | TODO | |
| R13 | Auto-download reconciliation PDF: header, generated time, staff, session id, period, line items, expense table, deposit table, variance analysis, notes, opening/closing denomination table, footer "Internal Document" | `generateReconciliationPDF` 7891 | Same content, branded | TODO | |
| R14 | After close: clears session + passcode, returns to login | 5547 | Returns to PIN pad | TODO | |
| R15 | Close any session from history (not only current) | 5547 | Manager can close a stale shift from Shifts page | TODO | |

## 8. Session history (HR)

| # | Old behaviour | Where | New home | Status | Notes |
|---|---|---|---|---|---|
| SH1 | Last 50 sessions: date, time, staff, opening, cash, card, closing, variance (colour: <−10 red, >10 yellow, else green), notes | `loadSessionHistory` 8189 | Shifts page (paginated, filterable) | TODO | |
| SH2 | Manual session open (backdated): staff, start, optional end (required if >24h ago), opening; shiftType MANUAL, openedBy HR_MANUAL | `openManualSession` 5495 | "Back-dated shift" (manager), audited | TODO | |
| SH3 | Edit session: times, opening/closing, cash/card sales, expenses, deposits, notes, variance (manual override), opening/closing denominations; recalc from list; auto-calc sales from time window | `editSession` 7074, `autoCalculateSalesFromTimes` 7171, `saveSessionChanges` 7238 | Shift close "adjustment" entry (append-only) with reason; recalculation is a report, not an edit | TODO | CHANGED: no in-place edits. D-008 |
| SH4 | Edit-session transaction list: add/edit transactions for that session, sync totals | 7768–7890 | Add back-dated cash movement to a closed shift → creates adjustment | TODO | |
| SH5 | Redownload reconciliation PDF for any session | `redownloadReport` 7310 | "Download PDF" on shift detail | TODO | |
| SH6 | Delete session (passcode) / Clear all history (passcode, double confirm) | 7361, 7406 | Not allowed on financial records | DROPPED | Replaced by void/adjustment entries. D-008 |

## 9. Accounts EOD approval

| # | Old behaviour | Where | New home | Status | Notes |
|---|---|---|---|---|---|
| E1 | Lists CLOSED and APPROVED_BY_ACCOUNTS sessions, newest first | `loadEodApprovals` 4967 | Accounts → Approvals queue | TODO | |
| E2 | KPIs over unapproved: count, system cash (expected), actual cash, expenses | 4967 | Same + variance total | TODO | Old read `s.expenses` (undefined; field is `totalExpenses`) so expenses KPI was always 0 — BUG FIXED |
| E3 | Row: shift name/time, managers, gross sales, system balance, drawer count, difference, status, actions | 4967 | Table | TODO | |
| E4 | Expand row: vehicles in shift with time, services, price, payment method; vehicle count | `toggleEodDetails` 5073 | Shift detail drawer | TODO | |
| E5 | Approve (confirm) → status APPROVED_BY_ACCOUNTS, approvedAt, audit EOD_APPROVED | `approveEOD` 5161 | `shiftApprovals` append-only + shift status APPROVED; can also "Query" (send back with note) | TODO | Query is new |

## 10. Employees & HR

| # | Old behaviour | Where | New home | Status | Notes |
|---|---|---|---|---|---|
| EM1 | Fields: code (req), name (req), phone (req), role Washer/Supervisor/Trainee/Manager, base salary (req), recurring deduction, recurring addition, PIN, incentive rule, canOpenShift, skip recurring this month | `saveEmployee` 5833 | Employee form | TODO | PIN hashed; job title separate from system role |
| EM2 | "Skip recurring" stored as `exemptMonths` [YYYY-MM] list; current month toggled | 5833 | Same (period keys) | TODO | |
| EM3 | Directory: name, code, salary, recurring addition, deductions this month (one-off + recurring), basic net, "Paused" | `loadEmployeeList` 5751 | Staff table | TODO | |
| EM4 | Delete employee (hard delete) | `deleteEmployee` 5992 | Deactivate (soft) — history keeps references | TODO | CHANGED |
| EM5 | One-off deductions per employee: date, category (Food/Meals, Accommodation, Salary Advance, Fine/Penalty, Other), amount; list + delete | 9303–9430, 10231 | `payrollAdjustments` kind DEDUCTION; reverse instead of delete | TODO | |
| EM6 | Bonus adjustments: date, reason, amount (±); list + delete | 9431–9594 | `payrollAdjustments` kind BONUS | TODO | |
| EM7 | Staff dropdowns refreshed app-wide | `updateStaffDropdowns` 6420 | Live query hooks | TODO | |

## 11. Incentive rules

| # | Old behaviour | Where | New home | Status | Notes |
|---|---|---|---|---|---|
| I1 | Named rule with weekday tiers and weekend tiers [{target, bonus}], sorted by target | `saveIncentiveRule` 6105 | Incentive rules screen | TODO | |
| I2 | Legacy single weekdayTarget/Bonus, weekendTarget/Bonus fields supported | `editIncentiveRule` 6186, payroll | Legacy import converts to tiers | TODO | |
| I3 | Delete rule (employees keep dangling id; payroll skips) | 6216 | Archive rule; payroll shows "rule archived" | TODO | |
| I4 | List shows tiers as "10+: LKR 250, …" | 6156 | Same | TODO | |

## 12. Payroll

| # | Old behaviour | Where | New home | Status | Notes |
|---|---|---|---|---|---|
| PY1 | Month + year selector | `showPayrollModal` 6555 | Period picker | TODO | |
| PY2 | Shop daily count = COMPLETED orders per calendar day (date taken from ISO string prefix = UTC date) | 6566 | Count by `businessDate` in Asia/Colombo | TODO | BUG FIXED: UTC date put orders after 18:30 SL time on the wrong day |
| PY3 | Weekend = Sat/Sun | `isWeekend` | Configurable weekend days (default Sat, Sun) | WIP | |
| PY4 | Per day: highest tier whose target ≤ daily count gives that tier's bonus (not cumulative) | 6566 | `dailyIncentive()` in shared, tested | TODO | |
| PY5 | Attendance multiplier removed in 2.5 (always 1.0) | 6687, 6727 | Configurable: off by default (parity); can enable Present 1.0 / Half-day 0.5 / Absent 0 | WIP | D-017 |
| PY6 | Net = base + bonus + bonus adjustments + recurring addition − (one-off deductions + recurring deduction); recurring skipped if month exempt | 6566 | `computePayslip()` in shared, tested | TODO | |
| PY7 | Grand total of all net pay | 6566 | Run total | TODO | |
| PY8 | Bonus breakdown modal: date, count, tier, bonus | `showBonusBreakdown` 6836 | Payslip detail | TODO | |
| PY9 | Deductions breakdown modal | `showDeductionsBreakdown` 6868 | Payslip detail | TODO | |
| PY10 | Salary slip PDF: navy header, employee, code, role, period, base, itemised bonus by date, deductions, adjustments, net; `SalarySlip_{name}_{month}.pdf`; audit | `generateSalarySlip` 6895 | Salary slip PDF from a finalized payroll run | TODO | |
| PY11 | "Process all payroll" button only shows an alert and reloads (not implemented) | `processAllPayroll` 7042 | Finalize payroll run (append-only snapshot) + bulk slips ZIP | TODO | Implemented properly |
| PY12 | Payroll is recalculated live every time (no stored run) | 6566 | Draft preview → Finalize → immutable `payrollRuns`; corrections = supplementary run | TODO | CHANGED. D-018 |
| PY13 | EPF/ETF not handled | — | Optional statutory deductions (EPF employee 8%, employer EPF 12%, ETF 3%), off by default | WIP | New, configurable. D-019 |

## 13. Leave

| # | Old behaviour | Where | New home | Status | Notes |
|---|---|---|---|---|---|
| L1 | Any role can open leave; staff mode vs admin mode badge | `showLeaveModal` 6240 | Leave page: "My leave" for staff, "Requests" for managers | TODO | |
| L2 | Request: employee, start, end, reason (all required) → PENDING | `submitLeaveRequest` 6286 | Same + end ≥ start validation | TODO | Old had no end ≥ start check |
| L3 | Admin list (last 100) with Approve / Reject when PENDING, "PROCESSED" otherwise, delete | 6317 | Same; delete → withdraw/cancel | TODO | |
| L4 | Staff history filtered by selected employee | 6317 | Own requests (by signed-in employee) | TODO | |
| L5 | Process sets status + processedAt (HR auth) | 6394 | + processedBy, audit | TODO | |

## 14. Attendance

| # | Old behaviour | Where | New home | Status | Notes |
|---|---|---|---|---|---|
| AT1 | Attendance checker (Present / Late / Half-Day / Absent, "All present" button, one-click edit) existed before 2.5; only i18n keys remain in 2.5 | 3411 keys; SYSTEM_SUMMARY | Attendance page: daily roster, statuses, clock-in on PIN sign-in, "mark all present" | TODO | Restored |
| AT2 | Branded attendance PDF for date range, colour-coded statuses (green/yellow/orange/red) | attendance_implementation.md | Attendance report PDF | TODO | |

## 15. Analytics (HR)

| # | Old behaviour | Where | New home | Status | Notes |
|---|---|---|---|---|---|
| AN1 | Retention periods WEEKLY (7d), MONTHLY, QUARTERLY, YEARLY, CUSTOM range | `calculateRetention` 3245 | Customers analytics | TODO | |
| AN2 | Unique normalized plates in period; returning = seen before period start; new otherwise; excludes CANCELLED | 3245 | `retention()` in shared, tested | TODO | |
| AN3 | Shows returning count, new count, retention %, growth %, bars, insight sentence, period label | 3245 | Same | TODO | |
| AN4 | Sales periods WEEKLY/MONTHLY/QUARTERLY/CUSTOM, product filter ALL/WASH/WAX/VACUUM/AIR_FRESHENER/WIPER_FLUID | `calculateSalesStats` 3025 | Sales analytics with item filter (any catalog item) | TODO | YEARLY tab existed in UI but fell through to "now" window — BUG FIXED |
| AN5 | Revenue (final paid else calculated), count, average ticket, vs previous equal period with ↑/↓ | 3025 | Same + daily series chart | TODO | |
| AN6 | Chart: current vs previous revenue bars | `updateChartUI` 3137 | Recharts | TODO | |
| AN7 | Summary sentence | 3025 | Same (translated) | TODO | |

## 16. Reports & exports

| # | Old behaviour | Where | New home | Status | Notes |
|---|---|---|---|---|---|
| RP1 | Today's revenue PDF: company header, list (time, plate & customer, services, payment, amount), totals (count, card, cash, grand) | `exportOrdersToPDF` 8989 | Reports → Daily revenue PDF | TODO | |
| RP2 | Previous-day report (date picker) | 8989 | Same, any date | TODO | |
| RP3 | Master CSV of all completed orders: date, time in, plate, name, phone, services, calculated, final, discount, method, invoice no. | `exportCompletedOrdersToCSV` 8930 | CSV export with date range (default all) | TODO | Old values not escaped for quotes — fixed |
| RP4 | Session PDF re-download | 7310 | Shift detail | TODO | |

## 17. Custom invoices (B2B)

| # | Old behaviour | Where | New home | Status | Notes |
|---|---|---|---|---|---|
| IN1 | New invoice: customer name, address (autocomplete from `invoice_customers` + orders), date, number (starts 55100), line items (desc, qty, unit), discount, paid/unpaid | 9595–9903 | Invoices page | TODO | |
| IN2 | Saves `invoice_customers` (name, address) if new/changed | `saveCustomerIfNeeded` 9889 | `billingCustomers` | TODO | |
| IN3 | History: reprint, re-edit, toggle paid, delete | 9653–9762 | Reprint; "void + reissue" instead of edit/delete; payments recorded as settlements | TODO | CHANGED: append-only |
| IN4 | Settings: company name, address, phone, tax id, logo (base64), bank details | 9803 | Settings → Business profile (logo in Storage) | WIP | |
| IN5 | PDF via html2canvas → jsPDF | 9903 | Vector PDF (pdf-lib / jsPDF text) | TODO | |
| IN6 | `nextNumber` default 55100 | 9606 | Counter seeded from settings | WIP | |

## 18. Audit trail

| # | Old behaviour | Where | New home | Status | Notes |
|---|---|---|---|---|---|
| AU1 | `logAuditAction(action, category, targetId, before, after, reason)` writes timestamp, userId, userRole | 2981 | API writes audit in the same transaction as the change | WIP | |
| AU2 | Viewer: filter by action and date; latest 100; colour by action | `loadAuditLogs` 6011 | Audit page: filter by actor, entity, action, date; paginated; before/after diff | TODO | |
| AU3 | Many writes were NOT audited (order create/pay/edit, employee save/delete, leave, rules) | various | Every write that matters audited | WIP | Gap closed |

## 19. Platform & UX

| # | Old behaviour | Where | New home | Status | Notes |
|---|---|---|---|---|---|
| X1 | EN / Sinhala / Tamil switch in header, saved in localStorage `sw_lang`; 33 translated elements | 3494 | i18next, every string, Noto Sans Sinhala / Tamil fonts | WIP | |
| X2 | Tailwind, Inter; navy `#001828` header/nav | — | Brand tokens from website (lime/navy/ink, Space Grotesk + Inter) | DONE | |
| X3 | Mobile slide-out nav; table → cards on mobile | 9 | Responsive shell | DONE | |
| X4 | iOS input zoom fix (16px inputs ≤768px) | README §17 | Base font 16px on inputs | DONE | |
| X5 | Requires internet for everything | — | PWA + Firestore offline persistence + queued order writes | TODO | |
| X6 | `parseFlexibleDate` handles ISO, Date, Timestamp, `YYYY-MM-DDTHH:MM` local, `DD/MM/YYYY` | 2911 | Legacy importer uses equivalent parser (tested) | TODO | |
| X7 | `getSLDate` Asia/Colombo date | 3381 | `businessDate()` in shared | DONE | |
| X8 | `getEffectiveEndTime`: open session ends now; past-day open session ends 23:59:59 that day | 2947 | Stale-shift detection on Shifts page | TODO | |
| X9 | Invoice settings loaded on auth | 4283 | Settings query | TODO | |
| X10 | `open_flow_state` vestigial key | 5200 | — | DROPPED | Dead code |
