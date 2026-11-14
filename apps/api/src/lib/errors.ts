/**
 * Application errors with stable, translatable codes. The web app maps `code`
 * to an i18n key (`errors.<CODE>`), so messages here are for logs and developers.
 */
export type ErrorCode =
  | 'BAD_REQUEST'
  | 'VALIDATION_FAILED'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'IDEMPOTENCY_MISMATCH'
  | 'RATE_LIMITED'
  | 'PIN_INVALID'
  | 'PIN_LOCKED'
  | 'DEVICE_INVALID'
  | 'OVERRIDE_REQUIRED'
  | 'OVERRIDE_INVALID'
  | 'SHIFT_NOT_OPEN'
  | 'SHIFT_ALREADY_OPEN'
  | 'SHIFT_NOT_CLOSABLE'
  | 'VARIANCE_EXPLANATION_REQUIRED'
  | 'HANDOVER_REQUIRED'
  | 'ORDER_NOT_EDITABLE'
  | 'ORDER_INVALID_TRANSITION'
  | 'TENDER_MISMATCH'
  | 'ALREADY_REVERSED'
  | 'PERIOD_ALREADY_FINALIZED'
  | 'INTERNAL';

const STATUS: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  IDEMPOTENCY_MISMATCH: 422,
  RATE_LIMITED: 429,
  PIN_INVALID: 401,
  PIN_LOCKED: 423,
  DEVICE_INVALID: 401,
  OVERRIDE_REQUIRED: 403,
  OVERRIDE_INVALID: 403,
  SHIFT_NOT_OPEN: 409,
  SHIFT_ALREADY_OPEN: 409,
  SHIFT_NOT_CLOSABLE: 409,
  VARIANCE_EXPLANATION_REQUIRED: 422,
  HANDOVER_REQUIRED: 422,
  ORDER_NOT_EDITABLE: 409,
  ORDER_INVALID_TRANSITION: 409,
  TENDER_MISMATCH: 422,
  ALREADY_REVERSED: 409,
  PERIOD_ALREADY_FINALIZED: 409,
  INTERNAL: 500,
};

export class AppError extends Error {
  override name = 'AppError';
  readonly statusCode: number;
  constructor(
    readonly code: ErrorCode,
    message?: string,
    readonly details?: unknown,
  ) {
    super(message ?? code);
    this.statusCode = STATUS[code];
  }
}

export const isAppError = (e: unknown): e is AppError => e instanceof AppError;
