# ADR-0042: Mobile website frames are reflowed clones of the desktop frames

<!-- nav -->
<sub><a href="../../README.md">Project README</a> · <a href="../README.md">Documentation index</a></sub>

| Status | Date |
| --- | --- |
| Accepted | 2026-11-15 |

## Decision

Each 390 px website frame is a clone of its 1440 frame, reflowed by one script that follows the site's Tailwind breakpoints. Section padding goes from 132 to 20 px across and from 112 to 64 px vertical (the `clamp()` minimums). Page heroes keep 128 px top. Side-by-side grids and wrap grids stack into one column, decided from the desktop widths before any resize. Wide text, photos and instances shrink to the column, keeping each photo's aspect ratio. CTA rows go full width, as the site's `flex-col sm:flex-row` does. Mobile type styles (`Web/*-m`) replace the desktop ones, and the mobile Navbar and Footer variants replace the desktop instances. Desktop fixed heights are released so stacked text never clips. Mobile frames sit 11,000 px below their desktop counterparts in the same column.

## Alternatives considered

None recorded.

## Rationale

This keeps copy, imagery and tokens identical between breakpoints and makes the 12 mobile pages repeatable. A change to a desktop frame can be re-run through the same script.
