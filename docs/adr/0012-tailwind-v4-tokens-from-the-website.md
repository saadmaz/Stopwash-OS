# ADR-0012: Tailwind v4 + tokens from the website

<!-- nav -->
<sub><a href="../../README.md">Project README</a> · <a href="../README.md">Documentation index</a></sub>

| Status | Date |
| --- | --- |
| Accepted | 2026-11-15 |

## Decision

Tailwind CSS v4 (same as the website), with tokens defined as CSS variables in `packages/ui/src/tokens.css` plus a TS export for charts and PDFs. Fonts: Space Grotesk (display), Inter (UI), Noto Sans Sinhala and Noto Sans Tamil as fallbacks in the stack, all self-hosted via `@fontsource` so they work offline.

## Alternatives considered

None recorded.

## Rationale

It's the same brand system as stopwash.lk, and the self-hosted fonts work offline in the PWA.
