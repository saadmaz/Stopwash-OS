<div align="center">

# STOPWASH POS

**Point-of-sale and operations platform for the STOPWASH vehicle-care network.**

Counter orders, the live queue, checkout, shifts and cash reconciliation, staff and payroll, reports and loyalty, in English, Sinhala and Tamil.

![Status](https://img.shields.io/badge/status-pre--production-374151?style=flat-square&labelColor=111827)
[![CI](https://github.com/saadmaz/Stopwash-POS/actions/workflows/ci.yml/badge.svg)](https://github.com/saadmaz/Stopwash-POS/actions/workflows/ci.yml)
[![Version](https://img.shields.io/badge/version-v0.2.0-374151?style=flat-square&labelColor=111827)](https://github.com/saadmaz/Stopwash-POS/releases)
![License](https://img.shields.io/badge/license-proprietary-374151?style=flat-square&labelColor=111827)

[**Project status**](docs/PROGRESS.md) · [Documentation](docs/README.md) · [Report a bug](https://github.com/saadmaz/Stopwash-POS/issues/new?template=bug_report.yml) · [Request a change](https://github.com/saadmaz/Stopwash-POS/issues/new?template=feature_request.yml)

</div>

---

## Contents

- [About](#about)
- [Features](#features)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Project structure](#project-structure)
- [Quality checks](#quality-checks)
- [Deployment](#deployment)
- [Documentation](#documentation)
- [Releases and versioning](#releases-and-versioning)
- [Contributing](#contributing)
- [Security](#security)
- [License](#license)

## About

STOPWASH POS runs the STOPWASH outlet in Katubedda, Sri Lanka, and is built to scale across the network. Progress, owner actions and known issues are tracked in [docs/PROGRESS.md](docs/PROGRESS.md).

| | |
| --- | --- |
| **Organisation** | STOPWASH PVT LTD |
| **Status** | Pre-production: feature-complete on the in-memory backend, Firebase integration pending |
| **Contact** | [hello@stopwash.lk](mailto:hello@stopwash.lk) |
| **Maintainer** | [Saad Mazhar](https://github.com/saadmaz) |

## Features

- **Counter:** New Order with live server-side pricing, plate and customer typeahead, and a loyalty indicator.
- **Queue:** status flow, edits, cancellations and refunds, a wall TV board (`/tv`) and a customer-facing display (`/display`).
- **Checkout:** cash, card and split payments, discounts with manager override, loyalty redemption, receipts and PDFs.
- **Shifts and cash:** opening checklist and cash count, cash-outs with approvals, close and reconciliation with signed handover.
- **Accounts:** approvals and queries, B2B invoices with settlements, voids and PDF.
- **People:** per-employee PINs on registered devices, attendance and leave, incentives, deductions, bonuses and payroll runs with salary slips.
- **Reporting:** daily reports, CSV and PDF exports, and an owner dashboard with sales, retention and an hourly heatmap.
- **Resilience:** an offline order outbox, live manager alerts and audit-logged, append-only financial records.
- **Languages:** English, Sinhala and Tamil throughout.

## Architecture

A pnpm monorepo: a React PWA (`apps/web`) talks to a Fastify API (`apps/api`) that enforces every pricing, money and permission rule. Shared types, schemas, money and RBAC logic live in `packages/shared`, and design tokens and components in `packages/ui`. Storage sits behind repository interfaces with in-memory adapters today and Firestore adapters next.

The full picture, with diagrams, is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Significant decisions are recorded as [ADRs](docs/adr/README.md).

## Tech stack

| Layer | Technology |
| --- | --- |
| Web | React 18, Vite, PWA, Radix and Tailwind CSS v4 (`packages/ui`) |
| API | Fastify, Zod, signed JWT (development) or Firebase custom tokens |
| Shared | TypeScript domain package: money in integer LKR cents, Asia/Colombo dates, RBAC, pricing, payroll |
| Data | Repository layer; in-memory adapters now, Cloud Firestore next |
| Packaging | Multi-stage, non-root Docker image for the API |
| Tooling | pnpm workspaces, Vitest, Playwright, ESLint, Prettier |

## Getting started

### Prerequisites

- Node.js 22
- pnpm 9 (`corepack enable` picks up the pinned version)

### Install and run

```sh
git clone https://github.com/saadmaz/Stopwash-POS.git
cd Stopwash-POS
pnpm install
pnpm --filter @stopwash/api dev     # http://localhost:8080, in-memory data with the dev seed
pnpm --filter @stopwash/web dev     # http://localhost:5173
```

On first open, register the device (id `dev-counter`, secret `dev-counter-secret-change-me`), then pick a staff member. Development PINs exist only in the in-memory seed, which production refuses to load:

| Dev user | Role | PIN |
| --- | --- | --- |
| Saman Jayasuriya | owner | 6142 |
| Dilani Fernando | manager | 7391 |
| Ruwan Silva | accounts | 5038 |
| Kasun Perera | cashier (supervisor) | 4826 |
| Tharindu Bandara | cashier | 3517 |

### Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Start the API and web app together |
| `pnpm build` | Build every package |
| `pnpm lint` | Lint with ESLint |
| `pnpm typecheck` | Type-check every package |
| `pnpm format` / `format:check` | Format with Prettier, or check without writing |
| `pnpm test` | Unit and API tests |
| `pnpm test:e2e` | Playwright: a full shift day; starts the API and web itself |
| `pnpm test:rules` | Firestore rules tests (needs the emulator) |

## Configuration

The API is configured by environment variables in `apps/api/.env` (data backend, auth issuer, dev seed, CORS and PIN lockout policy); the web app needs only `VITE_API_URL`. Business settings such as prices, thresholds, payroll rules and alert numbers are managed in the app under **Settings**.

Every variable, where it is set and which are secret: [docs/CONFIGURATION.md](docs/CONFIGURATION.md).

## Project structure

```
.
├── .github/              # CI, issue and pull request templates
├── apps/
│   ├── api/              # Fastify API: pricing, money, permissions, persistence
│   └── web/              # React PWA: counter tablets, back office, /tv, /display
├── packages/
│   ├── shared/           # Types, schemas, money, dates, RBAC, pricing, payroll
│   └── ui/               # Design tokens and accessible components
├── firebase/             # Firestore and Storage rules, indexes and rules tests
├── docker/               # Local emulator setup
└── docs/                 # Architecture, configuration, deployment, ADRs, runbooks and product docs
```

## Quality checks

Every push and pull request to `main` runs the [CI workflow](.github/workflows/ci.yml): lint, formatting, type check, unit and API tests and a build, followed by a Playwright end-to-end shift day and an API container smoke test. Run the same checks locally before opening a pull request:

```sh
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build
pnpm test:e2e
```

## Deployment

| Environment | Branch | Image |
| --- | --- | --- |
| Development | `develop` | `ghcr.io/saadmaz/stopwash-pos-api:development` |
| Production | `main` | `ghcr.io/saadmaz/stopwash-pos-api:latest` |

The Deploy workflow builds the API image and publishes it to GitHub Packages, tagged per environment. Work merges into `develop` and deploys to development; a release pull request from `develop` into `main` deploys to production.

Environments, setup, secrets and post-deployment checks are in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). To release or roll back, follow the [runbooks](docs/runbooks/README.md).

## Documentation

All documentation lives in [`docs/`](docs/README.md), using the same layout in every STTPS repository.

| Document | Covers |
| --- | --- |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the system is built and how data flows |
| [CONFIGURATION.md](docs/CONFIGURATION.md) | Environment variables and configuration files |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Hosting, the delivery pipeline and first-time setup |
| [adr/](docs/adr/README.md) | Architecture decision records |
| [runbooks/](docs/runbooks/README.md) | Release and rollback procedures |

Product and reference documents for this project are listed in the [documentation index](docs/README.md).

## Releases and versioning

The project follows [Semantic Versioning](https://semver.org). Each release is tagged `vX.Y.Z` and published on the [Releases](https://github.com/saadmaz/Stopwash-POS/releases) page. Versions below `1.0.0` are pre-production. Notable changes are recorded in [CHANGELOG.md](CHANGELOG.md), and the release procedure is in [docs/runbooks/release.md](docs/runbooks/release.md).

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) for the branching model, commit conventions and pull request checklist. All participants are expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Security

Please do not report security issues in public issues. See [SECURITY.md](SECURITY.md) for how to report a vulnerability privately.

## License

Copyright © 2026 STOPWASH PVT LTD. All rights reserved.

This is proprietary software. The source is publicly visible, but no permission is granted to use, copy, modify or distribute it without prior written consent. See [LICENSE](LICENSE).
