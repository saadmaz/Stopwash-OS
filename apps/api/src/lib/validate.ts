import type { z } from 'zod';
import { AppError } from './errors';

/** Parse untrusted input with a zod schema or throw VALIDATION_FAILED with field issues. */
export function validate<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new AppError(
      'VALIDATION_FAILED',
      'Request validation failed',
      result.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
        code: i.code,
      })),
    );
  }
  return result.data;
}
