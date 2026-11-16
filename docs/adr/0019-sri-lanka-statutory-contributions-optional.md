# ADR-0019: Sri Lanka statutory contributions optional

| Status | Date |
| --- | --- |
| Accepted | 2026-11-15 |

## Decision

Settings `payroll.statutory = { enabled: false, epfEmployeePct: 8, epfEmployerPct: 12, etfEmployerPct: 3 }`. When enabled, the employee EPF is deducted on the slip, and employer EPF/ETF are shown as employer cost.

## Alternatives considered

None recorded.

## Rationale

The old app didn't do it. The owner can turn it on once they confirm their payroll basis with their accountant.
