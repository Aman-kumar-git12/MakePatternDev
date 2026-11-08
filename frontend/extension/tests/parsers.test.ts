import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseAtCoderRecent, parseAtCoderUpcoming } from '../src/agents/contests/fetchers';
import { leetcodeVerdict } from '../src/agents/submissions';
import { detectPage } from '../src/lib/platforms';
import { addDays, formatCountdown, formatDuration, googleCalendarUrl } from '../src/lib/time';

describe('parseAtCoderUpcoming', () => {
  const html = readFileSync(new URL('./fixtures/atcoder-contests.html', import.meta.url), 'utf8');
  const contests = parseAtCoderUpcoming(html);

  it('parses every upcoming row', () => {
    expect(contests.length).toBe(6);
  });

  it('converts JST times and durations', () => {
    const abc = contests.find((c) => c.id === 'atcoder:abc483')!;
    expect(abc.name).toBe('AtCoder Beginner Contest 483');
    expect(abc.url).toBe('https://atcoder.jp/contests/abc483');
    expect(new Date(abc.start).toISOString()).toBe('2026-11-07T12:00:00.000Z');
    expect(abc.durationSec).toBe(100 * 60);
  });

  it('decodes entities and throws on unknown layouts', () => {
    expect(contests.every((c) => !c.name.includes('&amp;'))).toBe(true);
    expect(() => parseAtCoderUpcoming('<html></html>')).toThrow(/layout/);
  });
});

describe('parseAtCoderRecent', () => {
  const row = (code: string, time: string) => `<tr>
    <td class="text-center"><a href='#'><time class='fixtime fixtime-full'>${time}</time></a></td>
    <td ><span>Ⓐ</span> <a href="/contests/${code}">AtCoder Beginner Contest ${code.slice(3)}</a></td>
    <td class="text-center">01:40</td>
    <td class="text-center"> - 1999</td>
  </tr>`;
  const html = `<div id="contest-table-recent"><table><tbody>${['abc483', 'abc482', 'abc481', 'abc480', 'abc479']
    .map((c, i) => row(c, `2026-11-0${7 - i} 21:00:00+0900`))
    .join('')}</tbody></table></div>`;

  it('keeps only the latest 4 finished contests, newest first', () => {
    const recent = parseAtCoderRecent(html);
    expect(recent.map((c) => c.id)).toEqual(['atcoder:abc483', 'atcoder:abc482', 'atcoder:abc481', 'atcoder:abc480']);
    expect(recent[0]!.durationSec).toBe(100 * 60);
  });

  it('returns nothing (instead of failing) when the page has no recent table', () => {
    expect(parseAtCoderRecent('<html></html>')).toEqual([]);
  });
});

describe('detectPage', () => {
  it.each([
    ['https://leetcode.com/problems/two-sum/description/', 'leetcode', 'leetcode:two-sum'],
    ['https://codeforces.com/contest/1843/problem/c', 'codeforces', 'codeforces:1843C'],
    ['https://codeforces.com/problemset/problem/4/A', 'codeforces', 'codeforces:4A'],
    ['https://www.codechef.com/START100/problems/abc', 'codechef', 'codechef:ABC'],
    ['https://atcoder.jp/contests/abc300/tasks/abc300_a', 'atcoder', 'atcoder:abc300_a'],
    ['https://www.geeksforgeeks.org/problems/possible-paths--141628/1', 'gfg', 'gfg:possible-paths--141628'],
    ['https://www.naukri.com/code360/problems/reverse-the-string_799927', 'code360', 'code360:reverse-the-string_799927'],
  ])('%s', (url, platform, key) => {
    expect(detectPage(url)).toEqual({ platform, problemKey: key });
  });

  it('recognises platform pages that are not problems', () => {
    expect(detectPage('https://leetcode.com/contest/')).toEqual({ platform: 'leetcode', problemKey: null });
  });

  it('ignores other sites', () => {
    expect(detectPage('https://www.youtube.com/watch?v=1')).toBeNull();
    expect(detectPage('https://www.naukri.com/jobs')).toBeNull();
    expect(detectPage('chrome://extensions')).toBeNull();
    expect(detectPage(undefined)).toBeNull();
  });
});

describe('leetcodeVerdict', () => {
  it.each([
    ['Accepted', 'AC'],
    ['Wrong Answer', 'WA'],
    ['Time Limit Exceeded', 'TLE'],
    ['Memory Limit Exceeded', 'MLE'],
    ['Runtime Error', 'RE'],
    ['Compile Error', 'CE'],
    ['Output Limit Exceeded', 'WA'],
    ['Internal Error', 'OTHER'],
  ])('%s -> %s', (msg, v) => expect(leetcodeVerdict(msg)).toBe(v));
});

describe('time helpers', () => {
  it('formats', () => {
    expect(formatDuration(59)).toBe('59s');
    expect(formatDuration(3725)).toBe('1h 2m');
    expect(formatCountdown(3_723_000)).toBe('01:02:03');
    expect(formatCountdown(3 * 86_400_000 + 4 * 3_600_000)).toBe('3d 4h');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('builds Google Calendar links in UTC', () => {
    const url = new URL(googleCalendarUrl('Weekly Contest', Date.UTC(2026, 10, 8, 2, 30), 5400, 'https://leetcode.com'));
    expect(url.searchParams.get('dates')).toBe('20261108T023000Z/20261108T040000Z');
  });
});

describe('mapLeetCodeDump', () => {
  it('maps every verdict, keeps code and skips pending submissions', async () => {
    const { mapLeetCodeDump } = await import('../src/agents/submissions');
    const subs = mapLeetCodeDump([
      { id: 11, title: 'Two Sum', title_slug: 'two-sum', timestamp: '1793700000', status_display: 'Wrong Answer', lang: 'cpp', code: 'int x;' },
      { id: 12, title: 'Two Sum', title_slug: 'two-sum', timestamp: 1793700100, status_display: 'Accepted', lang: 'cpp' },
      { id: 13, title: 'Two Sum', title_slug: 'two-sum', timestamp: 1793700200, status_display: 'Pending' },
    ]);
    expect(subs.map((s) => [s.id, s.verdict])).toEqual([
      ['leetcode:11', 'WA'],
      ['leetcode:12', 'AC'],
    ]);
    expect(subs[0]!.code).toBe('int x;');
    expect(subs[0]!.ts).toBe(1793700000000);
    expect(subs[0]!.problemKey).toBe('leetcode:two-sum');
  });
});

describe('parseTufPotd', () => {
  it("reads Striver's problem of the day from the takeuforward.org/potd page", async () => {
    const { gunzipSync } = await import('node:zlib');
    const { parseTufPotd } = await import('../src/agents/potd/tuf');
    const html = gunzipSync(readFileSync(new URL('./fixtures/tuf-potd.html.gz', import.meta.url))).toString('utf8');
    const p = parseTufPotd(html);
    expect(p.title).toBe("Find row with maximum 1's");
    expect(p.key).toBe("tuf:find-row-with-maximum-1's");
    expect(p.date).toBe('2026-11-04');
    expect(p.url).toBe('https://takeuforward.org/practice/dsa/find-row-with-maximum-1\'s');
    expect(p.difficulty).toBe('Core');
    expect(p.note).toBe('83% acceptance · 632 attempts');
    expect(p.solved).toBe(false);
    // The link icon opens the question itself, not the /potd listing.
    expect(p.extraUrl).toBe(p.url);
    expect(() => parseTufPotd('<html></html>')).toThrow(/not found/);
  });

  it('only accepts TUF\'s own takeuforward.org /practice/ question links', async () => {
    const { tufQuestionUrl } = await import('../src/agents/potd/tuf');
    expect(tufQuestionUrl("/practice/dsa/find-row-with-maximum-1's")).toBe("https://takeuforward.org/practice/dsa/find-row-with-maximum-1's");
    expect(() => tufQuestionUrl(undefined)).toThrow(/no question link/);
    expect(() => tufQuestionUrl('/potd')).toThrow(/practice/);
    expect(() => tufQuestionUrl('https://leetcode.com/problems/two-sum/')).toThrow(/practice/);
    expect(() => tufQuestionUrl('https://evil.example/practice/dsa/x')).toThrow(/practice/);
  });

  it('caches the TUF problem of the day for 30 minutes and shares concurrent fetches', async () => {
    const { gunzipSync } = await import('node:zlib');
    const { fetchTufPotd, resetTufCache, TUF_CACHE_MS } = await import('../src/agents/potd/tuf');
    const html = gunzipSync(readFileSync(new URL('./fixtures/tuf-potd.html.gz', import.meta.url))).toString('utf8');
    resetTufCache();
    let calls = 0;
    const page = async () => {
      calls++;
      return html;
    };
    const [a, b] = await Promise.all([fetchTufPotd(1_000, page, page), fetchTufPotd(1_000, page, page)]);
    expect(calls).toBe(1);
    expect(a).toBe(b);
    expect(a.fetchedAt).toBe(1_000);
    await fetchTufPotd(1_000 + TUF_CACHE_MS - 1, page, page);
    expect(calls).toBe(1);
    await fetchTufPotd(1_000 + TUF_CACHE_MS + 1, page, page);
    expect(calls).toBe(2);
    // A failed refresh doesn't poison the cache or leave a stuck in-flight request.
    resetTufCache();
    const blank = async () => '<html></html>';
    await expect(fetchTufPotd(5, blank, blank)).rejects.toThrow(/not found/);
    expect((await fetchTufPotd(6, page, blank)).title).toBe("Find row with maximum 1's");
    resetTufCache();
  });

  it('falls back to the public page when the logged-in page cannot be read', async () => {
    const { gunzipSync } = await import('node:zlib');
    const { fetchTufPotd, resetTufCache } = await import('../src/agents/potd/tuf');
    const html = gunzipSync(readFileSync(new URL('./fixtures/tuf-potd.html.gz', import.meta.url))).toString('utf8');
    resetTufCache();
    const loggedIn = async () => '<html>a different logged-in layout</html>';
    const p = await fetchTufPotd(1, loggedIn, async () => html);
    expect(p.title).toBe("Find row with maximum 1's");
    expect(p.url).toBe("https://takeuforward.org/practice/dsa/find-row-with-maximum-1's");
    expect(p.solved).toBe(false);
    // Logged-in network failure (e.g. blocked) also falls back.
    resetTufCache();
    const q = await fetchTufPotd(2, async () => Promise.reject(new Error('HTTP 403')), async () => html);
    expect(q.title).toBe("Find row with maximum 1's");
    // Both failing reports both reasons.
    resetTufCache();
    await expect(fetchTufPotd(3, async () => Promise.reject(new Error('HTTP 403')), async () => '<html></html>')).rejects.toThrow(/logged-in page: request failed: HTTP 403 · public page: load failed: .*not found/);
    resetTufCache();
  });

  it('reads logged-in pages whose query key has extra parts', async () => {
    const { gunzipSync } = await import('node:zlib');
    const { parseTufPotd } = await import('../src/agents/potd/tuf');
    const html = gunzipSync(readFileSync(new URL('./fixtures/tuf-potd.html.gz', import.meta.url))).toString('utf8');
    const withUser = html.split('\\"queryKey\\":[\\"potd\\",\\"today\\",\\"dsa\\"]').join('\\"queryKey\\":[\\"potd\\",\\"today\\",\\"dsa\\",\\"user-123\\"]');
    expect(withUser).not.toBe(html);
    expect(parseTufPotd(withUser).title).toBe("Find row with maximum 1's");
  });

  it('maps TUF practice pages to the same problem key', () => {
    expect(detectPage("https://takeuforward.org/practice/dsa/find-row-with-maximum-1's")?.problemKey).toBe("tuf:find-row-with-maximum-1's");
    expect(detectPage('https://takeuforward.org/practice/dsa/find-row-with-maximum-1%27s')?.problemKey).toBe("tuf:find-row-with-maximum-1's");
  });
});

describe('CodeChef submissions', () => {
  it('parses the recent-activity table with every verdict', async () => {
    const { parseCodeChefRecent } = await import('../src/agents/submissions');
    const { content } = JSON.parse(readFileSync(new URL('./fixtures/codechef-recent.json', import.meta.url), 'utf8'));
    const subs = parseCodeChefRecent(content);
    expect(subs.length).toBe(12);
    const first = subs[0]!;
    expect(first.id).toMatch(/^codechef:\d+$/);
    expect(first.problemKey).toMatch(/^codechef:[A-Z0-9_]+$/);
    expect(first.url).toMatch(/^https:\/\/www\.codechef\.com\/([\w-]+\/)?problems\/[\w-]+$/);
    expect(first.lang).toBeTruthy();
    expect(new Set(subs.map((s) => s.verdict))).toEqual(new Set(['AC', 'WA', 'RE']));
    expect(subs.find((s) => s.verdict === 'RE')!.rawVerdict).toBe('runtime error(SIGABRT)');
  });

  it('converts IST times and relative times', async () => {
    const { parseCodeChefTime, codechefVerdict } = await import('../src/agents/submissions');
    // 08:01 PM IST on 17 Jul 2022 = 14:31 UTC
    expect(new Date(parseCodeChefTime('08:01 PM 17/07/22')!).toISOString()).toBe('2022-07-17T14:31:00.000Z');
    expect(new Date(parseCodeChefTime('12:05 AM 01/01/24')!).toISOString()).toBe('2023-12-31T18:35:00.000Z');
    expect(parseCodeChefTime('5 min ago', 1_000_000_000)).toBe(1_000_000_000 - 300_000);
    expect(codechefVerdict('partially accepted')).toBe('WA');
    expect(codechefVerdict('compilation error')).toBe('CE');
  });
});

describe('POTD links', () => {
  it('opens the LeetCode daily problem with the daily-challenge parameters', async () => {
    const { leetcodeDailyUrl } = await import('../src/agents/potd/fetchers');
    const url = leetcodeDailyUrl('minimum-operations-to-make-elements-within-k-subarrays-equal', '2026-11-04');
    expect(url).toBe(
      'https://leetcode.com/problems/minimum-operations-to-make-elements-within-k-subarrays-equal/description/?envType=daily-question&envId=2026-11-04',
    );
    expect(detectPage(url)?.problemKey).toBe('leetcode:minimum-operations-to-make-elements-within-k-subarrays-equal');
  });
});
