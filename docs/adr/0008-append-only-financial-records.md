# ADR-0008: Append-only financial records

<!-- nav -->
<sub><a href="../../README.md">Project README</a> · <a href="../README.md">Documentation index</a></sub>

| Status | Date |
| --- | --- |
| Accepted | 2026-11-15 |

## Decision

`payments`, `cashMovements`, `shiftCloses`, `shiftApprovals`, `payrollRuns`, `payrollAdjustments`, `invoices`, `invoiceSettlements` and `auditLogs` are never updated or deleted. Corrections are new documents with `reversesId` (reversal) and, where needed, a replacement entry. Rules deny update/delete on them for every client, and the API has no endpoints that update them.

## Alternatives considered

None recorded.

## Rationale

This is an explicit requirement, and it makes the accounts approval meaningful.

## Notes

- **Old behaviour replaced:** edit/delete expense, edit completed-order payment, edit session, delete session, clear all history, delete invoice, toggle invoice paid.
