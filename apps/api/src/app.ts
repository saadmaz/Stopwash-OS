import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { corsOrigins, type Env } from './env';
import { AppError, isAppError } from './lib/errors';
import { NotImplementedError } from './lib/not-implemented';
import { healthRoutes } from './routes/health';
import { authRoutes } from './routes/auth';
import { meRoutes } from './routes/me';
import { configRoutes } from './routes/config';
import { adminConfigRoutes } from './routes/admin-config';
import { createTokenIssuer, type AuthTokenIssuer } from './services/tokens';
import { createDataStore, type DataStore } from './repos';

export interface BuildOptions {
  env: Env;
  /** Storage backend; defaults to the one selected by DATA_BACKEND. */
  store?: DataStore;
  tokens?: AuthTokenIssuer;
  /** Extra route plugins (tests use this to mount fakes). */
  plugins?: Array<(app: FastifyInstance) => Promise<void>>;
}

export async function buildApp({
  env,
  store,
  tokens,
  plugins = [],
}: BuildOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger:
      env.LOG_LEVEL === 'silent'
        ? false
        : {
            level: env.LOG_LEVEL,
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'req.body.pin',
                'req.body.overridePin',
                'req.body.deviceSecret',
              ],
              censor: '[redacted]',
            },
            ...(env.LOG_PRETTY ? { transport: { target: 'pino-pretty' } } : {}),
          },
    genReqId: (req) => (req.headers['x-request-id'] as string | undefined) ?? randomUUID(),
    bodyLimit: 256 * 1024,
    trustProxy: true,
  });

  app.decorate('env', env);
  app.decorate('store', store ?? createDataStore(env));
  app.decorate('tokens', tokens ?? createTokenIssuer(env, app.log));

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: corsOrigins(env),
    allowedHeaders: [
      'authorization',
      'content-type',
      'idempotency-key',
      'x-request-id',
      'x-device-id',
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: '1 minute',
    errorResponseBuilder: (_req, ctx) =>
      new AppError('RATE_LIMITED', `Too many requests, retry in ${Math.ceil(ctx.ttl / 1000)}s`),
  });

  app.addHook('onSend', async (req, reply) => {
    reply.header('x-request-id', req.id);
  });

  app.setNotFoundHandler((req, reply) => {
    reply
      .status(404)
      .send({ error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.url} not found` } });
  });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof NotImplementedError) {
      req.log.warn({ err }, err.message);
      return reply.status(501).send({ error: { code: 'NOT_IMPLEMENTED', message: err.message } });
    }
    if (isAppError(err)) {
      if (err.statusCode >= 500) req.log.error({ err }, err.message);
      else req.log.info({ code: err.code }, err.message);
      return reply
        .status(err.statusCode)
        .send({ error: { code: err.code, message: err.message, details: err.details } });
    }
    const status = (err as { statusCode?: number }).statusCode;
    if (status && status >= 400 && status < 500) {
      return reply
        .status(status)
        .send({ error: { code: 'BAD_REQUEST', message: (err as Error).message } });
    }
    req.log.error({ err }, 'unhandled error');
    return reply.status(500).send({ error: { code: 'INTERNAL', message: 'Something went wrong' } });
  });

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(meRoutes);
  await app.register(configRoutes);
  await app.register(adminConfigRoutes);
  for (const plugin of plugins) await app.register(plugin);

  return app;
}

declare module 'fastify' {
  interface FastifyInstance {
    env: Env;
    store: DataStore;
    tokens: AuthTokenIssuer;
  }
}
