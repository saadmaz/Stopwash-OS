import {
  normalizePhone,
  plateDisplay,
  plateKey,
  type Customer,
  type Vehicle,
} from '@stopwash/shared';
import type { Ctx } from '../lib/context';
import { AppError } from '../lib/errors';
import { newId } from '../lib/ids';
import { eq, type Cond, type Repositories } from '../repos';

export const vehicleId = (brandId: string, key: string) => `${brandId}__${key}`;
const END = ''; // prefix-range terminator (works the same in Firestore)

export interface VisitInput {
  plate: string;
  customerName: string | null;
  customerPhone: string | null;
  vehicleClassCode: string | null;
}

export interface VisitResult {
  vehicle: Vehicle;
  customer: Customer | null;
  /** True when this plate has been seen before (old app's returning-customer badge). */
  returning: boolean;
}

/**
 * Record a visit at order time: upsert the vehicle (by plate) and the customer (by phone, else the
 * vehicle's last customer). Known details fill blanks; new details overwrite only when given.
 */
export async function recordVisit(
  tx: Pick<Repositories, 'vehicles' | 'customers'>,
  ctx: Ctx,
  input: VisitInput,
): Promise<VisitResult> {
  const brandId = ctx.actor.brandId;
  const at = ctx.now.toISOString();
  const key = plateKey(input.plate);
  if (!key) throw new AppError('VALIDATION_FAILED', 'Enter a vehicle plate');
  const phone = normalizePhone(input.customerPhone);
  const existing = await tx.vehicles.get(vehicleId(brandId, key));

  let customer: Customer | null = null;
  if (phone) {
    customer =
      (
        await tx.customers.find({ where: [eq('brandId', brandId), eq('phone', phone)], limit: 1 })
      )[0] ?? null;
  }
  if (!customer && existing?.customerId) customer = await tx.customers.get(existing.customerId);

  if (customer) {
    const name = input.customerName ?? customer.name;
    customer = await tx.customers.update(customer.id, {
      name,
      nameKey: name?.toLowerCase() ?? null,
      phone: phone ?? customer.phone,
      plateKeys: customer.plateKeys.includes(key)
        ? customer.plateKeys
        : [...customer.plateKeys, key].slice(-50),
      lastSeenAt: at,
      visitCount: customer.visitCount + 1,
      updatedAt: at,
      updatedBy: ctx.actor.id,
    });
  } else if (phone || input.customerName) {
    customer = await tx.customers.insert({
      id: newId(ctx.now),
      brandId,
      createdAt: at,
      createdBy: ctx.actor.id,
      updatedAt: null,
      updatedBy: null,
      name: input.customerName,
      nameKey: input.customerName?.toLowerCase() ?? null,
      phone,
      plateKeys: [key],
      firstSeenAt: at,
      lastSeenAt: at,
      visitCount: 1,
      totalSpentCents: 0,
    });
  }

  const vehicle = existing
    ? await tx.vehicles.update(existing.id, {
        plateDisplay: plateDisplay(input.plate),
        vehicleClassCode: input.vehicleClassCode ?? existing.vehicleClassCode,
        customerId: customer?.id ?? existing.customerId,
        visitCount: existing.visitCount + 1,
        lastSeenAt: at,
        updatedAt: at,
        updatedBy: ctx.actor.id,
      })
    : await tx.vehicles.insert({
        id: vehicleId(brandId, key),
        brandId,
        createdAt: at,
        createdBy: ctx.actor.id,
        updatedAt: null,
        updatedBy: null,
        plateKey: key,
        plateDisplay: plateDisplay(input.plate),
        vehicleClassCode: input.vehicleClassCode,
        customerId: customer?.id ?? null,
        visitCount: 1,
        completedVisits: 0,
        totalSpentCents: 0,
        firstSeenAt: at,
        lastSeenAt: at,
        lastServiceSummary: null,
        loyaltyProgress: 0,
      });
  return { vehicle, customer, returning: !!existing };
}

export interface LookupResult {
  vehicles: Array<Vehicle & { customer: Pick<Customer, 'id' | 'name' | 'phone'> | null }>;
  customers: Array<Pick<Customer, 'id' | 'name' | 'phone' | 'plateKeys' | 'visitCount'>>;
}

/** Typeahead for the order form: plate prefix, phone prefix or name prefix. */
export async function lookup(
  repos: Pick<Repositories, 'vehicles' | 'customers'>,
  brandId: string,
  q: { plate?: string; phone?: string; name?: string },
  limit = 8,
): Promise<LookupResult> {
  const vehicles: Vehicle[] = [];
  const customers: Customer[] = [];
  const prefix = <T extends { brandId: string }>(field: keyof T & string, v: string): Cond<T>[] => [
    eq<T>('brandId', brandId),
    { field, op: '>=', value: v },
    { field, op: '<', value: v + END },
  ];
  if (q.plate) {
    const k = plateKey(q.plate);
    if (k)
      vehicles.push(
        ...(await repos.vehicles.find({ where: prefix<Vehicle>('plateKey', k), limit })),
      );
  }
  if (q.phone) {
    // Search prefix in stored (+94…) form, so 0771…, 771… and +94771… all match.
    const d = q.phone.replace(/\D/g, '');
    const national = d.startsWith('94') ? `+${d}` : `+94${d.replace(/^0/, '')}`;
    if (d.length >= 3)
      customers.push(
        ...(await repos.customers.find({ where: prefix<Customer>('phone', national), limit })),
      );
  }
  if (q.name && q.name.trim().length >= 2) {
    customers.push(
      ...(await repos.customers.find({
        where: prefix<Customer>('nameKey', q.name.trim().toLowerCase()),
        limit,
      })),
    );
  }
  const byId = new Map<string, Customer>();
  for (const c of customers) byId.set(c.id, c);
  const withCustomer = await Promise.all(
    vehicles.map(async (v) => {
      const c = v.customerId
        ? (byId.get(v.customerId) ?? (await repos.customers.get(v.customerId)))
        : null;
      return { ...v, customer: c ? { id: c.id, name: c.name, phone: c.phone } : null };
    }),
  );
  return {
    vehicles: withCustomer,
    customers: [...byId.values()].map(({ id, name, phone, plateKeys, visitCount }) => ({
      id,
      name,
      phone,
      plateKeys,
      visitCount,
    })),
  };
}
