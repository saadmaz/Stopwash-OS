import { z } from 'zod';
import { isDateKey, isPeriodKey } from '../dates';

/** Integer cents. */
export const CentsField = z.number().int().safe();
export const PositiveCents = CentsField.positive();
export const NonNegativeCents = CentsField.nonnegative();

/** ISO-8601 UTC timestamp string. Storage adapters convert to/from native timestamps. */
export const Timestamp = z.iso.datetime({ offset: true });
export type Timestamp = z.infer<typeof Timestamp>;

export const DateKeyField = z.string().refine(isDateKey, 'Expected a date YYYY-MM-DD');
export const PeriodKeyField = z.string().refine(isPeriodKey, 'Expected a period YYYY-MM');

export const Id = z.string().min(1).max(128);
export const BrandId = z.string().regex(/^[a-z0-9-]{2,40}$/);
export const LocationId = z.string().regex(/^[a-z0-9-]{2,40}$/);

/** Short trimmed text; empty becomes null. */
export const OptionalText = (max = 200) =>
  z
    .string()
    .max(max)
    .transform((s) => s.trim().replace(/\s+/g, ' '))
    .transform((s) => (s.length ? s : null))
    .nullish()
    .transform((v) => v ?? null);

export const RequiredText = (max = 200) => z.string().trim().min(1).max(max);

/** A name in each UI language; `en` required, others fall back to English. */
export const LocalizedText = z.object({
  en: RequiredText(80),
  si: z.string().max(80).optional(),
  ta: z.string().max(80).optional(),
});
export type LocalizedText = z.infer<typeof LocalizedText>;

/** Fields every stored record carries. */
export const BaseRecord = z.object({
  id: Id,
  brandId: BrandId,
  createdAt: Timestamp,
  createdBy: Id,
});

export const Scoped = BaseRecord.extend({ locationId: LocationId });

export const Mutable = z.object({
  updatedAt: Timestamp.nullable(),
  updatedBy: Id.nullable(),
});

/** Idempotency key sent by clients (UUID v4). */
export const IdempotencyKey = z.uuid();
