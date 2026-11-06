import { describe, expect, it } from 'vitest';
import { activityByDay, bestStreak, currentStreak, isActiveDay, revisitList, summarize, tagStats, timeTotals } from '../src/lib/stats';
import { addDays, localDate } from '../src/lib/time';
import type { Submission, Verdict } from '../src/lib/types';

let n = 0;
const sub = (problem: string, verdict: Verdict, ts: number, tags: string[] = []): Submission => ({
  id: `codeforces:${++n}`,
  platform: 'codeforces',
  problemKey: `codeforces:${problem}`,
  title: problem,
  url: `https://codeforces.com/problemset/problem/1/${problem}`,
  verdict,
  rawVerdict: verdict,
  ts,
  tags,
});

const T = new Date('2026-11-04T10:00:00').getTime();
const H = 3_600_000;

const SUBS = [
  sub('A', 'WA', T, ['dp']),
  sub('A', 'WA', T + H, ['dp']),
  sub('A', 'TLE', T + 2 * H, ['dp']),
  sub('A', 'AC', T + 3 * H, ['dp']),
  sub('B', 'AC', T, ['greedy']),
  sub('C', 'WA', T, ['dp']),
  sub('C', 'CE', T + H, ['dp']),
  sub('D', 'AC', T - 2 * 86_400_000, ['dp']),
];

describe('summarize', () => {
  it('counts attempted, solved and verdicts', () => {
    const s = summarize(SUBS);
    expect(s.attempted).toBe(4);
    expect(s.solved).toBe(3);
    expect(s.totalSubs).toBe(8);
    expect(s.acceptedSubs).toBe(3);
    // Compile errors are not "wrong" — the code never ran.
    expect(s.wrongSubs).toBe(4);
    expect(s.verdicts.CE).toBe(1);
  });

  it('respects the range', () => {
    expect(summarize(SUBS, T - H).solved).toBe(2);
  });
});

describe('revisitList', () => {
  it('lists unsolved problems first, then hard-won ones', () => {
    const r = revisitList(SUBS);
    expect(r.map((x) => x.problemKey)).toEqual(['codeforces:C', 'codeforces:A']);
    expect(r[1]!.reason).toBe('Solved after 3 wrong attempts');
  });
});

describe('tagStats', () => {
  it('sorts weakest tags first', () => {
    const t = tagStats(SUBS, 1);
    expect(t[0]!.tag).toBe('dp');
    expect(t[0]!.attempted).toBe(3);
    expect(t[0]!.solved).toBe(2);
  });
});

describe('streaks', () => {
  it('counts consecutive days and tolerates "not yet today"', () => {
    const today = localDate(T);
    const active = new Set([addDays(today, -1), addDays(today, -2), addDays(today, -4)]);
    expect(currentStreak((d) => active.has(d), today)).toBe(2);
    active.add(today);
    expect(currentStreak((d) => active.has(d), today)).toBe(3);
    expect(bestStreak([...active])).toBe(3);
  });

  it('builds activity per day', () => {
    const days = activityByDay(SUBS, { [localDate(T)]: { codeforces: { total: 600, problems: {} } } }, { [localDate(T)]: ['x'] });
    const today = days.get(localDate(T))!;
    expect(today.solved).toBe(2);
    expect(today.seconds).toBe(600);
    expect(today.potd).toBe(1);
    expect(today.total).toBe(3);
  });
});

describe('activityByDay POTD dedupe', () => {
  const day = localDate(T);
  const lc = (slug: string, ts: number, verdict: Verdict = 'AC'): Submission => ({ ...sub(slug, verdict, ts), problemKey: `leetcode:${slug}`, platform: 'leetcode' });

  it('does not count a POTD solved by an accepted submission twice', () => {
    const days = activityByDay([lc('two-sum', T)], {}, { [day]: ['leetcode:two-sum'] });
    const a = days.get(day)!;
    expect(a).toMatchObject({ solved: 1, potd: 0, potdTotal: 1, total: 1 });
  });

  it('counts a POTD marked done without a submission', () => {
    const days = activityByDay([lc('two-sum', T)], {}, { [day]: ['leetcode:two-sum', 'gfg:wave', 'gfg:wave'] });
    expect(days.get(day)).toMatchObject({ solved: 1, potd: 1, potdTotal: 2, total: 2 });
  });

  it('does not count a POTD recorded the day after its accepted solve', () => {
    // US evening solve of the next UTC day's daily: AC yesterday, mark shown under today.
    const yesterday = addDays(day, -1);
    const days = activityByDay([lc('two-sum', T - 86_400_000)], {}, { [day]: ['leetcode:two-sum'] });
    expect(days.get(day)).toMatchObject({ solved: 0, potd: 0, potdTotal: 1, total: 0 });
    expect(days.get(yesterday)).toMatchObject({ solved: 1, total: 1 });
    expect(isActiveDay(days.get(day))).toBe(false);
    expect(isActiveDay(days.get(yesterday))).toBe(true);
  });

  it('a wrong answer does not hide a manually completed POTD', () => {
    const days = activityByDay([lc('two-sum', T, 'WA')], {}, { [day]: ['leetcode:two-sum'] });
    expect(days.get(day)).toMatchObject({ solved: 0, potd: 1, total: 1 });
  });
});

describe('timeTotals', () => {
  it('sums per platform and problem from a date', () => {
    const t = timeTotals(
      {
        '2026-11-01': { leetcode: { total: 100, problems: { 'leetcode:x': 100 } } },
        '2026-11-03': { leetcode: { total: 50, problems: { 'leetcode:x': 50 } }, codeforces: { total: 300, problems: {} } },
      },
      '2026-11-02',
    );
    expect(t.total).toBe(350);
    expect(t.perPlatform[0]).toEqual({ platform: 'codeforces', seconds: 300 });
    expect(t.topProblems[0]).toEqual({ key: 'leetcode:x', platform: 'leetcode', seconds: 50 });
  });
});
