# ADR-0043: Figma Foundations page is the design reference

<!-- nav -->
<sub><a href="../../README.md">Project README</a> · <a href="../README.md">Documentation index</a></sub>

| Status | Date |
| --- | --- |
| Accepted | 2026-11-15 |

## Decision

A Foundations page (after Cover) documents everything needed to design new screens: Colour (brand palette, all semantic tokens in Light and Dark, data-viz palette, website themes, rules), Typography (five families, every text style as a specimen, Sinhala/Tamil styles, rules) and Space, shape & layout (spacing, radius, elevation, motion, touch targets, frame sizes and grids, icons, imagery, accessibility and languages). It is backed by new variable collections Typography, Data viz, Motion and Breakpoints, plus Script text styles and Layout grid styles. Values come from `packages/ui` (tokens.css, tokens.ts), `apps/web/src/fonts.ts` and the website's styles.css. Sinhala uses Yaldevi in Figma because Noto Sans Sinhala is not available there.

## Alternatives considered

None recorded.

## Rationale

Components alone don't tell a designer which token, size or frame to pick. Keeping the docs bound to the same variables means they stay correct when a token changes.
