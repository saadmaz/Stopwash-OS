/** Thin fetch wrapper for the Stopwash API. */

export const API_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8080';

export class ApiError extends Error {
  override name = 'ApiError';
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

let authToken: string | null = null;
export const setAuthToken = (t: string | null) => {
  authToken = t;
};

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH';
  body?: unknown;
  /** Reuse the same key when retrying one user action, so it is applied exactly once. */
  idempotencyKey?: string;
  signal?: AbortSignal;
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  if (authToken) headers.authorization = `Bearer ${authToken}`;
  if (opts.idempotencyKey) headers['idempotency-key'] = opts.idempotencyKey;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: opts.method ?? (opts.body === undefined ? 'GET' : 'POST'),
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: opts.signal,
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Network unavailable');
  }
  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string; details?: unknown } } | null)
      ?.error;
    throw new ApiError(
      res.status,
      err?.code ?? 'INTERNAL',
      err?.message ?? res.statusText,
      err?.details,
    );
  }
  return data as T;
}

/** i18n key for an error: errors.<CODE>, falling back to errors.generic. */
export function errorKey(err: unknown): string {
  return err instanceof ApiError ? `errors.${err.code}` : 'errors.generic';
}

/** Authenticated download (CSV and other files the API streams). */
export async function apiBlob(path: string): Promise<Blob> {
  const headers: Record<string, string> = {};
  if (authToken) headers.authorization = `Bearer ${authToken}`;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { headers });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Network unavailable');
  }
  if (!res.ok) throw new ApiError(res.status, 'INTERNAL', res.statusText);
  return res.blob();
}
