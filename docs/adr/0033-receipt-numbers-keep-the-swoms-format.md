# ADR-0033: Receipt numbers keep the SWOMS format (supersedes the format in ADR-0014)

| Status | Date |
| --- | --- |
| Accepted | 2026-11-15 |

## Decision

Receipt number = `DDMM` + 3-digit daily sequence (e.g. `1511007`), from a server counter per location per business day, assigned in the checkout transaction. The order id stays the unique key; the number is what staff and customers read.

## Alternatives considered

None recorded.

## Rationale

The product plan asks for DDMM+seq. Moving the counter to the server removes the old collision risk.
