import { describe, expect, it } from 'vitest';
import { applyPotdMarks, computePotdMarks, potdWindow } from '../src/agents/potd/done';
import type { Potd, Submission } from '../src/lib/types';

/** Calendar date in a fixed UTC offset (minutes), independent of the machine's timezone. */
const dateIn = (offsetMin: number) => (ts: number) => new Date(ts + offsetMin * 60_000).toISOString().slice(0, 10);
const PST = -8 * 60; // America/Los_Angeles in November
const IST = 330;

const lcDaily = (date: string, slug = 'two-sum'): Potd => ({
  source: 'leetcode',
  platform: 'leetcode',
  key: `leetcode:${slug}`,
  title: slug,
  url: `https://leetcode.com/problems/${slug}/`,
  tags: [],
  date,
});

const gfgPotd = (date: string): Potd => ({
  source: 'gfg',
  platform: 'gfg',
  key: 'gfg:wave-array',
  title: 'Wave Array',
  url: 'https://www.geeksforgeeks.org/problems/wave-array/1',
  tags: [],
  date,
});

const ac = (key: string, iso: string, verdict: Submission['verdict'] = 'AC'): Submission => ({
  id: `x:${key}:${iso}`,
  platform: key.split(':')[0] as Submission['platform'],
  problemKey: key,
  title: key,
  url: '',
  verdict,
  rawVerdict: verdict,
  ts: Date.parse(iso),
  tags: [],
});

describe('potdWindow', () => {
  it('uses UTC days for LeetCode and IST days for GFG', () => {
    expect(potdWindow(lcDaily('2026-11-04'))!.map((t) => new Date(t).toISOString())).toEqual([
      '2026-11-04T00:00:00.000Z',
      '2026-11-05T00:00:00.000Z',
    ]);
    expect(new Date(potdWindow(gfgPotd('2026-11-04'))![0]).toISOString()).toBe('2026-11-03T18:30:00.000Z');
    expect(potdWindow({ ...lcDaily(''), date: '' })).toBeNull();
  });
});

describe('computePotdMarks across timezones', () => {
  // US user, 17:00 PST on Nov 3 = 01:00 UTC Nov 4: LeetCode already shows Nov 4's daily.
  const solvedAt = '2026-11-04T01:00:00Z';
  const subs = [ac('leetcode:two-sum', solvedAt)];
  const items = [lcDaily('2026-11-04')];

  it('marks under the local date the UI shows at solve time', () => {
    const marks = computePotdMarks(items, subs, Date.parse('2026-11-04T01:05:00Z'), dateIn(PST));
    expect(marks).toEqual([{ key: 'leetcode:two-sum', date: '2026-11-03', clear: ['2026-11-04'] }]);
  });

  it('still shows it done after local midnight while the same daily is live', () => {
    // 09:00 PST Nov 4 — the Nov 4 (UTC) daily is still current.
    const marks = computePotdMarks(items, subs, Date.parse('2026-11-04T17:00:00Z'), dateIn(PST));
    expect(marks).toEqual([{ key: 'leetcode:two-sum', date: '2026-11-04', clear: ['2026-11-03'] }]);
    // Moving the mark keeps a single completion for the POTD.
    const done = applyPotdMarks({ '2026-11-03': ['leetcode:two-sum', 'gfg:other'] }, marks);
    expect(done).toEqual({ '2026-11-03': ['gfg:other'], '2026-11-04': ['leetcode:two-sum'] });
  });

  it('ignores a solve of the same problem before it became the daily', () => {
    const early = [ac('leetcode:two-sum', '2026-11-03T20:00:00Z')]; // 12:00 PST Nov 3, still Nov 3 UTC
    expect(computePotdMarks(items, early, Date.parse('2026-11-04T02:00:00Z'), dateIn(PST))).toEqual([]);
  });

  it('IST user solving yesterday-UTC daily after local midnight', () => {
    // 02:00 IST Nov 4 = 20:30 UTC Nov 3 → LeetCode's Nov 3 daily.
    const s = [ac('leetcode:two-sum', '2026-11-03T20:30:00Z')];
    const marks = computePotdMarks([lcDaily('2026-11-03')], s, Date.parse('2026-11-03T20:31:00Z'), dateIn(IST));
    expect(marks[0]).toMatchObject({ date: '2026-11-04' });
  });

  it('GFG uses the IST day', () => {
    // 23:00 IST Nov 4 = 17:30 UTC Nov 4: inside GFG's Nov 4 window.
    const s = [ac('gfg:wave-array', '2026-11-04T17:30:00Z')];
    expect(computePotdMarks([gfgPotd('2026-11-04')], s, Date.parse('2026-11-04T17:31:00Z'), dateIn(IST))[0]).toMatchObject({
      date: '2026-11-04',
    });
    // 00:30 IST Nov 5 is already the next GFG day.
    const late = [ac('gfg:wave-array', '2026-11-04T19:00:00Z')];
    expect(computePotdMarks([gfgPotd('2026-11-04')], late, Date.parse('2026-11-04T19:01:00Z'), dateIn(IST))).toEqual([]);
  });

  it('only counts accepted submissions', () => {
    const wa = [ac('leetcode:two-sum', solvedAt, 'WA')];
    expect(computePotdMarks(items, wa, Date.parse('2026-11-04T02:00:00Z'), dateIn(PST))).toEqual([]);
  });

  it('records a stale POTD under the day it was solved', () => {
    // POTD list from Nov 1 still cached on Nov 4: don't put the old completion under today.
    const s = [ac('leetcode:two-sum', '2026-11-01T12:00:00Z')];
    const marks = computePotdMarks([lcDaily('2026-11-01')], s, Date.parse('2026-11-04T12:00:00Z'), dateIn(0));
    expect(marks[0]).toMatchObject({ date: '2026-11-01' });
  });
});

describe('applyPotdMarks', () => {
  it('returns the same object when nothing changes', () => {
    const done = { '2026-11-04': ['leetcode:two-sum'] };
    expect(applyPotdMarks(done, [{ key: 'leetcode:two-sum', date: '2026-11-04', clear: ['2026-11-03'] }])).toBe(done);
  });
});
