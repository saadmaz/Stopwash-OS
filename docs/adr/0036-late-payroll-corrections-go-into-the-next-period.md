# ADR-0036: Late payroll corrections go into the next period

<!-- nav -->
<sub><a href="../../README.md">Project README</a> · <a href="../README.md">Documentation index</a></sub>

| Status | Date |
| --- | --- |
| Accepted | 2026-11-15 |

## Decision

Once a period's REGULAR payroll run is finalized, new deductions and bonus adjustments dated in that period are refused. They are dated into the next month instead. A SUPPLEMENTARY run re-snapshots the period's lines (e.g. after late attendance or order corrections) and references the run it supersedes.

## Alternatives considered

None recorded.

## Rationale

A finalized payslip stays reproducible exactly as paid, which is the usual practice for small payrolls.
