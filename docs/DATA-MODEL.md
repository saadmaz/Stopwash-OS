# Data model (Firestore)

Conventions:
- Money fields end in `Cents` and are integers (LKR × 100).
- Timestamps are Firestore `Timestamp` (UTC). `businessDate` is `YYYY-MM-DD` in Asia/Colombo.
- Every document has `brandId` (default `stopwash`), and `locationId` where it belongs to a site.
- `createdAt`, `createdBy` (uid) on everything; `updatedAt`, `updatedBy` on mutable docs.
- "Write: API" means clients cannot write. Only the API (Admin SDK) does, inside a transaction, with an audit entry.
- Roles: **O** owner, **M** manager, **C** cashier, **A** accounts. "Same brand" means `resource.data.brandId == request.auth.token.brandId`; location-scoped roles also need `locationId in token.locationIds`.

Zod schemas for every collection live in `packages/shared/src/schemas/`.

## Tenancy & identity

### `brands/{brandId}`
`name, legalName, defaultLocale, currency: "LKR", timezone: "Asia/Colombo"`
Read: any signed-in user of that brand. Write: API (O).

### `locations/{locationId}`
`brandId, code ("KTB"), name, address, phone, active, openShiftId | null, timezone`
Read: same brand. Write: API (O). `openShiftId` is changed only by shift open/close transactions.

### `users/{uid}`
`brandId, email | null, displayName, role ("owner"|"manager"|"cashier"|"accounts"), locationIds[], employeeId | null, active, preferences {locale, theme}, lastSignInAt`
Read: self; O/M same brand. Write: API (O/M). The user may update only `preferences` (rules check the changed keys).

### `employees/{employeeId}`
`brandId, locationIds[], code ("SW001"), name, phone, jobTitle ("Washer"|"Supervisor"|"Trainee"|"Manager"|custom), systemRole | null, uid | null, baseSalaryCents, recurringDeductionCents, recurringAdditionCents, exemptMonths[] (YYYY-MM), incentiveRuleId | null, canOpenShift, active, hasPin`
Read: O/M/A same brand; C reads a public projection via `staffDirectory`. Write: API (O/M).

### `staffDirectory/{employeeId}` (public projection for PIN pad and handover)
`brandId, locationIds[], name, code, jobTitle, canOpenShift, active, initials`
Read: any signed-in user, and a registered device (device session). Write: API (mirrors `employees`).

### `employeeSecrets/{employeeId}`
`pinHash (bcrypt), failedAttempts, lockedUntil, pinUpdatedAt`
Read: none (clients). Write: API.

### `devices/{deviceId}`
`brandId, locationId, name, secretHash, registeredBy, active, lastSeenAt, kind ("counter"|"floor"|"board"|"display")`
Read: O/M. Write: API.

## Configuration (all managed from Settings, all audited)

### `settings/{brandId}__{locationId}`
```
dailyVehicleTarget: 15
variance: { explainAboveCents: 50000, overrideAboveCents: 200000 }
cashOut: { approvalAboveCents: 500000 }
discount: { overrideAbovePct: 20 }
denominations: [500000, 200000, 100000, 50000, 10000, 5000, 2000]   // notes in cents; coins counted as value
notificationNumbers: { stock: ["94…"], equipment: ["94…"], variance: ["94…"] }
tax: { enabled: false, name: "VAT", ratePct: 18, inclusive: true, registrationNo: "" }
receipt: { prefix: "KTB", footer: "Thank you for choosing STOPWASH" }
weekendDays: [0, 6]
loyalty: { enabled: false, everyNth: 6, rewardPct: 50, appliesTo: "wash" }
payroll: { attendanceMultiplier: { enabled: false, PRESENT: 1, LATE: 1, HALF_DAY: 0.5, ABSENT: 0, LEAVE: 0 },
           statutory: { enabled: false, epfEmployeePct: 8, epfEmployerPct: 12, etfEmployerPct: 3 } }
business: { name, address, phone, email, taxId, bankDetails, logoPath }
invoice: { nextNumberSeed: 55100 }
```
Read: same brand. Write: API (O/M; tax and payroll O only).

### `catalogItems/{itemId}`
`brandId, locationIds[] | "all", kind ("vehicleClass"|"addon"|"product"), code ("SMALL"), name {en, si, ta}, description, priceCents, maxQty (addon default 1), trackStock, stockItemId | null, sort, active, icon`
Seed: vehicle classes BIKE 50000, SMALL 75000, MEDIUM 100000, LARGE 125000; add-ons WAX 25000, VACUUM_ADDON 25000; products AIR_FRESHENER 50000, VACUUM_PRODUCT 50000, WIPER_FLUID 25000.
Read: same brand. Write: API (O/M). Prices are snapshotted into order lines, so price changes never alter history.

### `stockItems/{id}` and `equipmentItems/{id}`
`brandId, name {en,si,ta}, okLabel, faultLabel, sort, active`
Read: same brand. Write: API (O/M).

### `cashCategories/{id}`
`brandId, type ("EXPENSE"|"DEPOSIT"), code ("E001"), name, active, sort`
Read: same brand. Write: API (O/M).

### `incentiveRules/{id}`
`brandId, name, weekdayTiers [{target, bonusCents}], weekendTiers [...], archived`
Read: O/M/A. Write: API (O/M).

## Customers & vehicles

### `customers/{customerId}`
`brandId, name | null, phone | null (E.164 normalised), phoneRaw, plates[] (normalised), firstSeenAt, lastSeenAt, visitCount, totalSpentCents`
Read: same brand (C included, for lookup). Write: API (upsert on order create / checkout).

### `vehicles/{brandId}__{plateKey}`
`brandId, plateKey ("CAB1234": uppercase, no spaces/dashes), plateDisplay, vehicleClassCode, customerId | null, visitCount, completedVisits, totalSpentCents, firstSeenAt, lastSeenAt, lastServiceSummary, loyaltyProgress`
Read: same brand. Write: API.

## Operations

### `orders/{orderId}`
```
brandId, locationId, number ("KTB-261115-007" assigned at checkout) | null, ticket (daily short no. "#12"),
plateKey, plateDisplay, customerId | null, customerName | null, customerPhone | null, returning: bool,
lines: [{ itemId, kind, code, name, unitPriceCents, qty, totalCents }],
subtotalCents, discountCents, discountReason | null, taxCents, totalCents, paidCents,
status: "QUEUED"|"IN_PROGRESS"|"READY"|"COMPLETED"|"CANCELLED",
statusHistory: [{ status, at, by }], assignedEmployeeId | null,
shiftId | null (set at checkout), businessDate, createdAt, createdBy, completedAt | null,
cancelReason | null, backdated: bool, source: "counter"|"floor"|"import", idempotencyKey
```
Read: same brand + location (C), all (O/M/A). Write: API only.
Indexes: (brandId, locationId, businessDate desc, createdAt desc); (brandId, locationId, status, createdAt); (brandId, plateKey, createdAt desc); (brandId, customerId, createdAt desc); (brandId, shiftId, status).

### `payments/{paymentId}` (append-only)
`brandId, locationId, orderId, shiftId, businessDate, method ("CASH"|"CARD"|"BANK_TRANSFER"|"OTHER"), amountCents (negative for refund/reversal), reversesId | null, reason | null, receivedBy, createdAt, idempotencyKey`
Read: O/M/A, C for own location. Write: API. Update/delete: denied.
Indexes: (brandId, shiftId, createdAt); (brandId, locationId, businessDate).

### `counters/{brandId}__{locationId}__{name}`
`value` (receipt seq per day: name `receipt-YYYYMMDD`; ticket per day; invoice running number)
Read: none. Write: API.

### `idempotency/{key}`
`uid, route, requestHash, statusCode, response, createdAt, expiresAt` (TTL policy on `expiresAt`, 7 days)
Read: none. Write: API.

## Shifts & cash

### `shifts/{shiftId}`
```
brandId, locationId, status: "OPEN"|"CLOSED"|"APPROVED"|"QUERIED",
openedBy (uid), supervisorEmployeeId, supervisorName, openedAt, businessDate,
checklistId, openingCount: { notes: { "500000": 2, ... }, coinsCents }, openingCents, carryoverNotes,
closeId | null, closedAt | null, approvalId | null, backdated: bool
```
Read: O/M/A, C same location. Write: API.
Indexes: (brandId, locationId, openedAt desc); (brandId, status, closedAt desc).

### `checklists/{id}` (append-only)
`brandId, locationId, shiftId | null, kind ("PRE_SHIFT"|"REQUEST"), stock [{itemId, name, status: "OK"|"LOW"}], equipment [{itemId, name, status: "OK"|"FAULT"}], notes, createdBy, createdAt`
Write: API. Also updates `stockStatus/{brandId}__{locationId}` (current state, for the banner) and creates `alerts`.

### `cashMovements/{id}` (append-only)
`brandId, locationId, shiftId, businessDate, type ("EXPENSE"|"DEPOSIT"), categoryId, categoryCode, categoryName, amountCents (negative when reversing), paidTo, description, approvedByEmployeeId | null, reversesId | null, reason | null, backdated, createdBy, createdAt, idempotencyKey`
Read: O/M/A, C same location. Write: API.

### `shiftCloses/{id}` (append-only; one primary per shift, plus adjustments)
```
brandId, locationId, shiftId, kind: "CLOSE"|"ADJUSTMENT", adjustsId | null,
openingCents, cashSalesCents, cardSalesCents, otherSalesCents, expensesCents, depositsCents,
expectedCents, countedCents, varianceCents, closingCount {notes, coinsCents},
vehicleCount, notes, overrideByEmployeeId | null, handoverEmployeeId, handoverName,
closedBy, createdAt, reason (adjustments)
```
Read: O/M/A, C same location (own shift). Write: API.

### `shiftApprovals/{id}` (append-only)
`brandId, shiftId, decision ("APPROVED"|"QUERIED"), note, by, createdAt`
Read: O/M/A. Write: API (A, O).

### `alerts/{id}`
`brandId, locationId, kind ("LOW_STOCK"|"EQUIPMENT_FAULT"|"VARIANCE"|"LARGE_DISCOUNT"), severity, message, refType, refId, createdAt, acknowledgedBy[]`
Read: O/M (all), C (location). Write: API. Clients may append their uid to `acknowledgedBy` only (rule-checked).

## HR & payroll

### `attendance/{employeeId}__{date}`
`brandId, locationId, employeeId, date, status ("PRESENT"|"LATE"|"HALF_DAY"|"ABSENT"|"LEAVE"), clockInAt | null, clockOutAt | null, note, updatedBy`
Read: O/M/A; C own. Write: API (M marks; PIN sign-in auto clock-in when enabled).

### `leaves/{id}`
`brandId, employeeId, employeeName, startDate, endDate, days, reason, status ("PENDING"|"APPROVED"|"REJECTED"|"CANCELLED"), processedBy | null, processedAt | null, createdBy, createdAt`
Read: O/M; C own. Write: API.

### `payrollAdjustments/{id}` (append-only)
`brandId, employeeId, period (YYYY-MM), date, kind ("DEDUCTION"|"BONUS"), category ("FOOD"|"ACCOMMODATION"|"ADVANCE"|"PENALTY"|"OTHER"|…), amountCents, reason, reversesId | null, createdBy, createdAt`
Read: O/M/A. Write: API.

### `payrollRuns/{id}` (append-only)
```
brandId, period, kind: "REGULAR"|"SUPPLEMENTARY", supersedesId | null, settingsSnapshot,
lines: [{ employeeId, name, code, jobTitle, baseCents, incentiveCents, incentiveBreakdown [{date, count, tierTarget, bonusCents, multiplier}],
          bonusAdjCents, recurringAdditionCents, recurringDeductionCents, oneOffDeductionCents, deductionBreakdown[],
          epfEmployeeCents, epfEmployerCents, etfEmployerCents, netCents }],
totals { grossCents, deductionsCents, netCents, employerCostCents }, finalizedBy, createdAt
```
Read: O/M/A. Write: API (O/M finalize).

## Invoices (B2B) & receipts

### `billingCustomers/{id}`
`brandId, name, address, phone, email, taxId` Read: O/M/A. Write: API.

### `invoices/{id}` (append-only)
`brandId, locationId, number, kind ("CUSTOM"), billingCustomerId, customerSnapshot, date, lines [{description, qty, unitPriceCents, totalCents}], subtotalCents, discountCents, taxCents, totalCents, voidsId | null, voidReason, createdBy, createdAt`
### `invoiceSettlements/{id}` (append-only)
`brandId, invoiceId, amountCents, method, note, reversesId, createdBy, createdAt`
Paid status = Σ settlements ≥ total (derived).

## Audit

### `auditLogs/{id}` (append-only)
`brandId, locationId | null, at, actorUid, actorName, actorRole, action ("order.create"…), entity, entityId, before | null, after | null, reason | null, requestId, ip, deviceId | null`
Read: O/M (A read-only for finance entities). Write: API. Update/delete: denied.
Indexes: (brandId, at desc); (brandId, entity, at desc); (brandId, actorUid, at desc); (brandId, action, at desc).

## Derived / read models

### `dailyStats/{brandId}__{locationId}__{date}`
`completedCount, revenueCents, byMethod {CASH, CARD,…}, byHour [24], byItem {code: {qty, revenueCents}}, newCustomers, returningCustomers, avgTicketCents`
Updated by the API in the checkout transaction (increments). Reversals decrement. Dashboards read this instead of scanning orders.
Read: O/M/A. Write: API.

## Storage
- `brands/{brandId}/branding/logo.*`: public read, O write via API-signed upload.
- `exports/{brandId}/…`: generated files (future server exports). Read O/M/A.
