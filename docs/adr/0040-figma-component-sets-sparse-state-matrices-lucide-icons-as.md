# ADR-0040: Figma component sets: sparse state matrices, lucide icons as swaps

<!-- nav -->
<sub><a href="../../README.md">Project README</a> · <a href="../README.md">Documentation index</a></sub>

| Status | Date |
| --- | --- |
| Accepted | 2026-11-15 |

## Decision

A component set shows every Variant × Size in the Default state, and Hover / Focus / Disabled only at the default size (Button: 24 + 18 = 42 variants, not 96). Icons are the 80 lucide glyphs the apps and website import, built from `lucide-react` 1.73 path data as 24 px components whose stroke is bound to `color/fg`. Components swap them through an INSTANCE_SWAP property, never one variant per icon. Focus is the `Focus/ring` effect (3 px, `color/ring`) on filled controls, and a 2 px outside stroke in `color/ring` on unfilled ones (ghost, link), where a shadow can't render.

## Alternatives considered

None recorded.

## Rationale

The full matrix is unusable in the variant picker, and states look the same at every size. Swapping real lucide paths keeps Dev Mode output matching the `lucide-react` imports.
