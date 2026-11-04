import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  applyPurges,
  ingest,
  MAX_CODE_CHARS,
  mergeSubmissions,
  parseCodeChefRecent,
  planHandleResets,
  submissionsAgent,
  syncAtCoder,
  syncCodeChef,
  syncCodeforces,
  type SyncDeps,
} from '../src/agents/submissions';
import { DEFAULT_SETTINGS, getItem, setItem } from '../src/lib/storage';
import type { Submission } from '../src/lib/types';

vi.mock('wxt/browser', async () => ({ browser: (await import('wxt/testing/fake-browser')).fakeBrowser }));

const sub = (id: string, over: Partial<Submission> = {}): Submission => ({
  id,
  platform: id.split(':')[0] as Submission['platform'],
  problemKey: `${id.split(':')[0]}:P`,
  title: 'P',
  url: '',
  verdict: 'AC',
  rawVerdict: 'Accepted',
  ts: 1_000,
  tags: [],
  ...over,
});

/** Deps whose fetch answers from a handler and never waits. */
function deps(handler: (url: string) => unknown, now = Date.parse('2026-11-04T12:00:00Z')): SyncDeps & { urls: string[] } {
  const urls: string[] = [];
  return {
    urls,
    fetch: (async (url: string) => {
      urls.push(url);
      return handler(url);
    }) as SyncDeps['fetch'],
    sleep: async () => undefined,
    now: () => now,
  };
}

beforeEach(() => fakeBrowser.reset());

describe('mergeSubmissions / ingest', () => {
  it('dedupes by id and keeps the richer browser capture', () => {
    const capture = sub('leetcode:1', { code: 'print(1)', tags: ['dp'], source: 'capture' });
    const api = sub('leetcode:1', { tags: [], source: 'session', lang: 'python3' });
    const { merged, added } = mergeSubmissions([capture], [api, sub('leetcode:2', { ts: 2_000 })]);
    expect(added).toBe(1);
    expect(merged.map((s) => s.id)).toEqual(['leetcode:1', 'leetcode:2']);
    expect(merged[0]).toMatchObject({ code: 'print(1)', tags: ['dp'], source: 'session', lang: 'python3' });
  });

  it('LeetCode session history overrides an unverified capture', () => {
    const capture = sub('leetcode:7', {
      source: 'capture',
      verdict: 'AC',
      rawVerdict: 'Accepted (10/10)',
      lang: 'python3',
      code: 'page-supplied',
      tags: ['dp'],
      title: '7. Reverse Integer',
      ts: 5_000,
      unverified: true,
    });
    const server = sub('leetcode:7', { source: 'session', account: 'me', verdict: 'WA', rawVerdict: 'Wrong Answer', lang: 'cpp', code: 'real', ts: 4_000 });
    const [m] = mergeSubmissions([capture], [server]).merged;
    expect(m).not.toHaveProperty('unverified');
    expect(m).toMatchObject({ verdict: 'WA', rawVerdict: 'Wrong Answer', lang: 'cpp', code: 'real', ts: 4_000, source: 'session', account: 'me' });
    // Capture-only extras are kept.
    expect(m).toMatchObject({ tags: ['dp'], title: '7. Reverse Integer' });
    // Non-authoritative backfills (e.g. the public API) don't clear the flag.
    const [m2] = mergeSubmissions([capture], [sub('leetcode:7', { source: 'api' })]).merged;
    expect(m2).toMatchObject({ unverified: true, code: 'page-supplied' });
  });

  it('caps code size and strips code from old submissions', () => {
    const many = Array.from({ length: 250 }, (_, i) => sub(`leetcode:${i}`, { ts: i, code: 'x' }));
    const big = sub('leetcode:big', { ts: 10_000, code: 'y'.repeat(MAX_CODE_CHARS + 500) });
    const { merged } = mergeSubmissions([], [...many, big]);
    expect(merged.at(-1)!.code!.length).toBe(MAX_CODE_CHARS);
    expect(merged.filter((s) => s.code).length).toBe(200);
    expect(merged[0]!.code).toBeUndefined(); // oldest lost its code
  });

  it('ingest writes once and counts new records', async () => {
    expect(await ingest([sub('codeforces:1'), sub('codeforces:2')])).toBe(2);
    expect(await ingest([sub('codeforces:2'), sub('codeforces:3')])).toBe(1);
    expect((await getItem('submissions')).map((s) => s.id)).toEqual(['codeforces:1', 'codeforces:2', 'codeforces:3']);
  });
});

describe('CodeChef rows without a solution id', () => {
  const row = (time: string, code: string, result: string, solution?: string) =>
    `<tr><td title='${time}'>${time}</td><td><a href='/problems/${code}'>${code}</a></td>` +
    `<td><span title='${result}'></span></td><td title='C++'>C++</td><td class="centered">` +
    (solution ? `<a href='/viewsolution/${solution}'>View</a>` : '') +
    `</td></tr>`;
  const T0 = Date.parse('2026-11-04T12:00:00Z');
  const MIN = 60_000;

  it('keeps one record when a relative time drifts between syncs', () => {
    const first = parseCodeChefRecent(row('25 min ago', 'ABC', 'wrong answer'), T0);
    const merged1 = mergeSubmissions([], first).merged;
    // 7 minutes later the same row reads "32 min ago" (a slightly different ts).
    const second = parseCodeChefRecent(row('32 min ago', 'ABC', 'wrong answer'), T0 + 7 * MIN + 20_000);
    expect(second[0]!.id).not.toBe(first[0]!.id);
    const { merged, added } = mergeSubmissions(merged1, second);
    expect(added).toBe(0);
    expect(merged).toHaveLength(1);
  });

  it('corrects the time when the row switches to an absolute time', () => {
    const rel = parseCodeChefRecent(row('2 hours ago', 'ABC', 'accepted'), T0);
    // 12:00Z - 2h = 10:00Z = 03:30 PM IST; shown the next day as an absolute IST time.
    const abs = parseCodeChefRecent(row('03:25 PM 04/11/26', 'ABC', 'accepted'), T0 + 86_400_000);
    const { merged, added } = mergeSubmissions(mergeSubmissions([], rel).merged, abs);
    expect(added).toBe(0);
    expect(merged).toHaveLength(1);
    expect(new Date(merged[0]!.ts).toISOString()).toBe('2026-11-04T09:55:00.000Z');
  });

  it('keeps genuinely different submissions apart', () => {
    const page = row('5 min ago', 'ABC', 'wrong answer') + row('5 min ago', 'ABC', 'wrong answer') + row('40 min ago', 'ABC', 'wrong answer');
    const first = parseCodeChefRecent(page, T0);
    expect(new Set(first.map((s) => s.id)).size).toBe(3);
    const stored = mergeSubmissions([], first).merged;
    // Next sync: the three old rows drifted, plus one new submission.
    const next = parseCodeChefRecent(
      row('1 min ago', 'ABC', 'wrong answer') + row('8 min ago', 'ABC', 'wrong answer') + row('8 min ago', 'ABC', 'wrong answer') + row('43 min ago', 'ABC', 'wrong answer'),
      T0 + 3 * MIN + 20_000,
    );
    const { merged, added } = mergeSubmissions(stored, next);
    expect(added).toBe(1);
    expect(merged).toHaveLength(4);
  });

  it('a different verdict is a different submission', () => {
    const stored = mergeSubmissions([], parseCodeChefRecent(row('25 min ago', 'ABC', 'wrong answer'), T0)).merged;
    const { added } = mergeSubmissions(stored, parseCodeChefRecent(row('26 min ago', 'ABC', 'accepted'), T0 + MIN));
    expect(added).toBe(1);
  });

  it('rows with a solution id use it', () => {
    expect(parseCodeChefRecent(row('5 min ago', 'ABC', 'accepted', '987'), T0)[0]!.id).toBe('codechef:987');
  });

  it('incremental sync re-reads relative rows near the cursor without duplicating', async () => {
    const d1 = deps(() => ({ max_page: 1, content: row('10 min ago', 'ABC', 'accepted') }), T0);
    const out1: Submission[] = [];
    const c1 = await syncCodeChef('chef', undefined, out1, d1);
    const d2 = deps(() => ({ max_page: 1, content: row('5 min ago', 'XYZ', 'accepted') + row('15 min ago', 'ABC', 'accepted') }), T0 + 5 * MIN + 20_000);
    const out2: Submission[] = [];
    await syncCodeChef('chef', c1, out2, d2);
    const { merged } = mergeSubmissions(mergeSubmissions([], out1).merged, out2);
    expect(merged.map((s) => s.problemKey).sort()).toEqual(['codechef:ABC', 'codechef:XYZ']);
  });
});

describe('syncCodeforces', () => {
  const cfRow = (id: number, verdict: string | undefined = 'OK') => ({
    id,
    creationTimeSeconds: id,
    programmingLanguage: 'C++',
    verdict,
    problem: { contestId: 1, index: 'A', name: 'A', tags: [] },
  });
  const range = (hi: number, lo: number) => Array.from({ length: hi - lo + 1 }, (_, i) => hi - i);

  it('pages back until it reaches the cursor', async () => {
    const all = range(1250, 900).map((id) => cfRow(id));
    const d = deps((url) => {
      const u = new URL(url);
      const from = Number(u.searchParams.get('from'));
      const count = Number(u.searchParams.get('count'));
      return { status: 'OK', result: all.slice(from - 1, from - 1 + count) };
    });
    const out: Submission[] = [];
    const cursor = await syncCodeforces('tourist', { handle: 'tourist', lastId: 1000 }, out, d);
    expect(d.urls.map((u) => new URL(u).searchParams.get('from'))).toEqual(['1', '101']);
    expect(out).toHaveLength(250);
    expect(cursor).toEqual({ handle: 'tourist', lastId: 1250 });
  });

  it('does not advance past a submission still being judged', async () => {
    const rows = [cfRow(1005), cfRow(1004, 'TESTING'), cfRow(1003), cfRow(1000)];
    const out: Submission[] = [];
    const cursor = await syncCodeforces('tourist', { handle: 'Tourist', lastId: 1000 }, out, deps(() => ({ status: 'OK', result: rows })));
    expect(out.map((s) => s.id)).toEqual(['codeforces:1005', 'codeforces:1003']);
    expect(cursor!.lastId).toBe(1003);
  });

  it('imports up to 2000 on a fresh handle in one call', async () => {
    const d = deps(() => ({ status: 'OK', result: [cfRow(5)] }));
    await syncCodeforces('tourist', { handle: 'someone-else', lastId: 1000 }, [], d);
    expect(d.urls).toHaveLength(1);
    expect(d.urls[0]).toContain('count=2000');
  });
});

describe('syncAtCoder', () => {
  const row = (id: number, epoch: number, result: string) => ({ id, epoch_second: epoch, problem_id: 'abc300_a', contest_id: 'abc300', language: 'C++', result });

  it('keeps the cursor at the earliest pending submission', async () => {
    const out: Submission[] = [];
    const rows = [row(1, 1_000, 'AC'), row(2, 1_010, 'WJ'), row(3, 1_020, 'WA')];
    const cursor = await syncAtCoder('me', { handle: 'me', fromSecond: 1_000 }, out, deps(() => rows, 1_100_000));
    expect(out.map((s) => s.id)).toEqual(['atcoder:1', 'atcoder:3']);
    expect(cursor).toEqual({ handle: 'me', fromSecond: 1_010 });
  });

  it('treats in-progress judging ("3/10") as pending', async () => {
    const rows = [row(1, 1_000, 'AC'), row(2, 1_005, '3/10')];
    const cursor = await syncAtCoder('me', { handle: 'me', fromSecond: 1_000 }, [], deps(() => rows, 1_100_000));
    expect(cursor!.fromSecond).toBe(1_005);
  });

  it('does not stall on a submission stuck pending for over a day', async () => {
    const rows = [row(1, 1_000, 'WJ'), row(2, 1_020, 'AC')];
    const cursor = await syncAtCoder('me', { handle: 'me', fromSecond: 1_000 }, [], deps(() => rows, 1_000_000 + 2 * 86_400_000));
    expect(cursor!.fromSecond).toBe(1_021);
  });
});

describe('handle changes', () => {
  const handles = { ...DEFAULT_SETTINGS.handles, codeforces: 'Bob', atcoder: 'same', leetcode: 'carol' };

  it('plans resets for changed or cleared handles only', () => {
    expect(
      planHandleResets(handles, {
        codeforces: { handle: 'alice', lastId: 5 },
        atcoder: { handle: 'SAME', fromSecond: 1 },
        codechef: { handle: 'chef', lastTs: 1 },
        leetcode: { handle: 'carol', lastTs: 1 },
        leetcodeSession: { lastTs: 1 },
      }),
    ).toEqual(['codeforces', 'codechef']);
  });

  it('purges the old account of a platform and nothing else', () => {
    const subs = [
      sub('codeforces:1', { account: 'alice', source: 'api' }),
      sub('codeforces:2'), // stored before accounts were recorded
      sub('codeforces:3', { account: 'bob', source: 'api' }),
      sub('atcoder:1'),
    ];
    const kept = applyPurges(subs, [{ kind: 'handle', platform: 'codeforces', handle: 'Bob', hasSession: false }]);
    expect(kept.map((s) => s.id)).toEqual(['codeforces:3', 'atcoder:1']);
    expect(applyPurges(subs, [{ kind: 'handle', platform: 'codeforces', handle: '', hasSession: false }]).map((s) => s.id)).toEqual(['atcoder:1']);
  });

  it('a LeetCode handle change keeps session imports and captures', () => {
    const subs = [
      sub('leetcode:1', { source: 'api', account: 'alice' }),
      sub('leetcode:2', { source: 'session', account: 'me' }),
      sub('leetcode:3', { source: 'capture' }),
      sub('leetcode:4'),
    ];
    const purge = (hasSession: boolean) =>
      applyPurges(subs, [{ kind: 'handle', platform: 'leetcode', handle: 'carol', hasSession }]).map((s) => s.id);
    expect(purge(true)).toEqual(['leetcode:2', 'leetcode:3', 'leetcode:4']);
    // Without any session import, old unlabeled records can only be public-API imports.
    expect(purge(false)).toEqual(['leetcode:2', 'leetcode:3']);
  });
});

describe('LeetCode session account switch', () => {
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  const dumpItem = (id: number, ts: number) => ({ id, title: 'Two Sum', title_slug: 'two-sum', timestamp: ts, status_display: 'Accepted', lang: 'python3' });

  function stubLeetCode(username: string | Error, dump: unknown[]) {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/graphql')) {
        if (username instanceof Error) throw username;
        return json({ data: { userStatus: { username, isSignedIn: true } } });
      }
      if (url.includes('/api/submissions/')) return json({ submissions_dump: dump, has_next: false });
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  afterEach(() => vi.unstubAllGlobals());

  async function seed() {
    await setItem('settings', DEFAULT_SETTINGS);
    await setItem('cursors', { leetcodeSession: { lastTs: 5_000_000, username: 'alice' } });
    await setItem('submissions', [
      sub('leetcode:1', { source: 'session', account: 'alice' }),
      sub('leetcode:2', { source: 'capture', account: 'alice', code: 'x' }),
      sub('leetcode:3', { source: 'api', account: 'carol' }),
      sub('leetcode:4'),
      sub('codeforces:9', { source: 'api', account: 'bob' }),
    ]);
  }

  it('purges the previous account and re-imports from scratch', async () => {
    await seed();
    const fetchMock = stubLeetCode('Bob', [dumpItem(100, 1_000)]);
    const msg = await submissionsAgent.run();
    const ids = (await getItem('submissions')).map((s) => s.id).sort();
    // Old session/capture/unlabeled records are gone; the public-API import and other platforms stay.
    expect(ids).toEqual(['codeforces:9', 'leetcode:100', 'leetcode:3']);
    // Restarted: an old timestamp (before the previous cursor) was still imported.
    expect((await getItem('cursors')).leetcodeSession).toEqual({ lastTs: 1_000_000, username: 'Bob' });
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/graphql'))).toBe(true);
    expect(msg).toMatch(/removed 3 submissions/);
  });

  it('keeps everything when the account is the same or unknown', async () => {
    await seed();
    stubLeetCode('ALICE', [dumpItem(101, 6_000)]);
    await submissionsAgent.run();
    expect((await getItem('submissions')).map((s) => s.id)).toContain('leetcode:1');
    expect((await getItem('submissions')).find((s) => s.id === 'leetcode:101')).toMatchObject({ source: 'session', account: 'alice' });

    await seed();
    stubLeetCode(new Error('offline'), []);
    await submissionsAgent.run();
    expect((await getItem('submissions')).map((s) => s.id)).toContain('leetcode:1');
    expect((await getItem('cursors')).leetcodeSession?.username).toBe('alice');
  });

  it('records the username on a legacy cursor without purging', async () => {
    await seed();
    await setItem('cursors', { leetcodeSession: { lastTs: 5_000_000 } });
    stubLeetCode('bob', []);
    await submissionsAgent.run();
    expect((await getItem('submissions')).map((s) => s.id)).toContain('leetcode:1');
    expect((await getItem('cursors')).leetcodeSession?.username).toBe('bob');
  });
});

describe('handle change during a sync run', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('purges the old handle and resets its cursor', async () => {
    await setItem('settings', { ...DEFAULT_SETTINGS, handles: { ...DEFAULT_SETTINGS.handles, atcoder: '' } });
    await setItem('cursors', { atcoder: { handle: 'old', fromSecond: 99 } });
    await setItem('submissions', [sub('atcoder:1', { account: 'old', source: 'api' }), sub('codeforces:1')]);
    // LeetCode: not logged in.
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 401 }));
    await submissionsAgent.run();
    expect((await getItem('submissions')).map((s) => s.id)).toEqual(['codeforces:1']);
    expect((await getItem('cursors')).atcoder).toBeUndefined();
  });
});
