# ADR-0037: Route-level code splitting and lazy locales

<!-- nav -->
<sub><a href="../../README.md">Project README</a> · <a href="../README.md">Documentation index</a></sub>

| Status | Date |
| --- | --- |
| Accepted | 2026-11-15 |

## Decision

Every screen is a `React.lazy` chunk behind a Suspense skeleton, and jsPDF and Recharts load with the screens that use them. English ships in the main bundle. Sinhala and Tamil load on first switch through a small i18next backend, rendering English meanwhile (no suspense).

## Alternatives considered

None recorded.

## Rationale

The main chunk went from 1.33 MB (394 KB gz) to 578 KB (186 KB gz), which matters on counter tablets on mobile data. The PWA precache still stores every chunk, so offline use is unchanged.
