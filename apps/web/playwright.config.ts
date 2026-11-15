import { defineConfig, devices } from '@playwright/test';

/** Local-only test values: in-memory API with the dev seed, never a real project. */
const API_ENV = {
  NODE_ENV: 'development',
  PORT: '8080',
  LOG_LEVEL: 'silent',
  DATA_BACKEND: 'memory',
  DEV_SEED: 'true',
  DEV_DEVICE_ID: 'dev-counter',
  DEV_DEVICE_SECRET: 'dev-counter-secret-change-me',
  FIREBASE_PROJECT_ID: 'demo-stopwash',
  AUTH_ISSUER: 'dev',
  AUTH_DEV_SECRET: 'e2e-only-secret-e2e-only-secret-0000',
  CORS_ORIGINS: 'http://localhost:5173,http://127.0.0.1:5173',
  DEFAULT_BRAND_ID: 'stopwash',
};

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'tablet', use: { ...devices['Galaxy Tab S9'] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : [
        {
          command: 'pnpm --filter @stopwash/api exec tsx src/server.ts',
          url: 'http://localhost:8080/health',
          env: API_ENV,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
        {
          command: 'pnpm dev',
          url: 'http://localhost:5173',
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      ],
});
