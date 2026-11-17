# ADR-0038: Offline orders: device outbox, server assigns on arrival

| Status | Date |
| --- | --- |
| Accepted | 2026-11-15 |

## Decision

When New Order cannot reach the API, the order is stored in an IndexedDB outbox on the device with the idempotency key it was first sent with. It replays in order when the connection returns (on the `online` event, then every 30 s) and stops at the first network failure. A server rejection (e.g. no open shift) is kept and flagged for the cashier to resolve or discard, never retried blindly. The ticket number, business date and price are assigned by the server when the order arrives. Checkout, cash and shift actions stay online-only.

## Alternatives considered

None recorded.

## Rationale

Taking cars in must not stop during an outage. Money movements need the server's checks (pricing, overrides, drawer totals), and the reused key guarantees exactly-once creation.
