# Configuration

<!-- nav -->
<sub><a href="../README.md">Project README</a> · <a href="README.md">Documentation index</a></sub>

> Environment variables and settings for STOPWASH OS. Part of the [project documentation](README.md).

| Variable | Where | Purpose |
| --- | --- | --- |
| `DATA_BACKEND` | api | `memory` (default) or `firestore` (adapter is a stub until Firebase is wired) |
| `AUTH_ISSUER` | api | `dev` (signed JWT, development only) or `firebase` |
| `AUTH_DEV_SECRET` | api | 32+ random characters for dev tokens |
| `DEV_SEED` | api | load demo staff/catalog in memory (refused in production) |
| `CORS_ORIGINS` | api | comma-separated web origins |
| `PIN_MAX_ATTEMPTS`, `PIN_LOCKOUT_MINUTES` | api | PIN lockout policy |
| `VITE_API_URL` | web | API base URL (`apps/web/.env.local`) |

Business settings (prices, thresholds, receipt footer, business profile, loyalty, payroll rules, WhatsApp alert numbers) live in the app under **Settings**, not in env files.

## Environment files

| App | File | Template |
| --- | --- | --- |
| API | `apps/api/.env` | `apps/api/.env.example` |
| Web | `apps/web/.env.local` | `apps/web/.env.example` |

Never commit `.env` files or service-account keys. In production the API reads its service account from `GOOGLE_APPLICATION_CREDENTIALS`, pointing at a file outside the repository.
