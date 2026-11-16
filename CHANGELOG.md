# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Versions below `1.0.0` are pre-production. The step-by-step build log is in [docs/PROGRESS.md](docs/PROGRESS.md).

## [Unreleased]

## [0.1.0] - 2026-11-16

First pre-production release. Feature-complete on the in-memory backend; production requires the Firebase integration listed under [Owner actions](docs/PROGRESS.md#owner-actions).

### Added

- **Counter:** New Order with live server-side pricing, plate and customer typeahead, and a loyalty indicator.
- **Queue:** status flow, edits, cancellations and refunds, plus the wall TV board (`/tv`) and customer display (`/display`).
- **Checkout:** cash, card and split payments, discounts with manager override, loyalty redemption, receipts and PDFs.
- **Shifts and cash:** opening checklist and cash count, cash-outs with approvals, close and reconciliation with handover, and shift history with corrections.
- **Accounts:** approvals and queries, B2B invoices with settlements, voids and PDF.
- **People:** staff, per-employee PINs on registered devices, attendance and leave, incentive rules, deductions, bonuses and payroll runs with salary slips.
- **Reporting:** daily reports, CSV and revenue PDF exports, and an owner dashboard with sales, retention and an hourly heatmap.
- **Settings:** business profile, loyalty, pricing, thresholds, receipt footer, payroll rules and alert numbers.
- Vehicle history, live manager alerts and an offline order outbox.
- English, Sinhala and Tamil throughout.
- Fastify API enforcing all pricing, money and permission rules, with integer-cent money, Asia/Colombo business days, idempotent writes, append-only financial records and an audit log.
- Multi-stage, non-root API container with a `/health` check.
- Firestore and Storage deny-all baseline rules and emulator configuration.
- Design system and screen designs in Figma.
- Continuous integration: type check, lint, formatting, unit and API tests, build, Playwright end-to-end shift day and container smoke test.
- Project governance: proprietary licence, security policy, contribution guidelines, code of conduct, issue forms, pull request template, CODEOWNERS and Dependabot.

[Unreleased]: https://github.com/saadmaz/Stopwash-POS/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/saadmaz/Stopwash-POS/releases/tag/v0.1.0
