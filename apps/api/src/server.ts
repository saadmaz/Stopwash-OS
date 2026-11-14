import { buildApp } from './app';
import { seedDev, DEV_STAFF } from './dev/seed';
import { loadEnv } from './env';

const env = loadEnv();
const app = await buildApp({ env });

if (env.NODE_ENV === 'development' && env.DATA_BACKEND === 'memory' && env.DEV_SEED) {
  await seedDev(app.store, {
    brandId: env.DEFAULT_BRAND_ID,
    locationId: 'katubedda',
    deviceId: env.DEV_DEVICE_ID,
    deviceSecret: env.DEV_DEVICE_SECRET,
  });
  app.log.info(
    {
      device: { deviceId: env.DEV_DEVICE_ID, deviceSecret: env.DEV_DEVICE_SECRET },
      staff: DEV_STAFF.filter((s) => s.pin).map((s) => `${s.name} (${s.role}): ${s.pin}`),
    },
    'dev seed loaded (in-memory data, resets on restart)',
  );
}

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'shutting down');
  await app.close();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await app.listen({ port: env.PORT, host: env.HOST });
} catch (err) {
  app.log.fatal({ err }, 'failed to start');
  process.exit(1);
}
