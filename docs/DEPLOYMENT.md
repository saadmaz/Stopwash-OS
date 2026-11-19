# Deployment

<!-- nav -->
<sub><a href="../README.md">Project README</a> · <a href="README.md">Documentation index</a></sub>

> How STOPWASH OS is packaged and taken to production. Part of the [project documentation](README.md).

## Environments

| Environment | Branch | Image | Deploys |
| --- | --- | --- | --- |
| `development` | `develop` | `ghcr.io/saadmaz/stopwash-os-api:development` | Automatically on every merge into `develop` |
| `production` | `main` | `ghcr.io/saadmaz/stopwash-os-api:latest` | Automatically when `develop` is promoted to `main` by a release pull request |

The Deploy workflow builds the API image and publishes it to GitHub Packages, tagged per environment. Each environment is a GitHub Environment with its own variables (`APP_URL` and host settings) and secrets, so one workflow serves both. Production accepts deployments from `main` only; development from `develop` only.

### Setting up development

Point the development host at the `development` image tag. No variable is needed; development images publish on every push to `develop`.

### Promotion

1. Feature branches merge into `develop` and deploy to development.
2. When development is verified, open a release pull request from `develop` into `main` (see [runbooks/release.md](runbooks/release.md)).
3. Merging it deploys to production.

## Status

Production hosting is not live yet. The API refuses to start with `NODE_ENV=production` until Firebase is wired up; the outstanding work is listed under [Owner actions](PROGRESS.md#owner-actions).

## API container

```sh
docker build -f apps/api/Dockerfile -t stopwash-api .
```

This is a multi-stage image with production dependencies only. It runs as the non-root `node` user, listens on port 8080 and has a `/health` healthcheck. All configuration comes from environment variables at run time. In production (`NODE_ENV=production`) the API refuses to start until Firebase is wired: it needs `DATA_BACKEND=firestore`, `AUTH_ISSUER=firebase` and `DEV_SEED=false` (see **Owner actions** in [PROGRESS](PROGRESS.md#owner-actions)). CI builds the image and smoke-tests `/health`.

## Production configuration

| Variable | Production value |
| --- | --- |
| `NODE_ENV` | `production` |
| `DATA_BACKEND` | `firestore` |
| `AUTH_ISSUER` | `firebase` |
| `DEV_SEED` | `false` |
| `CORS_ORIGINS` | The deployed web origin |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to the mounted service-account file |
| `VITE_API_URL` (web build) | The deployed API origin |

## Web application

`pnpm build` produces a static PWA in `apps/web/dist`, which can be served from any static host or CDN. Set `VITE_API_URL` at build time.

## Firebase

Firestore and Storage rules and indexes live in `firebase/`. Deploy them with the Firebase CLI once the production project exists, and run `pnpm test:rules` against the emulator first.
