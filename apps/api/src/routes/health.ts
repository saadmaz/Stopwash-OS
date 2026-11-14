import type { FastifyInstance } from 'fastify';

const startedAt = new Date();

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => ({
    status: 'ok',
    service: 'stopwash-api',
    version: process.env.npm_package_version ?? '0.1.0',
    startedAt: startedAt.toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    emulator: Boolean(app.env.FIRESTORE_EMULATOR_HOST),
  }));
}
