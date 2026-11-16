# ADR-0014: Receipt numbering

| Status | Date |
| --- | --- |
| Partially superseded by [ADR-0033](0033-receipt-numbers-keep-the-swoms-format.md) | 2026-11-15 |

## Decision

Server counter document per location per business day, incremented in the checkout transaction. Format `{locationCode}-{YYMMDD}-{seq:3}`, e.g. `KTB-261115-007`. Custom B2B invoices use a separate running counter seeded at 55100 (old value).

## Alternatives considered

None recorded.

## Rationale

The old DDMM+count was computed client-side and could collide.
