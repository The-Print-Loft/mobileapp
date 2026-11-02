import { APP_VERSION } from './config';
import { getApiBaseUrl } from './environment';
import type { ApiErrorBody } from './types';

/**
 * A typed error for any non-success API outcome. `code` is the stable,
 * machine-readable string to branch on (e.g. 'PRODUCT_NOT_FOUND'); `message`
 * is safe to show a user. `retryable` is true for 502/503 and network faults.
 */
export class ApiError extends Error {
  code: string;
  httpStatus: number;
  retryable: boolean;

  constructor(code: string, message: string, httpStatus: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.retryable = httpStatus === 502 || httpStatus === 503 || httpStatus === 0;
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST';
  body?: unknown;
  /** Query params appended to the path (values stringified, undefined skipped). */
  query?: Record<string, string | number | undefined>;
  signal?: AbortSignal;
};

function buildUrl(path: string, query?: RequestOptions['query']): string {
  // Read the base URL per request so the dev environment toggle takes effect.
  const url = `${getApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return url;
  const params = Object.entries(query)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return params.length ? `${url}?${params.join('&')}` : url;
}

/**
 * Core request. Always sends the required `appversion` header, unwraps the
 * `{ status, ... }` envelope, and throws `ApiError` on any error shape or
 * transport failure. Returns the success payload (the envelope minus `status`).
 */
export async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, signal } = opts;

  const headers: Record<string, string> = { appversion: APP_VERSION };
  let payload: string | undefined;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res: Response;
  try {
    res = await fetch(buildUrl(path, query), { method, headers, body: payload, signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError('NETWORK_ERROR', 'Could not reach the server. Check your connection.', 0);
  }

  // Every endpoint replies JSON; a non-JSON body means something upstream broke.
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new ApiError('INVALID_RESPONSE', 'The server sent an unexpected response.', res.status);
  }

  const envelope = json as { status?: string } & Partial<ApiErrorBody>;
  if (!res.ok || envelope.status === 'error') {
    const code = envelope.error?.code ?? 'UNKNOWN_ERROR';
    const message = envelope.error?.message ?? 'Something went wrong. Please try again.';
    throw new ApiError(code, message, res.status);
  }

  return json as T;
}
