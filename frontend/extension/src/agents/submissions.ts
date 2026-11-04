import { fetchJson, HttpError, leetcodeGraphql } from '../lib/http';
import type { LeetCodeCapture } from '../lib/messages';
import { getItem, getSettings, pruneOrphanAnalyses, setItem, updateItem } from '../lib/storage';
import { sleep } from '../lib/time';
import type { Cursors, PlatformProfile, Settings, Submission, Verdict } from '../lib/types';
import { markPotdsFromSubmissions } from './potd';
import type { Agent } from './types';

const MAX_SUBMISSIONS = 8000;
/** Newest submissions that keep their code; older ones are stripped to save storage. */
const MAX_WITH_CODE = 200;
/** Code longer than this is truncated (storage is capped; analysis only needs the gist). */
export const MAX_CODE_CHARS = 20_000;

/** Network + timing dependencies of the sync functions, injectable for tests. */
export interface SyncDeps {
  fetch: <T>(url: string, init?: Parameters<typeof fetchJson>[1]) => Promise<T>;
  sleep: (ms: number) => Promise<unknown>;
  now: () => number;
}
const DEFAULT_DEPS: SyncDeps = { fetch: fetchJson, sleep, now: () => Date.now() };

/** Handles are case-insensitive on every supported platform. */
export const sameHandle = (a: string | undefined, b: string | undefined) =>
  (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();

const capCode = (code: string | undefined) => (code && code.length > MAX_CODE_CHARS ? code.slice(0, MAX_CODE_CHARS) : code);

const CF_VERDICTS: Record<string, Verdict> = {
  OK: 'AC',
  WRONG_ANSWER: 'WA',
  TIME_LIMIT_EXCEEDED: 'TLE',
  IDLENESS_LIMIT_EXCEEDED: 'TLE',
  MEMORY_LIMIT_EXCEEDED: 'MLE',
  RUNTIME_ERROR: 'RE',
  COMPILATION_ERROR: 'CE',
};

const SHORT_VERDICTS: Record<string, Verdict> = {
  AC: 'AC',
  WA: 'WA',
  TLE: 'TLE',
  MLE: 'MLE',
  RE: 'RE',
  CE: 'CE',
  OLE: 'WA',
};

export function leetcodeVerdict(statusMsg: string): Verdict {
  const s = statusMsg.toLowerCase();
  if (s === 'accepted') return 'AC';
  if (s.startsWith('wrong')) return 'WA';
  if (s.startsWith('time limit')) return 'TLE';
  if (s.startsWith('memory limit')) return 'MLE';
  if (s.startsWith('runtime')) return 'RE';
  if (s.startsWith('compile')) return 'CE';
  if (s.startsWith('output limit')) return 'WA';
  return 'OTHER';
}

// --- Merging ----------------------------------------------------------------------------

/** CodeChef rows without a solution id: `codechef:CODE@<ts>[~unit]:<verdict>[#n]`. */
const CC_FALLBACK = /^codechef:[^@]+@\d+(?:~([smhd]))?:/;
const UNIT_MS: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
/** Slack for the delay between a page being rendered and our `now`. */
const CC_SLACK_MS = 2 * 60_000;

/** How precise a CodeChef fallback id's timestamp is (absolute times have minute precision). */
function fallbackPrecision(id: string): number | null {
  const m = id.match(CC_FALLBACK);
  if (!m) return null;
  return m[1] ? UNIT_MS[m[1]]! : 60_000;
}

/**
 * CodeChef rows without a solution id get a time-based id, and recent rows only show relative
 * times ("25 min ago"), so the same submission yields a slightly different id on every sync.
 * Match such rows to stored ones (same problem + verdict, timestamps within the coarser
 * precision) one-to-one, nearest first, and reuse the stored id. When the new row is more precise
 * (relative → absolute time), the stored timestamp is corrected.
 */
export function reconcileCodeChefFallbacks(
  existing: Submission[],
  incoming: Submission[],
): { incoming: Submission[]; retime: Map<string, number> } {
  const retime = new Map<string, number>();
  const existingIds = new Set(existing.map((s) => s.id));
  const incomingIds = new Set(incoming.map((s) => s.id));
  const pool = existing.filter((s) => s.platform === 'codechef' && !incomingIds.has(s.id) && fallbackPrecision(s.id) !== null);
  if (!pool.length) return { incoming, retime };

  const pairs: { i: number; j: number; d: number }[] = [];
  incoming.forEach((s, i) => {
    if (s.platform !== 'codechef' || existingIds.has(s.id)) return;
    const pi = fallbackPrecision(s.id);
    if (pi === null) return;
    pool.forEach((e, j) => {
      if (e.problemKey !== s.problemKey || e.rawVerdict !== s.rawVerdict) return;
      const d = Math.abs(e.ts - s.ts);
      if (d <= Math.max(pi, fallbackPrecision(e.id)!) + CC_SLACK_MS) pairs.push({ i, j, d });
    });
  });
  pairs.sort((a, b) => a.d - b.d);
  const usedI = new Set<number>();
  const usedJ = new Set<number>();
  const out = [...incoming];
  for (const { i, j } of pairs) {
    if (usedI.has(i) || usedJ.has(j)) continue;
    usedI.add(i);
    usedJ.add(j);
    const s = incoming[i]!;
    const e = pool[j]!;
    if (fallbackPrecision(s.id)! < fallbackPrecision(e.id)!) retime.set(e.id, s.ts);
    out[i] = { ...s, id: e.id };
  }
  return { incoming: out, retime };
}

/**
 * Combines a stored record with a newly fetched one for the same id. Browser captures carry
 * code and tags that API backfills don't, so the stored (richer) record normally wins — except
 * that LeetCode's own logged-in history (`source: 'session'`) is authoritative: its verdict,
 * language, time and code replace page-supplied values, and it clears `unverified`.
 */
function mergeOne(prev: Submission, s: Submission): Submission {
  const merged: Submission = { ...s, ...prev, code: prev.code ?? s.code, tags: prev.tags.length ? prev.tags : s.tags };
  if (s.source !== 'session') return merged;
  const { unverified: _unverified, ...rest } = merged;
  return {
    ...rest,
    verdict: s.verdict,
    rawVerdict: s.rawVerdict,
    lang: s.lang ?? prev.lang,
    ts: s.ts,
    code: s.code ?? prev.code,
    source: 'session',
    account: s.account ?? prev.account,
  };
}

/** Merges new submissions (dedup by id), keeps the newest, caps code size and strips code from old ones. */
export function mergeSubmissions(existing: Submission[], incoming: Submission[]): { merged: Submission[]; added: number } {
  const rec = reconcileCodeChefFallbacks(existing, incoming);
  const byId = new Map(existing.map((s) => [s.id, rec.retime.has(s.id) ? { ...s, ts: rec.retime.get(s.id)! } : s]));
  let added = 0;
  for (const s of rec.incoming) {
    const prev = byId.get(s.id);
    if (!prev) added++;
    byId.set(s.id, prev ? mergeOne(prev, s) : s);
  }
  const merged = [...byId.values()].sort((a, b) => a.ts - b.ts).slice(-MAX_SUBMISSIONS);
  let withCode = 0;
  for (let i = merged.length - 1; i >= 0; i--) {
    const m = merged[i]!;
    if (!m.code) continue;
    if (++withCode > MAX_WITH_CODE) merged[i] = { ...m, code: undefined };
    else if (m.code.length > MAX_CODE_CHARS) merged[i] = { ...m, code: capCode(m.code) };
  }
  return { merged, added };
}

/** Merges submissions into storage in one write and auto-completes matching POTDs. */
export async function ingest(incoming: Submission[]): Promise<number> {
  if (!incoming.length) return 0;
  let added = 0;
  const all = await updateItem('submissions', (subs) => {
    const r = mergeSubmissions(subs, incoming);
    added = r.added;
    return r.merged;
  });
  await markPotdsFromSubmissions(all);
  return added;
}

// --- Handle / account changes ------------------------------------------------------------

export type HandlePlatform = 'codeforces' | 'atcoder' | 'codechef' | 'gfg' | 'leetcode';
const HANDLE_PLATFORMS: HandlePlatform[] = ['codeforces', 'atcoder', 'codechef', 'gfg', 'leetcode'];

export type Purge =
  /** The configured handle changed or was cleared: drop that platform's imported submissions. */
  | { kind: 'handle'; platform: HandlePlatform; handle: string; hasSession: boolean }
  /** The browser is logged in to a different LeetCode account than the imported history. */
  | { kind: 'leetcode-session'; username: string };

/** Platforms whose cursor was built for a different handle than the one now configured (or a cleared one). */
export function planHandleResets(handles: Settings['handles'], cursors: Cursors): HandlePlatform[] {
  return HANDLE_PLATFORMS.filter((p) => {
    const c = cursors[p];
    return !!c && !sameHandle(c.handle, handles[p]);
  });
}

function purgeDrops(s: Submission, p: Purge): boolean {
  if (p.kind === 'leetcode-session') {
    // Keep public-API imports (they belong to the configured handle) and records of the new account.
    return s.platform === 'leetcode' && s.source !== 'api' && !(s.account && sameHandle(s.account, p.username));
  }
  if (s.platform !== p.platform) return false;
  if (p.platform !== 'leetcode') return !(s.account && p.handle && sameHandle(s.account, p.handle));
  // LeetCode: the handle only feeds the public accepted-only import. Session imports and live
  // captures belong to the logged-in account and are handled by the session purge. Old records
  // without a source can only be told apart when there never was a session import.
  if (s.source === 'api') return !(s.account && p.handle && sameHandle(s.account, p.handle));
  return !s.source && !p.hasSession;
}

/** Removes the submissions the given purges invalidate. Pure. */
export function applyPurges(subs: Submission[], purges: Purge[]): Submission[] {
  if (!purges.length) return subs;
  return subs.filter((s) => !purges.some((p) => purgeDrops(s, p)));
}

// --- Platforms ---------------------------------------------------------------------------

interface CfRow {
  id: number;
  creationTimeSeconds: number;
  programmingLanguage: string;
  verdict?: string;
  problem: { contestId?: number; problemsetName?: string; index: string; name: string; rating?: number; tags: string[] };
}

/** Incremental Codeforces syncs read pages of this size... */
const CF_FIRST_PAGE = 100;
const CF_PAGE = 1000;
/** ...walking back until the cursor is reached, at most this many pages (requests are throttled to 1 per 2 s). */
const CF_MAX_PAGES = 5;

export async function syncCodeforces(
  handle: string,
  cursor: Cursors['codeforces'],
  out: Submission[],
  deps: SyncDeps = DEFAULT_DEPS,
): Promise<Cursors['codeforces']> {
  const fresh = !cursor || !sameHandle(cursor.handle, handle);
  const lastId = fresh ? 0 : cursor!.lastId;
  const byId = new Map<number, CfRow>();
  let from = 1;
  for (let page = 0; page < (fresh ? 1 : CF_MAX_PAGES); page++) {
    const count = fresh ? 2000 : page === 0 ? CF_FIRST_PAGE : CF_PAGE;
    const res = await deps.fetch<{ status: string; comment?: string; result: CfRow[] }>(
      `https://codeforces.com/api/user.status?handle=${encodeURIComponent(handle)}&from=${from}&count=${count}`,
    );
    if (res.status !== 'OK') throw new Error(`Codeforces: ${res.comment ?? res.status}`);
    // Newest first; pages may overlap if new submissions arrive meanwhile (never gap).
    for (const r of res.result) byId.set(r.id, r);
    if (res.result.length < count || res.result.some((r) => r.id <= lastId)) break;
    from += count;
  }
  const rows = [...byId.values()];
  const account = handle.toLowerCase();
  const subs: Submission[] = rows
    .filter((s) => s.id > lastId && s.verdict && s.verdict !== 'TESTING' && s.problem.contestId)
    .map((s) => ({
      id: `codeforces:${s.id}`,
      platform: 'codeforces',
      problemKey: `codeforces:${s.problem.contestId}${s.problem.index}`,
      title: `${s.problem.contestId}${s.problem.index}. ${s.problem.name}`,
      url: `https://codeforces.com/${s.problem.contestId! >= 100000 ? 'gym' : 'contest'}/${s.problem.contestId}/problem/${s.problem.index}`,
      verdict: CF_VERDICTS[s.verdict!] ?? 'OTHER',
      rawVerdict: s.verdict!,
      lang: s.programmingLanguage,
      ts: s.creationTimeSeconds * 1000,
      tags: s.problem.tags,
      difficulty: s.problem.rating ? String(s.problem.rating) : undefined,
      source: 'api',
      account,
    }));
  out.push(...subs);
  // Don't advance past a submission still being judged.
  const judging = rows.filter((s) => s.id > lastId && (!s.verdict || s.verdict === 'TESTING')).map((s) => s.id);
  let maxDone = lastId;
  for (const s of subs) maxDone = Math.max(maxDone, Number(s.id.split(':')[1]));
  return { handle, lastId: judging.length ? Math.min(maxDone, Math.min(...judging) - 1) : maxDone };
}

interface AtCoderRow {
  id: number;
  epoch_second: number;
  problem_id: string;
  contest_id: string;
  language: string;
  result: string;
}

/** WJ = waiting for judge, WR = waiting for rejudge, "3/10" = judging in progress. */
const atcoderPending = (result: string) => result === 'WJ' || result === 'WR' || /^\d+\/\d+/.test(result);
/** A row stuck "pending" for longer than this is treated as abandoned so the cursor can't stall forever. */
const ATCODER_STALE_PENDING_S = 86_400;

export async function syncAtCoder(
  handle: string,
  cursor: Cursors['atcoder'],
  out: Submission[],
  deps: SyncDeps = DEFAULT_DEPS,
): Promise<Cursors['atcoder']> {
  const nowSec = Math.floor(deps.now() / 1000);
  // First import starts one year back so recent activity shows up immediately.
  let from = cursor && sameHandle(cursor.handle, handle) ? cursor.fromSecond : nowSec - 365 * 86400;
  /** Earliest still-pending submission seen: the cursor must not move past it. */
  let holdAt = Infinity;
  const account = handle.toLowerCase();
  // kenkoooo returns up to 500 per call (oldest first) and asks clients to pause between calls.
  for (let page = 0; page < 4; page++) {
    const res = await deps.fetch<AtCoderRow[]>(
      `https://kenkoooo.com/atcoder/atcoder-api/v3/user/submissions?user=${encodeURIComponent(handle)}&from_second=${from}`,
    );
    const done = res.filter((s) => !atcoderPending(s.result));
    for (const s of res) {
      if (atcoderPending(s.result) && nowSec - s.epoch_second < ATCODER_STALE_PENDING_S) holdAt = Math.min(holdAt, s.epoch_second);
    }
    out.push(
      ...done.map((s) => ({
        id: `atcoder:${s.id}`,
        platform: 'atcoder' as const,
        problemKey: `atcoder:${s.problem_id}`,
        title: s.problem_id.toUpperCase().replace('_', ' '),
        url: `https://atcoder.jp/contests/${s.contest_id}/tasks/${s.problem_id}`,
        verdict: SHORT_VERDICTS[s.result] ?? 'OTHER',
        rawVerdict: s.result,
        lang: s.language,
        ts: s.epoch_second * 1000,
        tags: [],
        source: 'api' as const,
        account,
      })),
    );
    if (!res.length) break;
    from = Math.max(from, ...res.map((s) => s.epoch_second)) + 1;
    if (res.length < 500) break;
    await deps.sleep(1100);
  }
  // Re-read from the earliest pending submission next time; ingest() de-duplicates the rest.
  return { handle, fromSecond: Math.min(from, holdAt) };
}

/** Backfills accepted LeetCode submissions (the public API only exposes recent ACs). */
export async function syncLeetCode(
  handle: string,
  cursor: Cursors['leetcode'],
  out: Submission[],
  graphql: typeof leetcodeGraphql = leetcodeGraphql,
): Promise<Cursors['leetcode']> {
  const data = await graphql<{
    recentAcSubmissionList: { id: string; title: string; titleSlug: string; timestamp: string; lang: string }[] | null;
  }>('query($u: String!) { recentAcSubmissionList(username: $u, limit: 20) { id title titleSlug timestamp lang } }', {
    u: handle,
  });
  const list = data.recentAcSubmissionList ?? [];
  const lastTs = cursor && sameHandle(cursor.handle, handle) ? cursor.lastTs : 0;
  out.push(
    ...list
      .filter((s) => Number(s.timestamp) * 1000 > lastTs)
      .map((s) => ({
        id: `leetcode:${s.id}`,
        platform: 'leetcode' as const,
        problemKey: `leetcode:${s.titleSlug.toLowerCase()}`,
        title: s.title,
        url: `https://leetcode.com/problems/${s.titleSlug}/`,
        verdict: 'AC' as const,
        rawVerdict: 'Accepted',
        lang: s.lang,
        ts: Number(s.timestamp) * 1000,
        tags: [],
        source: 'api' as const,
        account: handle.toLowerCase(),
      })),
  );
  return { handle, lastTs: Math.max(lastTs, ...list.map((s) => Number(s.timestamp) * 1000)) };
}

export function codechefVerdict(result: string): Verdict {
  const r = result.toLowerCase();
  if (r === 'accepted') return 'AC';
  // "Partially accepted" means some subtasks failed: the problem isn't solved yet.
  if (r.startsWith('wrong') || r.startsWith('partially')) return 'WA';
  if (r.startsWith('time limit')) return 'TLE';
  if (r.startsWith('memory limit')) return 'MLE';
  if (r.startsWith('runtime')) return 'RE';
  if (r.startsWith('compil')) return 'CE';
  return 'OTHER';
}

export interface CodeChefTime {
  ts: number;
  /** Shown as "5 min ago" (drifts between syncs) rather than an absolute time. */
  relative: boolean;
  /** Unit of the displayed time: s / m / h / d. */
  unit: 's' | 'm' | 'h' | 'd';
}

/** CodeChef shows times in IST as "08:11 PM 17/07/22", or "5 min ago" for recent ones. */
export function parseCodeChefTimeInfo(text: string, now = Date.now()): CodeChefTime | null {
  const abs = text.match(/(\d{1,2}):(\d{2})\s*([AP]M)\s+(\d{2})\/(\d{2})\/(\d{2})/i);
  if (abs) {
    const [, hh, mm, ap, dd, mo, yy] = abs;
    let h = Number(hh) % 12;
    if (ap!.toUpperCase() === 'PM') h += 12;
    return { ts: Date.UTC(2000 + Number(yy), Number(mo) - 1, Number(dd), h, Number(mm)) - 330 * 60_000, relative: false, unit: 'm' };
  }
  const rel = text.match(/(\d+)\s*(sec|min|hour|hr|day)/i);
  if (rel) {
    const u = rel[2]!.toLowerCase();
    const unit = u.startsWith('sec') ? 's' : u.startsWith('min') ? 'm' : u.startsWith('day') ? 'd' : 'h';
    return { ts: now - Number(rel[1]) * UNIT_MS[unit]!, relative: true, unit };
  }
  return null;
}

export function parseCodeChefTime(text: string, now = Date.now()): number | null {
  return parseCodeChefTimeInfo(text, now)?.ts ?? null;
}

/**
 * Parses the HTML table returned by `codechef.com/recent/user` (JSON-wrapped). Rows without a
 * solution id get `CODE@ts:verdict` ids — with `~unit` when the time is relative, so the merge
 * step can match them against stored rows despite the drift (see `reconcileCodeChefFallbacks`).
 */
export function parseCodeChefRecent(content: string, now = Date.now(), account?: string): Submission[] {
  const subs: Submission[] = [];
  const seen = new Map<string, number>();
  for (const row of content.split(/<tr[\s>]/).slice(1)) {
    // Some contests hide solutions, so there's no submission id: fall back to a composite.
    const solutionId = row.match(/\/viewsolution\/(\d+)/)?.[1];
    const link = row.match(/href='(\/(?:([\w-]+)\/)?problems\/([\w-]+))'/);
    const result = row.match(/<span title='([^']+)'/)?.[1];
    const timeText = row.match(/<td\s+title='([^']*)'/)?.[1] ?? '';
    const time = parseCodeChefTimeInfo(timeText, now) ?? parseCodeChefTimeInfo(row.replace(/<[^>]+>/g, ' '), now);
    if (!link || !result || time === null) continue;
    const code = link[3]!.toUpperCase();
    let id = solutionId;
    if (!id) {
      const base = `${code}@${time.ts}${time.relative ? `~${time.unit}` : ''}:${result.replace(/\W+/g, '-')}`;
      // Two identical-looking rows on one page are two submissions: keep both.
      const n = (seen.get(base) ?? 0) + 1;
      seen.set(base, n);
      id = n > 1 ? `${base}#${n}` : base;
    }
    const lang = row.match(/<td\s+title='([^']*)'>[^<]*<\/td>\s*<td class="centered"/)?.[1];
    const sub: Submission = {
      id: `codechef:${id}`,
      platform: 'codechef',
      problemKey: `codechef:${code}`,
      title: code,
      url: `https://www.codechef.com${link[1]}`,
      verdict: codechefVerdict(result),
      rawVerdict: result,
      lang,
      ts: time.ts,
      tags: [],
      source: 'api',
      account,
    };
    timeUnitMs.set(sub, UNIT_MS[time.unit]!);
    subs.push(sub);
  }
  return subs;
}

/** Precision of each parsed row's timestamp (not persisted). */
const timeUnitMs = new WeakMap<Submission, number>();

/** CodeChef has no public submissions API; the profile's "recent activity" table is paginated JSON. */
export async function syncCodeChef(
  handle: string,
  cursor: Cursors['codechef'],
  out: Submission[],
  deps: SyncDeps = DEFAULT_DEPS,
): Promise<Cursors['codechef']> {
  // Times have minute precision, so re-read the last minute; the merge de-duplicates.
  const lastTs = cursor && sameHandle(cursor.handle, handle) ? cursor.lastTs : 0;
  let newest = lastTs;
  const maxPages = lastTs ? 4 : 15; // first import: the last ~180 submissions
  // One clock for the whole sync so relative times ("5 min ago") agree across pages.
  const now = deps.now();
  for (let page = 0; page < maxPages; page++) {
    let res: { max_page?: number; content?: string };
    try {
      res = await deps.fetch(`https://www.codechef.com/recent/user?page=${page}&user_handle=${encodeURIComponent(handle)}`);
    } catch (e) {
      if (e instanceof HttpError && e.status === 429) {
        // Rate limited: keep what we already imported and continue on the next run.
        if (page > 0) break;
        throw new Error('CodeChef is rate-limiting requests — will retry automatically in 30 minutes');
      }
      throw e;
    }
    if (typeof res.content !== 'string') throw new Error(`CodeChef: user "${handle}" not found`);
    const subs = parseCodeChefRecent(res.content, now, handle.toLowerCase());
    // Relative times are only accurate to their unit, so compare with that much slack.
    const fresh = subs.filter((s) => s.ts + (timeUnitMs.get(s) ?? 60_000) >= lastTs);
    out.push(...fresh);
    for (const s of fresh) newest = Math.max(newest, s.ts);
    // Newest first: stop once we reach already-imported submissions or the last page.
    if (fresh.length < subs.length || !subs.length || page + 1 >= (res.max_page ?? 0)) break;
    await deps.sleep(2500);
  }
  return { handle, lastTs: newest };
}

// --- GeeksforGeeks ---------------------------------------------------------------------
// GFG publishes solved problems only (no wrong answers) with a solve time in IST.

export interface GfgSolvedItem {
  slug: string;
  pname: string;
  lang?: string;
  user_subtime?: string;
}

/** `2017-07-31 23:34:44` (IST, no zone) -> epoch ms. */
export function parseGfgTime(text: string | undefined): number | null {
  const m = text?.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  return Date.parse(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}+05:30`);
}

export function mapGfgSolved(result: Record<string, Record<string, GfgSolvedItem>>, account?: string): Submission[] {
  const out: Submission[] = [];
  for (const [difficulty, problems] of Object.entries(result ?? {})) {
    for (const [id, p] of Object.entries(problems ?? {})) {
      if (!p?.slug) continue;
      const ts = parseGfgTime(p.user_subtime);
      if (ts === null) continue;
      const slug = p.slug.toLowerCase();
      out.push({
        id: `gfg:${id}`,
        platform: 'gfg',
        problemKey: `gfg:${slug}`,
        title: p.pname || slug,
        url: `https://www.geeksforgeeks.org/problems/${slug}/1`,
        verdict: 'AC',
        rawVerdict: 'Solved',
        lang: p.lang,
        ts,
        tags: [],
        difficulty,
        source: 'api',
        account,
      });
    }
  }
  return out;
}

export async function syncGfg(handle: string, cursor: Cursors['gfg'], out: Submission[], deps: SyncDeps = DEFAULT_DEPS): Promise<Cursors['gfg']> {
  const res = await deps.fetch<{ status?: string; result?: Record<string, Record<string, GfgSolvedItem>>; count?: number }>(
    'https://practiceapi.geeksforgeeks.org/api/v1/user/problems/submissions/',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ handle, requestType: '', year: '', month: '' }) },
  );
  if (res.status !== 'success') throw new Error(`GeeksforGeeks: user "${handle}" not found`);
  // GFG always returns the whole solved list; only hand over what's new since the last sync.
  const lastTs = cursor && sameHandle(cursor.handle, handle) ? cursor.lastTs : 0;
  const subs = mapGfgSolved(res.result ?? {}, handle.toLowerCase());
  out.push(...subs.filter((s) => s.ts > lastTs));

  // Profile numbers are refreshed on every run (best-effort): the solved list is what stats use.
  try {
    const prof = await deps.fetch<{ data?: Record<string, unknown> }>(
      `https://authapi.geeksforgeeks.org/api-get/user-profile-info/?handle=${encodeURIComponent(handle)}&article_count=false&redirect=true`,
    );
    const d = prof.data ?? {};
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
    const profile: PlatformProfile = {
      handle,
      fetchedAt: deps.now(),
      name: typeof d.name === 'string' ? d.name : undefined,
      totalSolved: num(d.total_problems_solved) ?? subs.length,
      score: num(d.score),
      monthlyScore: num(d.monthly_score),
      instituteRank: typeof d.institute_rank === 'string' && d.institute_rank ? d.institute_rank : undefined,
      potdCurrentStreak: num(d.pod_solved_current_streak),
      potdLongestStreak: num(d.pod_solved_longest_streak),
      byDifficulty: Object.fromEntries(Object.entries(res.result ?? {}).map(([k, v]) => [k, Object.keys(v ?? {}).length])),
    };
    const profiles = await getItem('profiles');
    await setItem('profiles', { ...profiles, gfg: profile });
  } catch {
    /* keep the last saved profile */
  }
  let newest = lastTs;
  for (const s of subs) newest = Math.max(newest, s.ts);
  return { handle, lastTs: newest };
}

/** One entry of LeetCode's logged-in `/api/submissions/` history. */
export interface LeetCodeDumpItem {
  id: number | string;
  title: string;
  title_slug: string;
  timestamp: number | string;
  status_display: string;
  lang?: string;
  code?: string;
  is_pending?: string;
}

const PENDING = /^(pending|judging|running)/i;

export function mapLeetCodeDump(items: LeetCodeDumpItem[], account?: string): Submission[] {
  return items
    .filter((s) => s.title_slug && s.status_display && !PENDING.test(s.status_display) && s.is_pending !== 'Pending')
    .map((s) => ({
      id: `leetcode:${s.id}`,
      platform: 'leetcode',
      problemKey: `leetcode:${s.title_slug.toLowerCase()}`,
      title: s.title,
      url: `https://leetcode.com/problems/${s.title_slug}/`,
      verdict: leetcodeVerdict(s.status_display),
      rawVerdict: s.status_display,
      lang: s.lang,
      ts: Number(s.timestamp) * 1000,
      tags: [],
      code: capCode(s.code || undefined),
      source: 'session' as const,
      account,
    }));
}

/**
 * The username of the browser's logged-in LeetCode account: null when logged out, undefined
 * when it can't be determined. Needs the session cookie, which `leetcodeGraphql()` omits.
 */
export async function leetcodeSessionUsername(deps: SyncDeps = DEFAULT_DEPS): Promise<string | null | undefined> {
  try {
    const res = await deps.fetch<{ data?: { userStatus?: { username?: string; isSignedIn?: boolean } | null } }>(
      'https://leetcode.com/graphql',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: '{ userStatus { username isSignedIn } }' }),
        cookies: true,
      },
    );
    const u = res.data?.userStatus;
    if (!u) return undefined;
    return u.isSignedIn && u.username ? u.username : null;
  } catch {
    return undefined;
  }
}

/**
 * Reads the user's full LeetCode history — wrong answers and code included — using the
 * browser's logged-in leetcode.com session. Returns null when not logged in.
 */
export async function syncLeetCodeSession(
  cursor: Cursors['leetcodeSession'],
  username: string | undefined,
  out: Submission[],
  deps: SyncDeps = DEFAULT_DEPS,
): Promise<Cursors['leetcodeSession'] | null> {
  const lastTs = cursor?.lastTs ?? 0;
  const account = username?.toLowerCase();
  let newest = lastTs;
  let lastKey = '';
  const maxPages = cursor ? 5 : 15; // first import: the last ~300 submissions
  for (let page = 0; page < maxPages; page++) {
    let res: { submissions_dump?: LeetCodeDumpItem[]; has_next?: boolean; last_key?: string };
    try {
      res = await deps.fetch(
        `https://leetcode.com/api/submissions/?offset=${page * 20}&limit=20&lastkey=${encodeURIComponent(lastKey)}`,
        { cookies: true },
      );
    } catch (e) {
      if (page === 0 && e instanceof HttpError && (e.status === 401 || e.status === 403)) return null;
      throw e;
    }
    const items = res.submissions_dump ?? [];
    if (page === 0 && !Array.isArray(res.submissions_dump)) return null;
    const fresh = mapLeetCodeDump(items, account).filter((s) => s.ts > lastTs);
    out.push(...fresh);
    for (const s of fresh) newest = Math.max(newest, s.ts);
    // Newest first: once we reach already-imported submissions we're done.
    if (fresh.length < items.length || !res.has_next) break;
    lastKey = res.last_key ?? '';
    await deps.sleep(1200);
  }
  return { lastTs: newest, ...(username ? { username } : {}) };
}

const tagCache = new Map<string, { title: string; difficulty: string; tags: string[] }>();

async function leetcodeQuestion(slug: string) {
  const hit = tagCache.get(slug);
  if (hit) return hit;
  const data = await leetcodeGraphql<{
    question: { title: string; questionFrontendId: string; difficulty: string; topicTags: { name: string }[] } | null;
  }>('query($s: String!) { question(titleSlug: $s) { title questionFrontendId difficulty topicTags { name } } }', { s: slug });
  const q = data.question;
  const info = q
    ? { title: `${q.questionFrontendId}. ${q.title}`, difficulty: q.difficulty, tags: q.topicTags.map((t) => t.name) }
    : { title: slug, difficulty: '', tags: [] };
  tagCache.set(slug, info);
  return info;
}

/** Called when the LeetCode content script sees a judged submission. */
export async function ingestLeetCodeCapture(c: LeetCodeCapture): Promise<Submission> {
  const info = await leetcodeQuestion(c.slug).catch(() => ({ title: c.slug, difficulty: '', tags: [] as string[] }));
  const sub: Submission = {
    id: `leetcode:${c.submissionId}`,
    platform: 'leetcode',
    problemKey: `leetcode:${c.slug.toLowerCase()}`,
    title: info.title,
    url: `https://leetcode.com/problems/${c.slug}/`,
    verdict: leetcodeVerdict(c.statusMsg),
    rawVerdict:
      c.statusMsg + (c.totalTestcases ? ` (${c.totalCorrect ?? 0}/${c.totalTestcases})` : ''),
    lang: c.lang,
    ts: Date.now(),
    tags: info.tags,
    difficulty: info.difficulty || undefined,
    code: capCode(c.code),
    source: 'capture',
    // Captures belong to the logged-in account (as last seen by the session import).
    account: (await getItem('cursors')).leetcodeSession?.username?.toLowerCase(),
  };
  await ingest([sub]);
  return sub;
}

async function run(): Promise<string> {
  const deps = DEFAULT_DEPS;
  const settings = await getSettings();
  const cursors = await getItem('cursors');
  const h = settings.handles;
  const parts: string[] = [];
  const notes: string[] = [];
  const next: Cursors = { ...cursors };

  // A changed (or cleared) handle: drop the old account's imports and start that platform over.
  const purges: Purge[] = [];
  for (const p of planHandleResets(h, cursors)) {
    purges.push({ kind: 'handle', platform: p, handle: (h[p] ?? '').trim(), hasSession: !!cursors.leetcodeSession });
    delete next[p];
  }

  // Every platform collects into one list that is merged with a single storage write.
  const collected: Submission[] = [];
  const tasks: [string, () => Promise<void>][] = [];
  const handle = (p: HandlePlatform) => (h[p] ?? '').trim();
  if (handle('codeforces')) tasks.push(['Codeforces', async () => void (next.codeforces = await syncCodeforces(handle('codeforces'), next.codeforces, collected, deps))]);
  if (handle('codechef')) tasks.push(['CodeChef', async () => void (next.codechef = await syncCodeChef(handle('codechef'), next.codechef, collected, deps))]);
  if (handle('gfg')) tasks.push(['GeeksforGeeks', async () => void (next.gfg = await syncGfg(handle('gfg'), next.gfg, collected, deps))]);
  if (handle('atcoder')) tasks.push(['AtCoder', async () => void (next.atcoder = await syncAtCoder(handle('atcoder'), next.atcoder, collected, deps))]);
  // LeetCode: prefer the logged-in session (every verdict + code); fall back to the public
  // accepted-only list for the username when the browser isn't logged in to leetcode.com.
  tasks.push([
    'LeetCode',
    async () => {
      let sessionCursor = cursors.leetcodeSession;
      const username = await leetcodeSessionUsername(deps);
      if (username && sessionCursor?.username && !sameHandle(sessionCursor.username, username)) {
        // Logged in as someone else now: the imported history belongs to the previous account.
        purges.push({ kind: 'leetcode-session', username });
        sessionCursor = undefined;
        delete next.leetcodeSession;
        delete next.leetcode; // records without a source may have been public-API imports
        notes.push(`LeetCode: switched account to ${username}, re-importing`);
      }
      const session = await syncLeetCodeSession(sessionCursor, username || sessionCursor?.username, collected, deps);
      if (session) {
        next.leetcodeSession = session;
        notes.push('LeetCode: full history via your login');
      } else if (handle('leetcode')) {
        next.leetcode = await syncLeetCode(handle('leetcode'), next.leetcode, collected);
        notes.push('LeetCode: accepted only — log in to leetcode.com to import wrong answers');
      } else {
        notes.push('LeetCode: not logged in');
      }
    },
  ]);

  const results = await Promise.allSettled(tasks.map(([, fn]) => fn()));
  results.forEach((r, i) => {
    if (r.status === 'rejected') parts.push(`${tasks[i]![0]} failed: ${(r.reason as Error).message}`);
  });

  let added = 0;
  let purged = 0;
  let all: Submission[] | null = null;
  if (collected.length || purges.length) {
    all = await updateItem('submissions', (subs) => {
      const kept = applyPurges(subs, purges);
      purged = subs.length - kept.length;
      const r = mergeSubmissions(kept, collected);
      added = r.added;
      return r.merged;
    });
    await markPotdsFromSubmissions(all);
  }
  await updateItem('cursors', () => next);
  await pruneOrphanAnalyses(new Set((all ?? (await getItem('submissions'))).map((s) => s.id)));

  if (parts.length === tasks.length) throw new Error(parts.join('; '));
  if (purged) notes.unshift(`removed ${purged} submissions of a previous account`);
  return [`${added} new submissions`, ...notes, ...parts].join(' · ');
}

export const submissionsAgent: Agent = {
  id: 'submissions',
  name: 'Submission agent',
  description:
    'Syncs your Codeforces, LeetCode, CodeChef, AtCoder and GeeksforGeeks submissions and verdicts; captures LeetCode submissions (with code) as you submit.',
  trigger: 'schedule',
  periodMinutes: 30,
  run,
};
