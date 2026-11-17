# ADR-0039: Figma tokens mirror tokens.css, not tokens.ts

<!-- nav -->
<sub><a href="../../README.md">Project README</a> · <a href="../README.md">Documentation index</a></sub>

| Status | Date |
| --- | --- |
| Accepted | 2026-11-15 |

## Decision

The Figma file has four variable collections. Primitives holds every distinct hex in `packages/ui/src/tokens.css`, hidden from publishing. Color holds the 32 semantic tokens with Light and Dark modes, each aliased to a primitive. Spacing uses the Tailwind 4 px scale plus `size/touch` 44 and `size/touch-lg` 56. Radius covers sm–2xl plus full. Each variable's WEB code syntax is the CSS variable the components use (e.g. `var(--color-fg-muted)`). Borders keep the CSS alpha values (ink or white at 10/18/22%) rather than the opaque approximations in `tokens.ts`. Headings use Space Grotesk Bold where the CSS uses semibold, because Figma has no Space Grotesk Semi Bold. Money and counts get Numeric styles in Inter Semi Bold.

## Alternatives considered

None recorded.

## Rationale

Components read `tokens.css`, and `tokens.ts` only serves canvas/PDF contexts that can't use alpha. Keeping the CSS names makes Dev Mode output paste straight into the code.
