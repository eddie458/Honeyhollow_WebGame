// Tiny JSON client for the optional PHP API. Everything degrades gracefully:
// when the API is missing (static hosting / guest mode) or offline, calls
// resolve with { ok: false, offline: true } and the game keeps working.

export interface ApiUser {
  id: number;
  username: string;
  avatar: string;
  cityName: string;
  level: number;
  friendCode: string;
}

export type ApiResult<T> = ({ ok: true } & T) | { ok: false; error: string; offline?: boolean; status?: number; [k: string]: unknown };

function apiBase(): string {
  const meta = document.querySelector('meta[name="honeyhollow-api"]');
  const raw = meta?.getAttribute('content') ?? 'api/';
  return new URL(raw.endsWith('/') ? raw : `${raw}/`, document.baseURI).href;
}

let csrf = '';
let available: boolean | null = null;

export function setCsrf(token: string): void {
  csrf = token;
}

export function apiAvailable(): boolean | null {
  return available;
}

export async function api<T = Record<string, unknown>>(action: string, body?: unknown, opts: { method?: 'GET' | 'POST'; query?: Record<string, string | number>; keepalive?: boolean; timeout?: number } = {}): Promise<ApiResult<T>> {
  const method = opts.method ?? (body === undefined ? 'GET' : 'POST');
  const url = new URL('index.php', apiBase());
  url.searchParams.set('a', action);
  for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, String(v));
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeout ?? 12_000);
  try {
    const res = await fetch(url.href, {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      keepalive: opts.keepalive === true,
      signal: ctrl.signal,
      headers: {
        Accept: 'application/json',
        ...(method === 'POST' ? { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf } : {}),
      },
      ...(method === 'POST' ? { body: JSON.stringify(body ?? {}) } : {}),
    });
    const type = res.headers.get('content-type') ?? '';
    if (!type.includes('application/json')) {
      // A static host returns HTML/404 for api/index.php: no server features.
      available = false;
      return { ok: false, error: 'unavailable', offline: true, status: res.status };
    }
    available = true;
    const data = (await res.json()) as Record<string, unknown>;
    if (typeof data.csrf === 'string') csrf = data.csrf;
    if (!res.ok || data.ok === false) return { ...data, ok: false, error: String(data.error ?? `http${res.status}`), status: res.status };
    return { ...(data as T), ok: true };
  } catch {
    return { ok: false, error: 'offline', offline: true };
  } finally {
    clearTimeout(timer);
  }
}
