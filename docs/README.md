# Documentation

Every STTPS repository uses the same documentation layout. Start with the core documents, then the decision records and runbooks.

## Core

| Document | Covers |
| --- | --- |
| [ARCHITECTURE.md](ARCHITECTURE.md) | How the system is built, its components and how data flows |
| [CONFIGURATION.md](CONFIGURATION.md) | Environment variables, configuration files and where each value lives |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Hosting, the delivery pipeline, first-time setup and post-deployment checks |

## Decisions and operations

| Document | Covers |
| --- | --- |
| [adr/](adr/README.md) | Architecture decision records |
| [runbooks/](runbooks/README.md) | Release and rollback procedures |

## Product and reference

| Document | Covers |
| --- | --- |
| [DATA-MODEL.md](DATA-MODEL.md) | Collections, fields and indexes |
| [I18N-REVIEW.md](I18N-REVIEW.md) | Sinhala and Tamil translation review notes |
| [PARITY.md](PARITY.md) | Feature parity with the legacy SWOMS system |
| [PRD.md](PRD.md) | Product requirements |
| [PROGRESS.md](PROGRESS.md) | Project status, owner actions, known issues and the build log |

## Conventions

- Top-level documents use `UPPER-KEBAB-CASE.md`; documents inside folders use `lower-kebab-case.md`.
- Update the relevant document in the same pull request as the change it describes.
- Record significant technical decisions as ADRs rather than editing older documents.
