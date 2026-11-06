import { describe, expect, it } from 'vitest';
import { mapGfgSolved, parseGfgTime } from '../src/agents/submissions';

// Shape of practiceapi.geeksforgeeks.org/api/v1/user/problems/submissions/ (result field).
const SAMPLE = {
  Basic: {
    '703159': { slug: 'index-of-first-1-in-a-sorted-array-of-0s-and-1s4048', pname: 'First 1 in Sorted Binary', lang: 'python3', user_subtime: '2017-07-31 23:34:44' },
  },
  Medium: {
    '701198': { slug: 'Wave-Array-1587115621', pname: 'Wave Array', lang: 'c', user_subtime: '2016-10-15 23:51:00' },
    '999': { slug: '', pname: 'broken', user_subtime: '2016-10-15 23:51:00' },
  },
  Hard: {
    '703132': { slug: 'count-smaller-elements2214', pname: 'Count Smaller on Right', lang: 'c', user_subtime: 'not a date' },
  },
};

describe('GeeksforGeeks import', () => {
  it('parses GFG times as IST', () => {
    expect(new Date(parseGfgTime('2017-07-31 23:34:44')!).toISOString()).toBe('2017-07-31T18:04:44.000Z');
    expect(parseGfgTime('garbage')).toBeNull();
    expect(parseGfgTime(undefined)).toBeNull();
  });

  it('maps solved problems to accepted submissions with stable keys', () => {
    const subs = mapGfgSolved(SAMPLE);
    expect(subs.map((s) => s.id).sort()).toEqual(['gfg:701198', 'gfg:703159']);
    const wave = subs.find((s) => s.id === 'gfg:701198')!;
    expect(wave).toMatchObject({
      platform: 'gfg',
      problemKey: 'gfg:wave-array-1587115621',
      title: 'Wave Array',
      verdict: 'AC',
      difficulty: 'Medium',
      url: 'https://www.geeksforgeeks.org/problems/wave-array-1587115621/1',
    });
  });

  it('tolerates empty or missing results', () => {
    expect(mapGfgSolved({})).toEqual([]);
    expect(mapGfgSolved(undefined as never)).toEqual([]);
  });
});
