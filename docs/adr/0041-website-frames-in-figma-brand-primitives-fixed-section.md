# ADR-0041: Website frames in Figma: brand primitives, fixed section themes, raw overlays

<!-- nav -->
<sub><a href="../../README.md">Project README</a> · <a href="../README.md">Documentation index</a></sub>

| Status | Date |
| --- | --- |
| Accepted | 2026-11-15 |

## Decision

The stopwash.lk frames use the brand primitives directly (ink, navy, lime, paper, white, leaf, plus a new `web/muted` #5A6372), not the POS Light/Dark semantic modes. That's because the site's section themes (light, paper, dark navy, lime) are fixed per section, as in its `styles.css`. A Website kit on the Design System page holds Logo, CTA (lime/ink/outline/link), Navbar (desktop/mobile, over a photo or light) and Footer, plus `Web/*` text styles that mirror `text-hero`, `text-h1`, `text-h2`, `text-h3`, `text-lead` and `eyebrow`, with desktop and mobile sizes from their clamps. Translucent overlays (white or ink at 4–95%) are raw paints with opacity, not variable-bound, because Figma dropped the paint opacity on variable-bound paints inside instances. The four site photos are uploaded as JPEG, because Figma accepted the WebP files but didn't render them.

## Alternatives considered

None recorded.

## Rationale

This matches how the website is actually themed, keeps instances rendering correctly, and leaves solid colours bound to tokens.
