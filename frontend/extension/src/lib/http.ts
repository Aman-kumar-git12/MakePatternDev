interface FetchOptions extends RequestInit {
  timeoutMs?: number;
  /** Send the user's cookies for this host (e.g. to read their own LeetCode history). */
  cookies?: boolean;
}

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Codeforces allows ~1 API call per 2 seconds; space our calls out. */
const MIN_GAP_MS: Record<string, number> = { 'codeforces.com': 2100 };
const lastCall = new Map<string, Promise<number>>();

async function throttle(host: string) {
  const gap = MIN_GAP_MS[host];
  if (!gap) return;
  const prev = lastCall.get(host) ?? Promise.resolve(0);
  const turn = prev.then(async (t) => {
    const wait = t + gap - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    return Date.now();
  });
  lastCall.set(host, turn);
  await turn;
}

/**
 * Codeforces sits behind Cloudflare: sending the user's own cookies lets the browser's
 * existing clearance apply. Every other source is fully public, so cookies are omitted.
 */
const SEND_COOKIES = new Set(['codeforces.com']);

async function request(url: string, { timeoutMs = 20000, cookies, ...init }: FetchOptions = {}): Promise<Response> {
  const host = new URL(url).host;
  await throttle(host);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, credentials: cookies || SEND_COOKIES.has(host) ? 'include' : 'omit', signal: ctrl.signal });
    if (!res.ok) {
      if (res.status === 403 && host === 'codeforces.com')
        throw new HttpError('Codeforces blocked the request (Cloudflare check) — open codeforces.com once in this browser, then retry.', 403);
      throw new HttpError(`HTTP ${res.status} from ${host}`, res.status);
    }
    return res;
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new Error(`Timed out reaching ${host}`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson<T>(url: string, init?: FetchOptions): Promise<T> {
  return (await request(url, init)).json() as Promise<T>;
}

export async function fetchText(url: string, init?: FetchOptions): Promise<string> {
  return (await request(url, init)).text();
}

/**
 * Queries leetcode.com/graphql. Public queries go without cookies; pass `{ cookies: true }`
 * only for queries about the user's own data (e.g. verifying a captured submission).
 */
export async function leetcodeGraphql<T>(
  query: string,
  variables: Record<string, unknown> = {},
  opts: { cookies?: boolean; timeoutMs?: number } = {},
): Promise<T> {
  const res = await fetchJson<{ data?: T; errors?: { message: string }[] }>('https://leetcode.com/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    ...opts,
  });
  if (res.errors?.length) throw new Error(`LeetCode: ${res.errors[0]!.message}`);
  if (!res.data) throw new Error('LeetCode returned no data');
  return res.data;
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
