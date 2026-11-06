import type { Potd } from '../../lib/types';
import {
  recordTufRun,
  summarizeFailure,
  TufStageError,
  type TufAttempt,
  type TufStage,
  type TufStageLog,
} from '../../lib/tufDiagnostics';

export const TUF_POTD_URL = 'https://takeuforward.org/potd';

interface TufTrack {
  trackSlug: string;
  dayId: number;
  problem: {
    slug: string;
    name: string;
    difficulty?: string;
    topicTags?: (string | { name?: string })[];
    href?: string;
  };
  userStatus?: string;
  stats?: { solveCount?: number; attemptCount?: number; acceptanceRate?: number };
}

/** Joins the Next.js RSC payload (`self.__next_f.push([1, "..."])`) into one decoded string. */
function rscPayload(html: string): string {
  let out = '';
  for (const m of html.matchAll(/self\.__next_f\.push\(\[1,\s*"((?:\\.|[^"\\])*)"\]\)/g)) {
    try {
      out += JSON.parse(`"${m[1]}"`) as string;
    } catch {
      /* skip a chunk we can't decode */
    }
  }
  return out;
}

/** Returns the JSON object (or array) starting at `start`, honouring strings and escapes. */
function sliceJson(text: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === '\\') i++;
      else if (ch === '"') inString = false;
    } else if (ch === '"') inString = true;
    else if (ch === '{' || ch === '[') depth++;
    else if (ch === '}' || ch === ']') {
      if (--depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

type StageHook = (stage: TufStage, ok: boolean, detail?: string, error?: string) => void;

/** Runs one parse step, reporting it to `hook` and tagging any failure with its stage. */
function step<T>(hook: StageHook | undefined, stage: TufStage, fn: () => T, detail?: (v: T) => string): T {
  try {
    const v = fn();
    hook?.(stage, true, detail?.(v));
    return v;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    hook?.(stage, false, undefined, msg);
    throw e instanceof TufStageError ? e : new TufStageError(stage, msg);
  }
}

/**
 * takeUforward has no public API: the /potd page server-renders its React Query cache
 * (the same data its "Solve Problem" button navigates with). We read the
 * `["potd","today",<track>]` query from it. Stages: load → extract-title → find-question-link
 * → validate-url.
 */
export function parseTufPotd(html: string, track = 'dsa', hook?: StageHook): Potd & { solved: boolean } {
  const payload = step(
    hook,
    'load',
    () => {
      const p = rscPayload(html);
      if (!p) throw new Error('TUF: page data not found (no server-rendered data in the page)');
      return p;
    },
    (p) => `${html.length} bytes html, ${p.length} chars of page data`,
  );

  const { t, data } = step(
    hook,
    'extract-title',
    () => {
      // Logged-in pages may append extra parts to the key (e.g. a user id), so match the prefix.
      const keyIdx = payload.search(new RegExp(`"queryKey":\\["potd","today","${track}"[\\],]`));
      if (keyIdx < 0) throw new Error('TUF: problem of the day not found (page layout changed?)');
      const marker = '"state":{"data":';
      const stateIdx = payload.lastIndexOf(marker, keyIdx);
      const raw = stateIdx >= 0 ? sliceJson(payload, stateIdx + marker.length) : null;
      if (!raw) throw new Error('TUF: could not read problem of the day');
      const data = JSON.parse(raw) as { dayId?: number; tracks?: TufTrack[] };
      const t = data.tracks?.find((x) => x.trackSlug === track) ?? data.tracks?.[0];
      if (!t?.problem?.name?.trim()) throw new Error('TUF: no problem scheduled today');
      return { t, data };
    },
    ({ t }) => `title "${t.problem.name.trim()}"`,
  );

  // The page's own destination for "Solve Problem" (never derived from the title).
  const href = step(
    hook,
    'find-question-link',
    () => {
      if (!t.problem.href) throw new Error('TUF: problem of the day has no question link');
      return t.problem.href;
    },
    (h) => h,
  );
  const url = step(hook, 'validate-url', () => tufQuestionUrl(href), (u) => u);

  const day = String(t.dayId ?? data.dayId ?? '');
  const date = /^\d{8}$/.test(day) ? `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}` : '';
  const diff = t.problem.difficulty;
  const stats = t.stats;
  const note = [
    stats?.acceptanceRate != null ? `${stats.acceptanceRate.toFixed(0)}% acceptance` : '',
    stats?.attemptCount != null ? `${stats.attemptCount} attempts` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return {
    source: 'tuf',
    platform: 'tuf',
    key: `tuf:${(t.problem.slug || new URL(url).pathname).toLowerCase()}`,
    title: t.problem.name.trim(),
    url,
    difficulty: diff ? diff[0]!.toUpperCase() + diff.slice(1) : undefined,
    tags: (t.problem.topicTags ?? []).map((x) => (typeof x === 'string' ? x : (x.name ?? ''))).filter(Boolean),
    date,
    note: note || undefined,
    // The link icon opens the question itself too (not the /potd listing).
    extraUrl: url,
    // Only meaningful when the browser is logged in to takeuforward.org.
    solved: /solved|completed|accepted|done/i.test(t.userStatus ?? ''),
  };
}

/** Resolves TUF's `href` for the question and checks it is a takeuforward.org /practice/ page. */
export function tufQuestionUrl(href: string | undefined): string {
  if (!href) throw new Error('TUF: problem of the day has no question link');
  let u: URL;
  try {
    u = new URL(href, 'https://takeuforward.org');
  } catch {
    throw new Error('TUF: invalid question link');
  }
  if (u.protocol !== 'https:' || u.hostname !== 'takeuforward.org' || !u.pathname.startsWith('/practice/')) {
    throw new Error('TUF: question link is not a takeuforward.org practice page');
  }
  return u.href;
}

/** How long a fetched TUF problem of the day is reused before the page is read again. */
export const TUF_CACHE_MS = 30 * 60_000;
const REQUEST_TIMEOUT_MS = 20_000;

/** What a page request returned. Bodies are only parsed, never logged. */
export interface TufPage {
  status: number;
  text: string;
  /** Final URL after redirects (a redirect to /login etc. shows up here). */
  url: string;
  contentType?: string;
}

/**
 * Fetches /potd from the background worker. `cookies: true` sends the user's takeuforward.org
 * session so their "solved" status comes through; `false` is the public logged-out page.
 */
export async function fetchTufPage(cookies: boolean): Promise<TufPage> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(TUF_POTD_URL, {
      credentials: cookies ? 'include' : 'omit',
      cache: 'no-store',
      redirect: 'follow',
      signal: ctrl.signal,
    });
    return { status: res.status, text: await res.text(), url: res.url, contentType: res.headers.get('content-type') ?? undefined };
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new Error(`timed out after ${REQUEST_TIMEOUT_MS / 1000}s`);
    throw new Error(`network error: ${(e as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}

/** Recognises bot challenges / access blocks so we report them instead of retrying around them. */
export function looksBlocked(page: TufPage): string | null {
  if ([401, 403, 429, 503].includes(page.status)) return `access blocked (HTTP ${page.status})`;
  if (/challenge-platform|cf-chl-|Just a moment\.\.\.|Attention Required/i.test(page.text.slice(0, 20_000))) {
    return 'blocked by a bot challenge page';
  }
  try {
    const u = new URL(page.url || TUF_POTD_URL);
    if (u.hostname === 'takeuforward.org' && u.pathname !== '/potd' && !u.pathname.startsWith('/potd/')) return `redirected to ${u.pathname}`;
  } catch {
    /* ignore */
  }
  return null;
}

type TufResult = Potd & { solved: boolean };
type PageFetcher = () => Promise<TufPage | string>;
let memo: { at: number; value: TufResult } | null = null;
let inflight: Promise<TufResult> | null = null;

async function attempt(attemptName: TufAttempt, fetchPage: PageFetcher, stages: TufStageLog[]): Promise<TufResult> {
  let t0 = Date.now();
  const hook: StageHook = (stage, ok, detail, error) => {
    const now = Date.now();
    stages.push({ attempt: attemptName, stage, ok, ms: now - t0, detail, error });
    t0 = now;
  };

  // Stage: request
  let page: TufPage;
  try {
    const got = await fetchPage();
    page = typeof got === 'string' ? { status: 200, text: got, url: TUF_POTD_URL } : got;
  } catch (e) {
    stages.push({ attempt: attemptName, stage: 'request', ok: false, ms: Date.now() - t0, error: (e as Error).message });
    throw new TufStageError('request', (e as Error).message);
  }
  const blocked = looksBlocked(page);
  const okStatus = page.status >= 200 && page.status < 300;
  stages.push({
    attempt: attemptName,
    stage: 'request',
    ok: okStatus && !blocked,
    ms: Date.now() - t0,
    status: page.status,
    detail: page.contentType,
    error: blocked ?? (okStatus ? undefined : `HTTP ${page.status}`),
  });
  t0 = Date.now();
  if (blocked) throw new TufStageError('request', blocked, page.status);
  if (!okStatus) throw new TufStageError('request', `HTTP ${page.status}`, page.status);

  const result = parseTufPotd(page.text, 'dsa', hook);
  return attemptName === 'public' ? { ...result, solved: false } : result;
}

/**
 * Reads takeuforward.org/potd: first with the user's cookies, then (if that fails for any
 * reason) as a logged-out visitor. Every stage is logged (see lib/tufDiagnostics.ts).
 * Results are cached for ~30 minutes and concurrent callers share one request.
 */
async function readTufPotd(fetchLoggedIn: PageFetcher, fetchPublic: PageFetcher): Promise<TufResult> {
  const started = Date.now();
  const stages: TufStageLog[] = [];
  let used: TufAttempt = 'logged-in';
  let result: TufResult | undefined;
  let failure: unknown;
  try {
    result = await attempt('logged-in', fetchLoggedIn, stages);
  } catch {
    used = 'public';
    try {
      result = await attempt('public', fetchPublic, stages);
    } catch (e) {
      failure = e;
    }
  }
  await recordTufRun({
    at: started,
    ok: !!result,
    ms: Date.now() - started,
    stages,
    result: result ? { title: result.title, url: result.url, attempt: used } : undefined,
  });
  if (result) return result;
  throw new Error(`TUF: ${summarizeFailure(stages)}`, { cause: failure });
}

export function fetchTufPotd(
  now = Date.now(),
  fetchLoggedIn: PageFetcher = () => fetchTufPage(true),
  fetchPublic: PageFetcher = () => fetchTufPage(false),
): Promise<TufResult> {
  if (memo && now - memo.at < TUF_CACHE_MS) return Promise.resolve(memo.value);
  if (inflight) return inflight;
  inflight = readTufPotd(fetchLoggedIn, fetchPublic)
    .then((result) => {
      const value = { ...result, fetchedAt: now };
      memo = { at: now, value };
      return value;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Test hook: forget the in-memory cache. */
export function resetTufCache(): void {
  memo = null;
  inflight = null;
}
