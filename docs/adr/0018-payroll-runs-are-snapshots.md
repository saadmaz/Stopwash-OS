# ADR-0018: Payroll runs are snapshots

| Status | Date |
| --- | --- |
| Accepted | 2026-11-15 |

## Decision

Draft payroll is computed on demand (API `GET /payroll/preview?period=`). "Finalize" writes an immutable `payrollRuns` doc with every line and its inputs. Salary slips render from the run. A correction is a supplementary run that references the original.

## Alternatives considered

None recorded.

## Rationale

Not recorded.
