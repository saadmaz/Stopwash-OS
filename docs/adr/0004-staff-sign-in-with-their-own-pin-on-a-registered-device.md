# ADR-0004: Staff sign in with their own PIN on a registered device

<!-- nav -->
<sub><a href="../../README.md">Project README</a> · <a href="../README.md">Documentation index</a></sub>

| Status | Date |
| --- | --- |
| Accepted | 2026-11-15 |

## Decision

A manager registers a tablet or phone once, which stores a device id + secret. Staff then pick their name or type their employee code, and enter a 4–6 digit PIN. The API checks the device secret and the bcrypt PIN hash, rate-limits, locks out after 5 failures for 15 minutes, and returns a Firebase custom token with claims `{role, brandId, locationIds, employeeId}`.

## Alternatives considered

Shared role passcodes (old); email + password for everyone; Firebase phone auth (SMS costs, slow at the counter).

## Rationale

It's individual and auditable, and fast enough for the counter (about 3 seconds). The old shared passcodes are treated as compromised and are not used anywhere.
