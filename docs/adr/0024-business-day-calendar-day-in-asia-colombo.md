# ADR-0024: Business day = calendar day in Asia/Colombo

| Status | Date |
| --- | --- |
| Accepted | 2026-11-15 |

## Decision

`businessDate` (YYYY-MM-DD) is computed from the server timestamp in `Asia/Colombo` and stored on orders, payments and cash movements. All "today" queries use it. Sri Lanka has no DST, so +05:30 holds all year, but the code still uses the IANA zone.

## Alternatives considered

None recorded.

## Rationale

Not recorded.
