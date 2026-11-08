import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('wxt/browser', async () => ({ browser: (await import('wxt/testing/fake-browser')).fakeBrowser }));

const { fakeBrowser } = await import('wxt/testing/fake-browser');
const subs = await import('../src/agents/submissions');
const storage = await import('../src/lib/storage');

const CORE = {
  matchedUser: {
    username: 'alice',
    profile: { realName: 'Alice', ranking: 123456 },
    submitStatsGlobal: {
      acSubmissionNum: [
        { difficulty: 'All', count: 312 },
        { difficulty: 'Easy', count: 150 },
        { difficulty: 'Medium', count: 140 },
        { difficulty: 'Hard', count: 22 },
      ],
    },
  },
  allQuestionsCount: [
    { difficulty: 'All', count: 3400 },
    { difficulty: 'Easy', count: 850 },
    { difficulty: 'Medium', count: 1780 },
    { difficulty: 'Hard', count: 770 },
  ],
};
const EXTRAS = {
  userContestRanking: { rating: 1734.62, attendedContestsCount: 12, topPercentage: 18.4 },
  matchedUser: { userCalendar: { streak: 5, totalActiveDays: 140 } },
};

/** A fake GraphQL client that answers by query contents. */
function graphql(answers: { core?: unknown; extras?: unknown; recent?: unknown }) {
  return vi.fn(async (query: string) => {
    if (query.includes('recentAcSubmissionList')) return answers.recent ?? { recentAcSubmissionList: [] };
    if (query.includes('userContestRanking')) {
      if (answers.extras instanceof Error) throw answers.extras;
      return answers.extras;
    }
    if (answers.core instanceof Error) throw answers.core;
    return answers.core;
  }) as never;
}

beforeEach(() => fakeBrowser.reset());

describe('LeetCode profile totals', () => {
  it('maps the public profile to real totals', () => {
    const p = subs.mapLeetCodeProfile('alice', CORE, EXTRAS, 1000);
    expect(p).toMatchObject({
      handle: 'alice',
      name: 'Alice',
      totalSolved: 312,
      byDifficulty: { Easy: 150, Medium: 140, Hard: 22 },
      totalByDifficulty: { Easy: 850, Medium: 1780, Hard: 770 },
      ranking: 123456,
      contestRating: 1735,
      contestsAttended: 12,
      contestTopPercent: 18.4,
      activeDays: 140,
      streak: 5,
      fetchedAt: 1000,
    });
  });

  it('keeps the core numbers when contest/calendar data is missing', () => {
    const p = subs.mapLeetCodeProfile('alice', CORE, { userContestRanking: null, matchedUser: null }, 1);
    expect(p.totalSolved).toBe(312);
    expect(p.contestRating).toBeUndefined();
    expect(p.streak).toBeUndefined();
  });

  it('rejects an unknown user', () => {
    expect(() => subs.mapLeetCodeProfile('ghost', { matchedUser: null, allQuestionsCount: null }, null, 1)).toThrow('not found');
  });

  it('saves the profile, even when the extras query fails', async () => {
    await subs.refreshLeetCodeProfile('alice', graphql({ core: CORE, extras: new Error('boom') }), 5);
    const saved = (await storage.getItem('profiles')).leetcode!;
    expect(saved.totalSolved).toBe(312);
    expect(saved.contestRating).toBeUndefined();
  });

  it('syncLeetCode refreshes the profile and still imports when the profile fails', async () => {
    const recent = {
      recentAcSubmissionList: [{ id: '9', title: 'Two Sum', titleSlug: 'two-sum', timestamp: '1700000000', lang: 'python3' }],
    };
    const out: never[] = [];
    await subs.syncLeetCode('alice', undefined, out, graphql({ recent, core: CORE, extras: EXTRAS }));
    expect(out).toHaveLength(1);
    expect((await storage.getItem('profiles')).leetcode?.totalSolved).toBe(312);

    const out2: never[] = [];
    await subs.syncLeetCode('bob', undefined, out2, graphql({ recent, core: new Error('down') }));
    expect(out2).toHaveLength(1); // import unaffected
    expect((await storage.getItem('profiles')).leetcode?.handle).toBe('alice'); // last good profile kept
  });
});
