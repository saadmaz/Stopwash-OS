# Deployment

> How STOPWASH POS is packaged and taken to production. Part of the [project documentation](README.md).

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
