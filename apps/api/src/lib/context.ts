import type { Role } from '@stopwash/shared';

/** Who is acting, resolved from the verified token on each request. */
export interface Actor {
  id: string;
  name: string;
  role: Role;
  brandId: string;
  locationIds: string[];
  employeeId: string | null;
  deviceId: string | null;
}

/** Per-request context passed to services. */
export interface Ctx {
  actor: Actor;
  requestId: string | null;
  now: Date;
}

/** System actor for seeds and background jobs. */
export const systemActor = (brandId: string): Actor => ({
  id: 'system',
  name: 'System',
  role: 'owner',
  brandId,
  locationIds: [],
  employeeId: null,
  deviceId: null,
});
