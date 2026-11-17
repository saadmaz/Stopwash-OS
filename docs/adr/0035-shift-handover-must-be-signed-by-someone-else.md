# ADR-0035: Shift handover must be signed by someone else

| Status | Date |
| --- | --- |
| Accepted | 2026-11-15 |

## Decision

Closing a shift requires the PIN of an incoming supervisor (anyone allowed to open shifts) who is not the person closing. Above the override threshold, a manager PIN is also required. Both are verified before the close transaction (ADR-0034).

## Alternatives considered

None recorded.

## Rationale

SWOMS's handover was meant as a countersignature. Letting the closer sign their own handover would make it meaningless.
