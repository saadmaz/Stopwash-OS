# ADR-0020: Local dev on emulators in Docker

| Status | Date |
| --- | --- |
| Accepted | 2026-11-15 |

## Decision

The Firebase Emulator Suite runs in a Docker container (`docker compose up emulators`), because the dev machine has no JDK. CI uses the same image. The project id is `demo-stopwash` (the `demo-` prefix means the emulators never touch a real project).

## Alternatives considered

None recorded.

## Rationale

The owner chose it, and it gives the same setup on every machine.
