# ADR-0021: PDFs generated client-side with jsPDF (vector text)

<!-- nav -->
<sub><a href="../../README.md">Project README</a> · <a href="../README.md">Documentation index</a></sub>

| Status | Date |
| --- | --- |
| Accepted | 2026-11-15 |

## Decision

Receipts, daily revenue, reconciliation, salary slips, attendance and invoices are built with `jspdf` + `jspdf-autotable` in a lazily loaded chunk. Fonts are embedded for Sinhala/Tamil names.

## Alternatives considered

Server-side PDF (Puppeteer: heavy container); html2canvas (old: blurry, large files).

## Rationale

Works offline and keeps the API container small.
