import { Pin } from '@stopwash/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { NotImplementedError } from '../lib/not-implemented';
import { validate } from '../lib/validate';
import { signInWithPin, staffForDevice, verifyDevice } from '../services/auth';

const DeviceBody = z.object({
  deviceId: z.string().min(1).max(64),
  deviceSecret: z.string().min(16).max(128),
});

const PinBody = DeviceBody.extend({ employeeId: z.string().min(1).max(64), pin: Pin });

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const strict = {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute',
        // Per device and address, so one tablet can't be used to brute-force PINs.
        keyGenerator: (req: { ip: string; body?: unknown }) =>
          `${req.ip}:${(req.body as { deviceId?: string } | undefined)?.deviceId ?? '-'}`,
      },
    },
  };

  /** Staff list for the PIN pad. POST so the device secret never lands in a URL or access log. */
  app.post('/auth/device/staff', strict, async (req) => {
    const body = validate(DeviceBody, req.body);
    const device = await verifyDevice(app.store, body.deviceId, body.deviceSecret);
    return { location: device.locationId, staff: await staffForDevice(app.store, device) };
  });

  app.post('/auth/pin', strict, async (req) => {
    const body = validate(PinBody, req.body);
    return signInWithPin(app.store, app.tokens, body, {
      now: new Date(),
      requestId: req.id,
      policy: {
        maxAttempts: app.env.PIN_MAX_ATTEMPTS,
        lockoutMinutes: app.env.PIN_LOCKOUT_MINUTES,
      },
    });
  });

  /** Owner/manager/accounts email sign-in is Firebase Auth's job (see ADR-0031). */
  app.post('/auth/email', strict, async () => {
    throw new NotImplementedError(
      'Email sign-in uses Firebase Auth: wire up when Firebase is configured. In dev, sign in with a PIN.',
    );
  });
}
