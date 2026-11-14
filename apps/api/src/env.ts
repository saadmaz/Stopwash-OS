import { z } from 'zod';

const bool = z.enum(['true', 'false', '1', '0']).transform((v) => v === 'true' || v === '1');

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8080),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  LOG_PRETTY: bool.default(false),

  /** memory (default, dev/tests) or firestore (stub until Firebase is configured). */
  DATA_BACKEND: z.enum(['memory', 'firestore']).default('memory'),

  FIREBASE_PROJECT_ID: z.string().min(1).default('demo-stopwash'),
  /** Set when running against the Emulator Suite, e.g. "127.0.0.1:8081". */
  FIRESTORE_EMULATOR_HOST: z.string().optional(),
  FIREBASE_AUTH_EMULATOR_HOST: z.string().optional(),
  /** Path to a service-account JSON file (production only, never committed). */
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),

  /** Comma-separated list of allowed browser origins. */
  CORS_ORIGINS: z.string().default('http://localhost:5173,http://127.0.0.1:5173'),
  DEFAULT_BRAND_ID: z.string().default('stopwash'),

  /** dev = signed JWT (AUTH_DEV_SECRET); firebase = custom tokens (stub until configured). */
  AUTH_ISSUER: z.enum(['dev', 'firebase']).default('dev'),
  AUTH_DEV_SECRET: z.string().min(32).optional(),

  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  PIN_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  PIN_LOCKOUT_MINUTES: z.coerce.number().int().positive().default(15),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment: ${issues}`);
  }
  const env = parsed.data;
  if (env.NODE_ENV === 'production' && env.FIRESTORE_EMULATOR_HOST) {
    throw new Error('FIRESTORE_EMULATOR_HOST must not be set in production');
  }
  if (env.NODE_ENV === 'production' && env.AUTH_ISSUER === 'dev') {
    throw new Error('AUTH_ISSUER=dev is not allowed in production');
  }
  if (env.NODE_ENV !== 'production' && !env.FIREBASE_PROJECT_ID.startsWith('demo-')) {
    // Guard against accidentally pointing local work at a real project.
    throw new Error('Non-production runs must use a demo- project id (emulators only)');
  }
  return env;
}

export function corsOrigins(env: Env): string[] {
  return env.CORS_ORIGINS.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
